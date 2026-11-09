-- Invites that work, people import, and the join link.
--
-- Before this migration sign-up never read an invite. handle_new_user() only
-- looked at raw_user_meta_data.company_code; pending_company_associations was
-- written by admin_invite_company_admin() (and by verify-company-code) but
-- nothing ever read it. "Invite admin" did nothing, and the HR admin of a
-- brand-new company had no way in.
--
-- There is no invite email. Invites go out as a spreadsheet of personal links
-- (/?invite=TOKEN for employees, /hr.html?invite=TOKEN for HR admins).
--
--  1. pending_company_associations becomes the invite table: display_name,
--     team_id, role, token, invited_by, accepted_at, source. Invites made by
--     import or by a Wellness House admin last 90 days.
--  2. Invite rows can only be changed by the functions below. verify-company-
--     code (service role, can't be redeployed) upserts {email, company_id,
--     verified} on every code check, which would otherwise move an invited
--     person to whatever company code they typed.
--  3. handle_new_user() places a new user by, in order:
--       a. raw_user_meta_data.invite_token + matching email (any role,
--          including hr_admin — the only way hr_admin is granted, because
--          email confirmation is off and an email alone proves nothing);
--       b. an open employee/manager invite for the email (imported people can
--          sign up without a code);
--       c. the company code, exactly as before.
--  4. join_company_for_me(): the same placement for a signed-in user who has
--     no profile yet (an account created before its invite existed, or a
--     sign-up that found nothing). Without it such an account stays stuck:
--     handle_new_user() only runs on INSERT. A member who opens an HR-admin
--     link while signed in is promoted here — the token, never the email.
--  5. import_people(), list_people_invites() for HR admins and Wellness House
--     admins; admin_invite_company_admin() now makes a token invite (also for
--     an existing member) and returns the link data.
--
-- Safe to run more than once.

-- ── 1. invite columns ────────────────────────────────────────
ALTER TABLE public.pending_company_associations
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS team_id      UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role         TEXT NOT NULL DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS token        TEXT,
  ADD COLUMN IF NOT EXISTS invited_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source       TEXT;

ALTER TABLE public.pending_company_associations
  DROP CONSTRAINT IF EXISTS pending_company_associations_role_check;
ALTER TABLE public.pending_company_associations
  ADD CONSTRAINT pending_company_associations_role_check
  CHECK (role IN ('employee', 'manager', 'hr_admin'));

ALTER TABLE public.pending_company_associations
  DROP CONSTRAINT IF EXISTS pending_company_associations_source_check;
ALTER TABLE public.pending_company_associations
  ADD CONSTRAINT pending_company_associations_source_check
  CHECK (source IS NULL OR source IN ('import', 'admin_invite'));

CREATE UNIQUE INDEX IF NOT EXISTS pending_company_associations_token_key
  ON public.pending_company_associations (token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_company_id
  ON public.pending_company_associations (company_id);

-- ── 2. invite rows change only through the invite functions ──
CREATE OR REPLACE FUNCTION public.pending_invites_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- source IS NOT NULL marks a real invite (import / admin_invite). The
  -- functions in this file set wellness.invite_write for their transaction.
  -- Anything else (verify-company-code's upsert) leaves the invite untouched.
  IF OLD.source IS NOT NULL
     AND coalesce(current_setting('wellness.invite_write', true), '') <> 'on' THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pending_invites_guard ON public.pending_company_associations;
CREATE TRIGGER trg_pending_invites_guard
  BEFORE UPDATE ON public.pending_company_associations
  FOR EACH ROW EXECUTE FUNCTION public.pending_invites_guard();

-- Accepted invites are the record of who joined from which sheet; keep them.
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.pending_company_associations
  WHERE expires_at < now()
    AND accepted_at IS NULL;
$$;

-- 32 hex chars from gen_random_uuid() (122 random bits, core Postgres — no
-- pgcrypto schema lookup needed).
CREATE OR REPLACE FUNCTION public.new_invite_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT replace(gen_random_uuid()::text, '-', '');
$$;

-- Internal helpers and triggers are not RPCs.
REVOKE ALL ON FUNCTION public.new_invite_token()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pending_invites_guard()  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.new_invite_token() TO service_role;

-- ── 3. placement shared by sign-up and join_company_for_me ──
CREATE OR REPLACE FUNCTION public.place_new_user(p_user_id UUID, p_email TEXT, p_meta JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email   TEXT := lower(btrim(coalesce(p_email, '')));
  v_meta    JSONB := coalesce(p_meta, '{}'::jsonb);
  v_token   TEXT := nullif(btrim(coalesce(v_meta ->> 'invite_token', '')), '');
  v_code    TEXT := nullif(upper(btrim(coalesce(v_meta ->> 'company_code', ''))), '');
  v_name    TEXT := coalesce(v_meta ->> 'display_name', '');
  v_inv     public.pending_company_associations%ROWTYPE;
  v_via     TEXT;
  v_company UUID;
  v_team    UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('placed', false);
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    -- Already a member and opening a personal link (join_company_for_me): the
    -- token is the proof that lets an employee / manager become HR admin. An
    -- email match alone never promotes anyone.
    IF v_token IS NOT NULL AND v_email <> '' THEN
      SELECT i.* INTO v_inv
        FROM public.pending_company_associations i
        JOIN public.profiles p ON p.id = p_user_id AND p.company_id = i.company_id
       WHERE i.token = v_token
         AND i.email = v_email
         AND i.source IS NOT NULL
         AND i.expires_at > now()
       FOR UPDATE OF i;
      IF FOUND THEN
        UPDATE public.profiles
           SET role = CASE WHEN v_inv.role = 'hr_admin' AND role IN ('employee', 'manager')
                           THEN 'hr_admin' ELSE role END
         WHERE id = p_user_id;
        PERFORM set_config('wellness.invite_write', 'on', true);
        UPDATE public.pending_company_associations
           SET accepted_at = coalesce(accepted_at, now()),
               verified    = true
         WHERE id = v_inv.id;
        RETURN (
          SELECT jsonb_build_object('placed', true, 'via', 'invite_token',
                                    'company_id', company_id, 'role', role)
            FROM public.profiles WHERE id = p_user_id
        );
      END IF;
    END IF;

    RETURN (
      SELECT jsonb_build_object('placed', true, 'via', 'existing',
                                'company_id', company_id, 'role', role)
        FROM public.profiles WHERE id = p_user_id
    );
  END IF;

  -- a. personal invite link: token + the email it was made for. Any role.
  IF v_token IS NOT NULL AND v_email <> '' THEN
    SELECT * INTO v_inv
      FROM public.pending_company_associations
     WHERE token = v_token
       AND email = v_email
       AND source IS NOT NULL
       AND expires_at > now()
     FOR UPDATE;
    IF FOUND THEN v_via := 'invite_token'; END IF;
  END IF;

  -- b. imported employee / manager signing up with just their email.
  --    Never hr_admin: that needs the token.
  IF v_via IS NULL AND v_email <> '' THEN
    SELECT * INTO v_inv
      FROM public.pending_company_associations
     WHERE email = v_email
       AND source IS NOT NULL
       AND token IS NOT NULL
       AND role IN ('employee', 'manager')
       AND expires_at > now()
     FOR UPDATE;
    IF FOUND THEN v_via := 'invite_email'; END IF;
  END IF;

  IF v_via IS NOT NULL THEN
    -- The team must still be in the invite's company.
    SELECT id INTO v_team
      FROM public.teams
     WHERE id = v_inv.team_id AND company_id = v_inv.company_id;

    INSERT INTO public.profiles (id, company_id, team_id, role, display_name)
    VALUES (
      p_user_id,
      v_inv.company_id,
      v_team,
      v_inv.role,
      coalesce(nullif(btrim(v_inv.display_name), ''), v_name, '')
    );

    PERFORM set_config('wellness.invite_write', 'on', true);
    UPDATE public.pending_company_associations
       SET accepted_at = coalesce(accepted_at, now()),
           verified    = true
     WHERE id = v_inv.id;

    RETURN jsonb_build_object('placed', true, 'via', v_via,
                              'company_id', v_inv.company_id, 'role', v_inv.role);
  END IF;

  -- c. company code — unchanged behaviour.
  IF v_code IS NOT NULL THEN
    SELECT id INTO v_company FROM public.companies WHERE code = v_code;
    IF v_company IS NOT NULL THEN
      INSERT INTO public.profiles (id, company_id, display_name)
      VALUES (p_user_id, v_company, v_name);
      RETURN jsonb_build_object('placed', true, 'via', 'company_code',
                                'company_id', v_company, 'role', 'employee');
    END IF;
  END IF;

  -- Nothing matched. Fail silently like before: the client offers the
  -- company code and calls join_company_for_me().
  RETURN jsonb_build_object('placed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.place_new_user(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_new_user(UUID, TEXT, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.place_new_user(NEW.id, NEW.email, NEW.raw_user_meta_data);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;

-- on_auth_user_created already points at handle_new_user(); recreate it only
-- if it is missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'on_auth_user_created'
       AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- ── 4. join_company_for_me ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_company_for_me(
  p_company_code TEXT DEFAULT NULL,
  p_invite_token TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_email TEXT;
  v_meta  JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Email from auth.users, not from anything the caller sends.
  SELECT email, coalesce(raw_user_meta_data, '{}'::jsonb)
    INTO v_email, v_meta
    FROM auth.users
   WHERE id = v_uid;

  RETURN public.place_new_user(
    v_uid,
    v_email,
    v_meta || jsonb_strip_nulls(jsonb_build_object(
      'company_code', nullif(btrim(coalesce(p_company_code, '')), ''),
      'invite_token', nullif(btrim(coalesce(p_invite_token, '')), '')
    ))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_company_for_me(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_company_for_me(TEXT, TEXT) TO authenticated, service_role;

-- ── 5. who may manage a company's people ─────────────────────
-- Wellness House admins for any company; HR admins / company admins for
-- their own.
CREATE OR REPLACE FUNCTION public.can_manage_company_people(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_company_id IS NOT NULL AND coalesce(
    public.is_wellness_admin()
    OR (public.auth_role() IN ('hr_admin', 'company_admin')
        AND public.auth_company_id() = p_company_id),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_company_people(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_company_people(UUID) TO service_role;

-- ── 6. import_people ─────────────────────────────────────────
-- p_rows: [{row?, name, email, team, role}, …] (role: employee | manager |
-- hr_admin; blank = employee). Re-running the same sheet updates the same
-- invites and keeps their tokens, so links already handed out keep working.
-- People who already have an account in the company get their team / role
-- updated instead — except HR admin, which still needs their personal link.
CREATE OR REPLACE FUNCTION public.import_people(p_company_id UUID, p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  r             JSONB;
  i             INT := 0;
  v_rownum      INT;
  v_name        TEXT;
  v_email       TEXT;
  v_team_name   TEXT;
  v_role_raw    TEXT;
  v_role        TEXT;
  v_reason      TEXT;
  v_team_id     UUID;
  v_seen        TEXT[] := '{}';
  v_new_teams   TEXT[] := '{}';
  v_skipped     JSONB := '[]'::jsonb;
  v_new         INT := 0;
  v_again       INT := 0;
  v_updated     INT := 0;
  v_upgrades    INT := 0;
  v_prof        RECORD;
  v_inv         public.pending_company_associations%ROWTYPE;
  v_has_inv     BOOLEAN;
  v_same        BOOLEAN;
BEGIN
  IF NOT public.can_manage_company_people(p_company_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'company_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'rows_must_be_an_array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) > 2000 THEN
    RAISE EXCEPTION 'too_many_rows' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('wellness.invite_write', 'on', true);

  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    i := i + 1;
    v_reason := NULL;
    v_team_id := NULL;

    IF jsonb_typeof(r) <> 'object' THEN
      v_skipped := v_skipped || jsonb_build_object('row', i, 'email', NULL, 'reason', 'invalid_row');
      CONTINUE;
    END IF;

    v_rownum    := CASE WHEN coalesce(r ->> 'row', '') ~ '^[0-9]{1,7}$' THEN (r ->> 'row')::INT ELSE i END;
    v_name      := regexp_replace(btrim(coalesce(r ->> 'name', '')), '\s+', ' ', 'g');
    v_email     := lower(btrim(coalesce(r ->> 'email', '')));
    v_team_name := regexp_replace(btrim(coalesce(r ->> 'team', '')), '\s+', ' ', 'g');
    v_role_raw  := lower(btrim(coalesce(r ->> 'role', '')));
    v_role := CASE
      WHEN v_role_raw IN ('', 'employee')             THEN 'employee'
      WHEN v_role_raw = 'manager'                     THEN 'manager'
      WHEN v_role_raw IN ('hr_admin', 'company_admin') THEN 'hr_admin'
    END;

    IF v_email = '' THEN
      v_reason := 'missing_email';
    ELSIF length(v_email) > 254 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:].]+$' THEN
      v_reason := 'invalid_email';
    ELSIF v_role IS NULL THEN
      v_reason := 'unknown_role';
    ELSIF v_team_name = '' AND v_role <> 'hr_admin' THEN
      v_reason := 'missing_team';
    ELSIF length(v_name) > 120 THEN
      v_reason := 'name_too_long';
    ELSIF length(v_team_name) > 80 THEN
      v_reason := 'team_too_long';
    ELSIF v_email = ANY (v_seen) THEN
      v_reason := 'duplicate_in_file';
    END IF;

    IF v_reason IS NOT NULL THEN
      v_skipped := v_skipped || jsonb_build_object('row', v_rownum, 'email', nullif(v_email, ''), 'reason', v_reason);
      CONTINUE;
    END IF;
    v_seen := v_seen || v_email;

    -- Already has an account?
    SELECT p.id, p.company_id, p.role, p.deleted_at
      INTO v_prof
      FROM auth.users u
      JOIN public.profiles p ON p.id = u.id
     WHERE lower(u.email) = v_email
     LIMIT 1;

    IF v_prof.id IS NOT NULL AND v_prof.company_id <> p_company_id THEN
      v_skipped := v_skipped || jsonb_build_object('row', v_rownum, 'email', v_email, 'reason', 'other_company');
      CONTINUE;
    END IF;
    IF v_prof.id IS NOT NULL AND v_prof.deleted_at IS NOT NULL THEN
      v_skipped := v_skipped || jsonb_build_object('row', v_rownum, 'email', v_email, 'reason', 'account_deleted');
      CONTINUE;
    END IF;

    SELECT * INTO v_inv
      FROM public.pending_company_associations
     WHERE email = v_email
     FOR UPDATE;
    v_has_inv := FOUND;
    -- An open invite from another company is theirs, not ours to move.
    IF v_has_inv AND v_inv.company_id <> p_company_id
       AND v_inv.source IS NOT NULL AND v_inv.accepted_at IS NULL
       AND v_inv.expires_at > now() THEN
      v_skipped := v_skipped || jsonb_build_object('row', v_rownum, 'email', v_email, 'reason', 'other_company');
      CONTINUE;
    END IF;

    -- Team by name (case-insensitive), created when missing.
    IF v_team_name <> '' THEN
      SELECT id INTO v_team_id
        FROM public.teams
       WHERE company_id = p_company_id
         AND lower(btrim(name)) = lower(v_team_name)
       ORDER BY created_at
       LIMIT 1;
      IF NOT FOUND THEN
        INSERT INTO public.teams (company_id, name)
        VALUES (p_company_id, v_team_name)
        RETURNING id INTO v_team_id;
        v_new_teams := v_new_teams || v_team_name;
      END IF;
    END IF;

    IF v_prof.id IS NOT NULL THEN
      -- Joined already: update team / role instead of inviting. Never change
      -- the caller's own role, never demote a company or platform admin, and
      -- never make anyone HR admin from an email match — that takes the
      -- personal link (an invite is written below).
      UPDATE public.profiles
         SET team_id = coalesce(v_team_id, team_id),
             role = CASE
                      WHEN id = v_uid THEN role
                      WHEN role IN ('company_admin', 'wellness_admin') THEN role
                      WHEN v_role = 'hr_admin' THEN role
                      ELSE v_role
                    END
       WHERE id = v_prof.id;
      v_updated := v_updated + 1;
      IF NOT (v_role = 'hr_admin' AND v_prof.role IN ('employee', 'manager')
              AND v_prof.id IS DISTINCT FROM v_uid) THEN
        CONTINUE;
      END IF;
      v_upgrades := v_upgrades + 1;
    END IF;

    IF v_has_inv THEN
      v_same := v_inv.company_id = p_company_id AND v_inv.source IS NOT NULL;
      UPDATE public.pending_company_associations
         SET company_id   = p_company_id,
             display_name = coalesce(nullif(v_name, ''), CASE WHEN v_same THEN display_name END),
             team_id      = v_team_id,
             role         = v_role,
             token        = CASE WHEN v_same AND token IS NOT NULL THEN token ELSE public.new_invite_token() END,
             source       = CASE WHEN v_same THEN source ELSE 'import' END,
             invited_by   = coalesce(v_uid, invited_by),
             verified     = true,
             accepted_at  = NULL,
             expires_at   = greatest(expires_at, now() + interval '90 days')
       WHERE id = v_inv.id;
      IF v_prof.id IS NULL THEN
        IF v_same THEN v_again := v_again + 1; ELSE v_new := v_new + 1; END IF;
      END IF;
    ELSE
      INSERT INTO public.pending_company_associations
        (email, company_id, display_name, team_id, role, token, invited_by, source, verified, expires_at)
      VALUES
        (v_email, p_company_id, nullif(v_name, ''), v_team_id, v_role, public.new_invite_token(),
         v_uid, 'import', true, now() + interval '90 days')
      ON CONFLICT (email) DO NOTHING;
      IF NOT FOUND THEN
        v_skipped := v_skipped || jsonb_build_object('row', v_rownum, 'email', v_email, 'reason', 'try_again');
      ELSIF v_prof.id IS NULL THEN
        v_new := v_new + 1;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (
    coalesce(auth.jwt() ->> 'email', 'system'),
    v_uid,
    'people.imported',
    (SELECT name FROM public.companies WHERE id = p_company_id),
    p_company_id,
    'info',
    jsonb_build_object(
      'rows', jsonb_array_length(p_rows),
      'new_invites', v_new,
      'already_invited', v_again,
      'updated', v_updated,
      'hr_admin_links', v_upgrades,
      'teams_created', cardinality(v_new_teams),
      'skipped', jsonb_array_length(v_skipped)
    )
  );

  RETURN jsonb_build_object(
    'invited',         v_new + v_again,
    'new_invites',     v_new,
    'already_invited', v_again,
    'updated',         v_updated,
    -- existing members listed as hr_admin: they become HR admin by opening
    -- their link from the invite sheet while signed in.
    'hr_admin_links',  v_upgrades,
    'teams_created',   cardinality(v_new_teams),
    'new_teams',       to_jsonb(v_new_teams),
    'skipped',         v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_people(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_people(UUID, JSONB) TO authenticated, service_role;

-- ── 7. list_people_invites ───────────────────────────────────
-- Feeds the invite sheet and the joined / pending view. status: joined
-- (accepted, or an account with that email is in the company), pending,
-- expired. An HR-admin link for a member who isn't HR admin yet stays
-- pending until they open it.
CREATE OR REPLACE FUNCTION public.list_people_invites(p_company_id UUID)
RETURNS TABLE (
  name        TEXT,
  email       TEXT,
  team        TEXT,
  role        TEXT,
  token       TEXT,
  status      TEXT,
  source      TEXT,
  created_at  TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.can_manage_company_people(p_company_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    i.display_name,
    i.email,
    t.name,
    i.role,
    i.token,
    CASE
      WHEN m.id IS NOT NULL AND i.role = 'hr_admin'
           AND m.role NOT IN ('hr_admin', 'company_admin', 'wellness_admin')
        THEN CASE WHEN i.expires_at <= now() THEN 'expired' ELSE 'pending' END
      WHEN i.accepted_at IS NOT NULL OR m.id IS NOT NULL THEN 'joined'
      WHEN i.expires_at <= now()                         THEN 'expired'
      ELSE 'pending'
    END,
    i.source,
    i.created_at,
    i.expires_at,
    i.accepted_at
  FROM public.pending_company_associations i
  LEFT JOIN public.teams t ON t.id = i.team_id
  LEFT JOIN LATERAL (
    SELECT p.id, p.role
      FROM auth.users u
      JOIN public.profiles p ON p.id = u.id
     WHERE lower(u.email) = i.email
       AND p.company_id = i.company_id
       AND p.deleted_at IS NULL
     LIMIT 1
  ) m ON true
  WHERE i.company_id = p_company_id
    AND i.source IS NOT NULL
  ORDER BY t.name NULLS FIRST, i.display_name NULLS LAST, i.email;
END;
$$;

REVOKE ALL ON FUNCTION public.list_people_invites(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_people_invites(UUID) TO authenticated, service_role;

-- ── 8. admin_invite_company_admin → token invite ─────────────
-- Return type changes (void → jsonb) and a name argument is added, so the
-- old signature has to go first.
DROP FUNCTION IF EXISTS public.admin_invite_company_admin(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.admin_invite_company_admin(
  p_company_id UUID,
  p_email      TEXT,
  p_name       TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(btrim(coalesce(p_email, '')));
  v_name  TEXT := nullif(btrim(coalesce(p_name, '')), '');
  v_prof  RECORD;
  v_inv   public.pending_company_associations%ROWTYPE;
  v_row   public.pending_company_associations%ROWTYPE;
  v_same  BOOLEAN;
BEGIN
  IF NOT public.is_wellness_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF length(v_email) > 254 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:].]+$' THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'company_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Already has an account? Email confirmation is off, so the account may
  -- not be the person's: it still gets a personal link, and opening it while
  -- signed in (join_company_for_me) is what makes it HR admin.
  SELECT p.id, p.company_id, p.role
    INTO v_prof
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
   WHERE lower(u.email) = v_email
   LIMIT 1;

  IF v_prof.id IS NOT NULL THEN
    IF v_prof.company_id <> p_company_id THEN
      RAISE EXCEPTION 'email_in_other_company' USING ERRCODE = 'P0001';
    END IF;
    IF v_prof.role IN ('hr_admin', 'company_admin', 'wellness_admin') THEN
      RETURN jsonb_build_object('status', 'already_admin', 'email', v_email,
                                'company_id', p_company_id, 'role', v_prof.role);
    END IF;
  END IF;

  PERFORM set_config('wellness.invite_write', 'on', true);

  SELECT * INTO v_inv
    FROM public.pending_company_associations
   WHERE email = v_email
   FOR UPDATE;

  IF FOUND THEN
    v_same := v_inv.company_id = p_company_id AND v_inv.source IS NOT NULL;
    UPDATE public.pending_company_associations
       SET company_id   = p_company_id,
           role         = 'hr_admin',
           source       = 'admin_invite',
           token        = CASE WHEN v_same AND token IS NOT NULL THEN token ELSE public.new_invite_token() END,
           display_name = coalesce(v_name, CASE WHEN v_same THEN display_name END),
           team_id      = CASE WHEN v_same THEN team_id END,  -- keep a team set by import
           invited_by   = coalesce(auth.uid(), invited_by),
           verified     = true,
           accepted_at  = NULL,
           expires_at   = greatest(expires_at, now() + interval '90 days')
     WHERE id = v_inv.id
     RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.pending_company_associations
      (email, company_id, display_name, role, token, invited_by, source, verified, expires_at)
    VALUES
      (v_email, p_company_id, v_name, 'hr_admin', public.new_invite_token(),
       auth.uid(), 'admin_invite', true, now() + interval '90 days')
    RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (
    coalesce(auth.jwt() ->> 'email', 'system'),
    auth.uid(),
    'tenant.admin_invited',
    v_email,
    p_company_id,
    'info',
    jsonb_build_object('email', v_email, 'role', 'hr_admin', 'existing_account', v_prof.id IS NOT NULL)
  );

  RETURN jsonb_build_object(
    'status',     'invited',
    'existing_account', v_prof.id IS NOT NULL,
    'email',      v_row.email,
    'name',       v_row.display_name,
    'role',       v_row.role,
    'token',      v_row.token,
    'company_id', v_row.company_id,
    'expires_at', v_row.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_invite_company_admin(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_invite_company_admin(UUID, TEXT, TEXT) TO authenticated, service_role;

-- PostgREST caches the function list; pick up the new / changed signatures.
NOTIFY pgrst, 'reload schema';
