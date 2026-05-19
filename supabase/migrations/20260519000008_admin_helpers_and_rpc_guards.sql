-- Admin-portal sweep, Phase A.1
--
-- Two problems closed here:
--
-- 1. `is_wellness_admin()` previously returned NULL for callers whose JWT
--    `app_metadata.role` wasn't backfilled (the common case in production
--    because the `custom_access_token_hook` is defined but not wired into
--    Auth). That made the SQL guard `IF NOT public.is_wellness_admin() ...`
--    inside every `admin_*` RPC effectively a no-op (`NOT NULL` evaluates to
--    NULL, which is not TRUE, so the IF body never ran). Any authenticated
--    user could call `admin_set_flag`, `admin_set_billing`, `admin_set_role`,
--    `admin_create_tenant`, and `admin_invite_company_admin`.
--
--    Fix: rewrite the helper to return a real boolean, honour the
--    `is_superadmin()` allowlist and fall back to `profiles.role` so the
--    function works whether or not the JWT hook ever fires.
--
-- 2. `feature_flags` has `UNIQUE (key, scope, target_id)` but every
--    NULL value in `target_id` is treated as distinct, so an `ON CONFLICT`
--    upsert from `admin_set_flag` inserted a duplicate instead of toggling
--    the existing global flag. Toggling a global flag once was creating
--    a new row each click. Replace the column unique with two partial
--    unique indexes (NULL / NOT NULL) so the upsert dedupes correctly.

-- ── 1. Rewrite is_wellness_admin() ─────────────────────────────
CREATE OR REPLACE FUNCTION public.is_wellness_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt() -> 'app_metadata' ->> 'role';
BEGIN
  IF (v_role IS NULL OR v_role = '') AND auth.uid() IS NOT NULL THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  END IF;
  IF public.is_superadmin() THEN
    RETURN TRUE;
  END IF;
  RETURN COALESCE(v_role = 'wellness_admin', FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_wellness_admin() TO authenticated;

-- ── 2. Harden the admin_* RPCs with auth_role()-based guard ────
-- The guard now accepts wellness_admin (the dedicated platform role) and
-- the superadmin allowlist. company_admin and lower are denied.

CREATE OR REPLACE FUNCTION public.admin_create_tenant(
  p_name TEXT,
  p_locale TEXT DEFAULT 'en',
  p_timezone TEXT DEFAULT 'UTC',
  p_plan TEXT DEFAULT 'starter'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company public.companies%ROWTYPE;
  v_slug TEXT;
BEGIN
  IF NOT public.is_wellness_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN
    v_slug := 'tenant';
  END IF;

  INSERT INTO public.companies (name, slug, code, plan, settings)
  VALUES (
    p_name,
    v_slug || '-' || substr(gen_random_uuid()::text, 1, 6),
    upper(substr(md5(random()::text), 1, 2) || '-' || substr(md5(random()::text), 1, 4)),
    CASE WHEN p_plan IN ('starter','growth','enterprise') THEN p_plan ELSE 'starter' END,
    jsonb_build_object('locale', p_locale, 'timezone', p_timezone)
  )
  RETURNING * INTO v_company;

  INSERT INTO public.billing_state (company_id, plan, mrr_cents, seats, status)
  VALUES (v_company.id, p_plan, 0, 0, 'active')
  ON CONFLICT (company_id) DO NOTHING;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (
    coalesce(auth.jwt() ->> 'email', 'system'),
    auth.uid(),
    'tenant.created',
    v_company.name,
    v_company.id,
    'info',
    jsonb_build_object('plan', p_plan, 'locale', p_locale, 'timezone', p_timezone)
  );

  RETURN to_jsonb(v_company);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_billing(p_company_id UUID, p_patch JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.billing_state%ROWTYPE;
BEGIN
  IF NOT public.is_wellness_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.billing_state (company_id)
  VALUES (p_company_id)
  ON CONFLICT (company_id) DO NOTHING;

  UPDATE public.billing_state
  SET
    plan = coalesce(p_patch ->> 'plan', plan),
    status = coalesce(p_patch ->> 'status', status),
    mrr_cents = coalesce((p_patch ->> 'mrr_cents')::INT, mrr_cents),
    seats = coalesce((p_patch ->> 'seats')::INT, seats),
    updated_at = now()
  WHERE company_id = p_company_id
  RETURNING * INTO v_row;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (
    coalesce(auth.jwt() ->> 'email', 'system'),
    auth.uid(),
    'billing.updated',
    'billing_state',
    p_company_id,
    'info',
    p_patch
  );

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_flag(
  p_key TEXT,
  p_scope TEXT,
  p_target_id UUID,
  p_enabled BOOLEAN,
  p_payload JSONB DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.feature_flags%ROWTYPE;
  v_existing UUID;
BEGIN
  IF NOT public.is_wellness_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- We can't rely on ON CONFLICT (key, scope, target_id) because Postgres
  -- treats NULL target_id values as distinct under the default unique
  -- semantics. Do a manual lookup + upsert that handles the NULL case.
  IF p_target_id IS NULL THEN
    SELECT id INTO v_existing
      FROM public.feature_flags
     WHERE key = p_key AND scope = p_scope AND target_id IS NULL
     LIMIT 1;
  ELSE
    SELECT id INTO v_existing
      FROM public.feature_flags
     WHERE key = p_key AND scope = p_scope AND target_id = p_target_id
     LIMIT 1;
  END IF;

  IF v_existing IS NOT NULL THEN
    UPDATE public.feature_flags
       SET enabled = p_enabled,
           payload = coalesce(p_payload, '{}'),
           updated_at = now()
     WHERE id = v_existing
     RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.feature_flags (key, scope, target_id, enabled, payload, updated_at)
    VALUES (p_key, p_scope, p_target_id, p_enabled, coalesce(p_payload, '{}'), now())
    RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (
    coalesce(auth.jwt() ->> 'email', 'system'),
    auth.uid(),
    'flag.toggled',
    p_key,
    v_row.id,
    'info',
    jsonb_build_object('scope', p_scope, 'enabled', p_enabled, 'target', p_target_id)
  );

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id UUID, p_role TEXT, p_company_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old TEXT;
BEGIN
  IF NOT public.is_wellness_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_old FROM public.profiles WHERE id = p_user_id;

  UPDATE public.profiles
  SET role = p_role,
      company_id = coalesce(p_company_id, company_id)
  WHERE id = p_user_id;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (
    coalesce(auth.jwt() ->> 'email', 'system'),
    auth.uid(),
    'role.assigned',
    p_role,
    p_user_id,
    'info',
    jsonb_build_object('previous_role', v_old, 'new_role', p_role, 'company_id', p_company_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_invite_company_admin(p_company_id UUID, p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_wellness_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.pending_company_associations (email, company_id, verified)
  VALUES (lower(trim(p_email)), p_company_id, true)
  ON CONFLICT (email) DO UPDATE SET company_id = EXCLUDED.company_id, verified = true;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (
    coalesce(auth.jwt() ->> 'email', 'system'),
    auth.uid(),
    'tenant.admin_invited',
    lower(trim(p_email)),
    p_company_id,
    'info',
    jsonb_build_object('email', lower(trim(p_email)))
  );
END;
$$;

-- ── 3. Fix feature_flags unique index for NULL target_id ───────
-- Step a) drop the old constraint that ignored NULL collisions.
-- Step b) deduplicate any rows that snuck through, preferring the most
--         recently updated row when duplicates exist.
-- Step c) recreate the unique index as two partial indexes (NULL /
--         NOT NULL) so global and targeted rollouts each dedupe correctly.

DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.feature_flags'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE 'UNIQUE (key, scope, target_id)%';
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.feature_flags DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

DROP INDEX IF EXISTS public.feature_flags_key_scope_target_id_key;
DROP INDEX IF EXISTS public.feature_flags_key_scope_targeted_uidx;
DROP INDEX IF EXISTS public.feature_flags_key_scope_global_uidx;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY key, scope,
                        COALESCE(target_id::TEXT, '__null__')
           ORDER BY updated_at DESC, id
         ) AS rn
  FROM public.feature_flags
)
DELETE FROM public.feature_flags
USING ranked
WHERE public.feature_flags.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX feature_flags_key_scope_targeted_uidx
  ON public.feature_flags (key, scope, target_id)
  WHERE target_id IS NOT NULL;

CREATE UNIQUE INDEX feature_flags_key_scope_global_uidx
  ON public.feature_flags (key, scope)
  WHERE target_id IS NULL;

-- Tidy up the audit-probe rows I created while exploring the portal.
DELETE FROM public.feature_flags WHERE key = 'audit.probe.dryrun';
