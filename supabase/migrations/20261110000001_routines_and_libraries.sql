-- Sprint 2: routines, checklists and libraries (database foundation).
--
-- Plan: docs/sprints/2026-11-09-sprint-2-routines-and-libraries.md (§4) with
-- Hazem's decisions on top. One idempotent file: paste it into the SQL
-- editor of the live project as-is (CREATE OR REPLACE / IF NOT EXISTS /
-- DROP POLICY IF EXISTS everywhere). Needs sprint 1 (20261109000001/2).
--
--  1. Company-local time. company_tz() / company_now() / company_today()
--     read companies.settings.timezone (IANA name, default Africa/Cairo).
--     Everything below, and the habit / score / HR functions rewritten here,
--     use the company's "today" instead of the database's UTC current_date.
--     Workweek: Sun–Thu.
--  2. Company settings: recognition ('off' | 'teams' | 'named', default
--     off), weekly_habit_enabled (default true), hr_people_view (default
--     false). Validated writes through hr_set_company_settings().
--  3. profile_prefs: reminders, muted items, the two opt-ins
--     (recognition board, share my progress with HR). Own row only; HR
--     can't see who said no. Opting in moves consent_version to v2.
--  4. Library scope. content_items and challenge_templates get company_id
--     (NULL = public, Wellness House; set = private to that company).
--     company_library_prefs holds a company's hide / pin choices about
--     public items. The cross-company bug is closed: HR can no longer
--     update shared content rows (content_items_hr_write is gone).
--  5. exercises, routines, routine_items, routine_assignments,
--     routine_checks (one per person per item per company-local day),
--     routine_days (per person per day: ticked / due / all done).
--  6. Private storage bucket company-media ({company_id}/… paths, 50 MB,
--     mp4 / mov / png / jpeg / pdf). Members of the company read (signed
--     URLs); that company's HR writes.
--  7. RPCs for the employee Today tab, the HR builder / library / report,
--     recognition, settings and a routine import from sheet rows.
--  8. Habit challenges: company-local dates, HR's own (private) templates
--     of 1–4 weeks (workdays only), and the default rotating week respects
--     weekly_habit_enabled and only rotates public templates.
--  9. score_events: +2 per routine item ticked (max 20 a day) and +10 for a
--     day with every item done. Existing events unchanged.
--
-- Internal helpers are revoked from app users (see the grants at the end).

-- ═══════════════════════════════════════════════════════════════
-- 1. Company-local time
-- ═══════════════════════════════════════════════════════════════

-- The company's IANA zone, or Africa/Cairo when missing / not a zone name.
CREATE OR REPLACE FUNCTION public.company_tz(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tz TEXT;
BEGIN
  SELECT nullif(btrim(settings ->> 'timezone'), '') INTO v_tz
    FROM public.companies WHERE id = p_company_id;
  -- Region/City names only: POSIX strings like 'UTC+2' invert the sign.
  IF v_tz IS NULL OR v_tz !~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)*$' THEN
    RETURN 'Africa/Cairo';
  END IF;
  BEGIN
    PERFORM now() AT TIME ZONE v_tz;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'Africa/Cairo';
  END;
  RETURN v_tz;
END;
$$;

-- now(), or the wellness.now setting for test sessions opened directly as
-- postgres (psql / SQL editor). App requests (PostgREST connects as
-- authenticator) always get the real clock.
CREATE OR REPLACE FUNCTION public.clock_now()
RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT CASE WHEN session_user = 'postgres'
                AND nullif(current_setting('wellness.now', true), '') IS NOT NULL
              THEN current_setting('wellness.now', true)::timestamptz
              ELSE now() END;
$$;

-- Wall-clock time in the company's zone (timestamp without time zone).
CREATE OR REPLACE FUNCTION public.company_now(p_company_id UUID)
RETURNS TIMESTAMP
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.clock_now() AT TIME ZONE public.company_tz(p_company_id);
$$;

CREATE OR REPLACE FUNCTION public.company_today(p_company_id UUID)
RETURNS DATE
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.company_now(p_company_id)::date;
$$;

-- Ordinal of a workday (Sun–Thu) so consecutive workdays differ by 1 across
-- the weekend: Thu → Sun is +1.
CREATE OR REPLACE FUNCTION public.wd_ord(p_day DATE)
RETURNS INT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT ((p_day - DATE '2000-01-02') / 7) * 5 + LEAST(EXTRACT(DOW FROM p_day)::int, 4);
$$;

-- Workdays (Sun–Thu) between two dates, inclusive.
CREATE OR REPLACE FUNCTION public.habit_workdays(p_start DATE, p_end DATE)
RETURNS DATE[]
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT COALESCE(array_agg(d::date ORDER BY d), '{}')
    FROM generate_series(p_start, p_end, interval '1 day') d
   WHERE EXTRACT(DOW FROM d) < 5;
$$;

-- Companies created through the free-text "UTC" box (or with no zone) are
-- Egyptian clients: move them to Africa/Cairo. Valid non-UTC zones stay.
-- Drop this statement before running if a company really works in UTC.
UPDATE public.companies
   SET settings = COALESCE(settings, '{}'::jsonb) || '{"timezone": "Africa/Cairo"}'::jsonb
 WHERE COALESCE(btrim(settings ->> 'timezone'), '') IN ('', 'UTC', 'Etc/UTC', 'GMT', 'Etc/GMT')
    OR NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = settings ->> 'timezone');

-- ═══════════════════════════════════════════════════════════════
-- 2. Company settings
-- ═══════════════════════════════════════════════════════════════

-- Small text helper: trimmed value or NULL.
CREATE OR REPLACE FUNCTION public.jtxt(p JSONB, k TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT nullif(btrim(p ->> k), '');
$$;

-- The effective (normalised) settings the app reads.
CREATE OR REPLACE FUNCTION public.company_settings_json(p_company_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'company_id',           c.id,
    'timezone',             public.company_tz(c.id),
    'today',                public.company_today(c.id),
    'now',                  to_char(public.company_now(c.id), 'YYYY-MM-DD"T"HH24:MI:SS'),
    'weekday',              EXTRACT(DOW FROM public.company_today(c.id))::int,
    'workweek',             '[0,1,2,3,4]'::jsonb,
    'recognition',          CASE WHEN c.settings ->> 'recognition' IN ('teams', 'named')
                                 THEN c.settings ->> 'recognition' ELSE 'off' END,
    'weekly_habit_enabled', COALESCE(c.settings ->> 'weekly_habit_enabled', 'true') <> 'false',
    'hr_people_view',       COALESCE(c.settings ->> 'hr_people_view', 'false') = 'true',
    'min_cohort',           public.hr_min_cohort(c.id))
  FROM public.companies c
  WHERE c.id = p_company_id;
$$;

CREATE OR REPLACE FUNCTION public.my_company_settings()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
BEGIN
  IF auth.uid() IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN public.company_settings_json(v_company);
END;
$$;

-- HR: change recognition / weekly_habit_enabled / hr_people_view /
-- timezone / min_cohort. Unknown keys and bad values are refused.
CREATE OR REPLACE FUNCTION public.hr_set_company_settings(p_patch JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_key     TEXT;
  v_val     JSONB;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'invalid_setting' USING ERRCODE = '22023';
  END IF;

  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_patch) LOOP
    IF v_key = 'recognition' THEN
      IF jsonb_typeof(v_val) <> 'string' OR (v_val #>> '{}') NOT IN ('off', 'teams', 'named') THEN
        RAISE EXCEPTION 'invalid_setting' USING ERRCODE = '22023', DETAIL = v_key;
      END IF;
    ELSIF v_key IN ('weekly_habit_enabled', 'hr_people_view') THEN
      IF jsonb_typeof(v_val) <> 'boolean' THEN
        RAISE EXCEPTION 'invalid_setting' USING ERRCODE = '22023', DETAIL = v_key;
      END IF;
    ELSIF v_key = 'timezone' THEN
      IF jsonb_typeof(v_val) <> 'string'
         OR NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = v_val #>> '{}') THEN
        RAISE EXCEPTION 'invalid_setting' USING ERRCODE = '22023', DETAIL = v_key;
      END IF;
    ELSIF v_key = 'min_cohort' THEN
      IF jsonb_typeof(v_val) <> 'number' OR (v_val #>> '{}') !~ '^\d+$'
         OR (v_val #>> '{}')::int NOT BETWEEN 5 AND 1000 THEN
        RAISE EXCEPTION 'invalid_setting' USING ERRCODE = '22023', DETAIL = v_key;
      END IF;
    ELSE
      RAISE EXCEPTION 'unknown_setting' USING ERRCODE = '22023', DETAIL = v_key;
    END IF;
  END LOOP;

  UPDATE public.companies SET settings = COALESCE(settings, '{}'::jsonb) || p_patch
   WHERE id = v_company;

  -- Default weekly habit switched off: remove the app's own bookings that
  -- nobody has logged a day on yet (this week's and any upcoming one).
  IF p_patch -> 'weekly_habit_enabled' = 'false'::jsonb THEN
    DELETE FROM public.challenges d
     WHERE d.company_id = v_company AND d.kind = 'habit'
       AND d.payload ->> 'auto' = 'true'
       AND d.end_date >= public.company_today(v_company)
       AND NOT EXISTS (SELECT 1 FROM public.habit_logs l WHERE l.challenge_id = d.id);
  END IF;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'company.settings_updated',
          'company_settings', v_company, 'info', p_patch);

  RETURN public.company_settings_json(v_company);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Personal preferences and opt-ins
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.profile_prefs (
  user_id               UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  routine_reminders     BOOLEAN NOT NULL DEFAULT false,
  muted_item_ids        UUID[]  NOT NULL DEFAULT '{}',
  recognition_opt_in    BOOLEAN NOT NULL DEFAULT false,
  recognition_opt_in_at TIMESTAMPTZ,
  share_with_hr         BOOLEAN NOT NULL DEFAULT false,
  share_with_hr_at      TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_prefs_own_read ON public.profile_prefs;
CREATE POLICY profile_prefs_own_read ON public.profile_prefs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Writes go through set_my_prefs() only.

CREATE OR REPLACE FUNCTION public.my_prefs()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_out     JSONB;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
           'routine_reminders',     COALESCE(pp.routine_reminders, false),
           'muted_item_ids',        to_jsonb(COALESCE(pp.muted_item_ids, '{}'::uuid[])),
           'recognition_opt_in',    COALESCE(pp.recognition_opt_in, false),
           'recognition_opt_in_at', pp.recognition_opt_in_at,
           'share_with_hr',         COALESCE(pp.share_with_hr, false),
           'share_with_hr_at',      pp.share_with_hr_at,
           'consent_version',       p.consent_version)
    INTO v_out
    FROM public.profiles p
    LEFT JOIN public.profile_prefs pp ON pp.user_id = p.id
   WHERE p.id = v_uid;
  RETURN COALESCE(v_out, '{}'::jsonb) || jsonb_build_object(
    'company', public.company_settings_json(v_company)
               - ARRAY['company_id', 'today', 'now', 'weekday', 'min_cohort']);
END;
$$;

-- Patch keys: routine_reminders, muted_item_ids (uuid[]), recognition_opt_in,
-- share_with_hr. Either opt-in moves profiles.consent_version to v2.
CREATE OR REPLACE FUNCTION public.set_my_prefs(p_patch JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_key   TEXT;
  v_val   JSONB;
  v_muted UUID[];
BEGIN
  IF v_uid IS NULL OR public.auth_company_id() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'invalid_pref' USING ERRCODE = '22023';
  END IF;
  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_patch) LOOP
    IF v_key IN ('routine_reminders', 'recognition_opt_in', 'share_with_hr') THEN
      IF jsonb_typeof(v_val) <> 'boolean' THEN
        RAISE EXCEPTION 'invalid_pref' USING ERRCODE = '22023', DETAIL = v_key;
      END IF;
    ELSIF v_key = 'muted_item_ids' THEN
      IF jsonb_typeof(v_val) <> 'array' OR jsonb_array_length(v_val) > 300 THEN
        RAISE EXCEPTION 'invalid_pref' USING ERRCODE = '22023', DETAIL = v_key;
      END IF;
      v_muted := ARRAY(SELECT DISTINCT x::uuid FROM jsonb_array_elements_text(v_val) x);
    ELSE
      RAISE EXCEPTION 'unknown_pref' USING ERRCODE = '22023', DETAIL = v_key;
    END IF;
  END LOOP;

  INSERT INTO public.profile_prefs (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.profile_prefs pp SET
    routine_reminders = CASE WHEN p_patch ? 'routine_reminders'
                             THEN (p_patch ->> 'routine_reminders')::boolean ELSE pp.routine_reminders END,
    muted_item_ids    = CASE WHEN p_patch ? 'muted_item_ids' THEN v_muted ELSE pp.muted_item_ids END,
    recognition_opt_in_at = CASE WHEN NOT (p_patch ? 'recognition_opt_in') THEN pp.recognition_opt_in_at
                                 WHEN (p_patch ->> 'recognition_opt_in')::boolean
                                 THEN CASE WHEN pp.recognition_opt_in THEN pp.recognition_opt_in_at ELSE now() END
                                 ELSE NULL END,
    recognition_opt_in = CASE WHEN p_patch ? 'recognition_opt_in'
                              THEN (p_patch ->> 'recognition_opt_in')::boolean ELSE pp.recognition_opt_in END,
    share_with_hr_at  = CASE WHEN NOT (p_patch ? 'share_with_hr') THEN pp.share_with_hr_at
                             WHEN (p_patch ->> 'share_with_hr')::boolean
                             THEN CASE WHEN pp.share_with_hr THEN pp.share_with_hr_at ELSE now() END
                             ELSE NULL END,
    share_with_hr     = CASE WHEN p_patch ? 'share_with_hr'
                             THEN (p_patch ->> 'share_with_hr')::boolean ELSE pp.share_with_hr END,
    updated_at        = now()
  WHERE pp.user_id = v_uid;

  IF p_patch -> 'recognition_opt_in' = 'true'::jsonb OR p_patch -> 'share_with_hr' = 'true'::jsonb THEN
    UPDATE public.profiles SET consent_version = 'v2'
     WHERE id = v_uid AND consent_version IS DISTINCT FROM 'v2';
  END IF;
  RETURN public.my_prefs();
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 4. Library scope: public (company_id NULL) vs private (company)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS company_id   UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS media_bucket TEXT,
  ADD COLUMN IF NOT EXISTS media_path   TEXT;
CREATE INDEX IF NOT EXISTS idx_content_items_company
  ON public.content_items (company_id) WHERE company_id IS NOT NULL;

-- 'fact': a one-or-two-line card. 'archived' joins the status list.
ALTER TABLE public.content_items DROP CONSTRAINT IF EXISTS content_items_kind_check;
ALTER TABLE public.content_items ADD CONSTRAINT content_items_kind_check
  CHECK (kind IN ('audio', 'video', 'article', 'breath', 'fact'));
ALTER TABLE public.content_items DROP CONSTRAINT IF EXISTS content_items_status_check;
ALTER TABLE public.content_items ADD CONSTRAINT content_items_status_check
  CHECK (status IN ('draft', 'review', 'published', 'archived'));
ALTER TABLE public.content_items DROP CONSTRAINT IF EXISTS content_items_media_bucket_check;
ALTER TABLE public.content_items ADD CONSTRAINT content_items_media_bucket_check
  CHECK (media_bucket IS NULL OR media_bucket IN ('company-media', 'content-assets'));

ALTER TABLE public.challenge_templates
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_challenge_templates_company
  ON public.challenge_templates (company_id) WHERE company_id IS NOT NULL;

-- A company's choices about public items. Never written on the shared row.
CREATE TABLE IF NOT EXISTS public.company_library_prefs (
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_type  TEXT NOT NULL CHECK (item_type IN ('content', 'exercise', 'routine', 'challenge_template')),
  item_id    UUID NOT NULL,
  hidden     BOOLEAN NOT NULL DEFAULT false,
  pinned     BOOLEAN NOT NULL DEFAULT false,
  sort_order INT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, item_type, item_id)
);

ALTER TABLE public.company_library_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_library_prefs_member_read ON public.company_library_prefs;
CREATE POLICY company_library_prefs_member_read ON public.company_library_prefs
  FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
-- Writes go through hr_set_library_pref() only.

-- True when the caller's company hid this public item. Used by RLS.
CREATE OR REPLACE FUNCTION public.library_hidden(p_item_type TEXT, p_item_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_library_prefs
     WHERE company_id = public.auth_company_id()
       AND item_type = p_item_type AND item_id = p_item_id AND hidden);
$$;

-- content_items: reset the read / write policies to a known set. The live
-- project has had hand-made policies; any of them could keep the
-- cross-company write open, so everything except the Wellness admin and
-- service-role policies is dropped and the read policy is recreated.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename IN ('content_items')
              AND policyname NOT IN ('content_items_wadmin_all', 'service_role_content')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.content_items', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename IN ('challenge_templates')
              AND policyname NOT IN ('challenge_templates_wadmin_all')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.challenge_templates', r.policyname);
  END LOOP;
END $$;

-- Employees: published public items their company didn't hide, and their
-- company's published items. HR / company admins also see hidden public
-- items (to un-hide them) and their own drafts.
CREATE POLICY content_items_read ON public.content_items
  FOR SELECT TO authenticated
  USING (
    (company_id IS NULL AND published
      AND (public.auth_role() IN ('hr_admin', 'company_admin')
           OR NOT public.library_hidden('content', id)))
    OR (company_id IS NOT NULL AND company_id = public.auth_company_id()
        AND (published OR public.auth_role() IN ('hr_admin', 'company_admin')))
  );

CREATE POLICY challenge_templates_read ON public.challenge_templates
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.auth_company_id());

-- ═══════════════════════════════════════════════════════════════
-- 5. Exercises and routines
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.exercise_body_areas()
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT ARRAY['neck', 'shoulders', 'upper_back', 'lower_back', 'chest', 'arms', 'wrists',
               'core', 'hips', 'legs', 'eyes', 'breathing', 'full_body']::text[];
$$;

CREATE TABLE IF NOT EXISTS public.exercises (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name_en              TEXT NOT NULL CHECK (length(btrim(name_en)) BETWEEN 1 AND 120),
  name_ar              TEXT CHECK (name_ar IS NULL OR length(name_ar) <= 120),
  how_en               TEXT CHECK (how_en IS NULL OR length(how_en) <= 500),
  how_ar               TEXT CHECK (how_ar IS NULL OR length(how_ar) <= 500),
  helps_en             TEXT CHECK (helps_en IS NULL OR length(helps_en) <= 300),
  helps_ar             TEXT CHECK (helps_ar IS NULL OR length(helps_ar) <= 300),
  body_areas           TEXT[] NOT NULL DEFAULT '{}' CHECK (body_areas <@ ARRAY[
                         'neck', 'shoulders', 'upper_back', 'lower_back', 'chest', 'arms', 'wrists',
                         'core', 'hips', 'legs', 'eyes', 'breathing', 'full_body']::text[]),
  default_sets_reps    TEXT CHECK (default_sets_reps IS NULL OR length(default_sets_reps) <= 60),
  default_sets_reps_ar TEXT CHECK (default_sets_reps_ar IS NULL OR length(default_sets_reps_ar) <= 60),
  media_type           TEXT CHECK (media_type IN ('video', 'image', 'youtube')),
  media_bucket         TEXT CHECK (media_bucket IN ('company-media', 'content-assets')),
  media_path           TEXT,
  media_mime           TEXT,
  media_youtube_id     TEXT CHECK (media_youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  poster_path          TEXT,
  status               TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  copied_from          UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
  created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exercises_company ON public.exercises (company_id);
CREATE INDEX IF NOT EXISTS idx_exercises_name ON public.exercises (lower(name_en));

-- A named schedule. day_titles: {"0": {"en": "Upper body", "ar": "…"}, …}
-- keyed by weekday (0 = Sunday), shown as "Today's focus".
CREATE TABLE IF NOT EXISTS public.routines (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  title_en           TEXT NOT NULL CHECK (length(btrim(title_en)) BETWEEN 1 AND 120),
  title_ar           TEXT CHECK (title_ar IS NULL OR length(title_ar) <= 120),
  note_en            TEXT CHECK (note_en IS NULL OR length(note_en) <= 1000),
  note_ar            TEXT CHECK (note_ar IS NULL OR length(note_ar) <= 1000),
  day_titles         JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(day_titles) = 'object'),
  workdays           SMALLINT[] NOT NULL DEFAULT '{0,1,2,3,4}'
                     CHECK (cardinality(workdays) BETWEEN 1 AND 7 AND workdays <@ '{0,1,2,3,4,5,6}'::smallint[]),
  source_file_bucket TEXT CHECK (source_file_bucket IN ('company-media', 'content-assets')),
  source_file_path   TEXT,
  source_file_mime   TEXT,
  status             TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  copied_from        UUID REFERENCES public.routines(id) ON DELETE SET NULL,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_routines_company ON public.routines (company_id);

-- One row of the coach's table. weekday NULL = every workday of the routine
-- (desk routine); weekday set = that day only (weekly split). at_time NULL
-- = any time today. sets_reps is free text shown as typed ("2 × 8–10").
CREATE TABLE IF NOT EXISTS public.routine_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id   UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  exercise_id  UUID REFERENCES public.exercises(id) ON DELETE RESTRICT,
  title_en     TEXT CHECK (title_en IS NULL OR length(title_en) <= 120),
  title_ar     TEXT CHECK (title_ar IS NULL OR length(title_ar) <= 120),
  weekday      SMALLINT CHECK (weekday BETWEEN 0 AND 6),
  at_time      TIME,
  sets_reps    TEXT CHECK (sets_reps IS NULL OR length(sets_reps) <= 60),
  sets_reps_ar TEXT CHECK (sets_reps_ar IS NULL OR length(sets_reps_ar) <= 60),
  note_en      TEXT CHECK (note_en IS NULL OR length(note_en) <= 300),
  note_ar      TEXT CHECK (note_ar IS NULL OR length(note_ar) <= 300),
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT routine_items_has_title CHECK (exercise_id IS NOT NULL OR nullif(btrim(title_en), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_routine_items_routine ON public.routine_items (routine_id);

-- Who gets which routine, when. team_id NULL = everyone in the company.
CREATE TABLE IF NOT EXISTS public.routine_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  team_id    UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  starts_on  DATE NOT NULL,
  ends_on    DATE,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT routine_assignments_dates CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS idx_routine_assignments_company ON public.routine_assignments (company_id, active);

-- The tick. check_date is the company-local date. A deleted item keeps its
-- old checks (item_id → NULL, title copied) so history doesn't change.
CREATE TABLE IF NOT EXISTS public.routine_checks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  routine_id    UUID REFERENCES public.routines(id) ON DELETE SET NULL,
  item_id       UUID REFERENCES public.routine_items(id) ON DELETE SET NULL,
  exercise_id   UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
  item_title    TEXT,
  item_title_ar TEXT,
  check_date    DATE NOT NULL,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT routine_checks_once UNIQUE (user_id, item_id, check_date)
);
CREATE INDEX IF NOT EXISTS idx_routine_checks_company_date ON public.routine_checks (company_id, check_date);
CREATE INDEX IF NOT EXISTS idx_routine_checks_user_date ON public.routine_checks (user_id, check_date);

-- Per person per day: items ticked, items due, everything done. Kept up to
-- date by check_routine_item(); read by score, streaks and reports.
CREATE TABLE IF NOT EXISTS public.routine_days (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  checked    INT NOT NULL DEFAULT 0,
  due        INT NOT NULL DEFAULT 0,
  all_done   BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS idx_routine_days_company_day ON public.routine_days (company_id, day);

-- A routine item may use a public exercise or one of its own company's.
CREATE OR REPLACE FUNCTION public.routine_items_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  v_routine_company UUID;
  v_ex_company      UUID;
BEGIN
  IF NEW.exercise_id IS NOT NULL THEN
    SELECT company_id INTO v_routine_company FROM public.routines WHERE id = NEW.routine_id;
    SELECT company_id INTO v_ex_company FROM public.exercises WHERE id = NEW.exercise_id;
    IF v_ex_company IS NOT NULL AND v_ex_company IS DISTINCT FROM v_routine_company THEN
      RAISE EXCEPTION 'exercise_not_in_company' USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_routine_items_guard ON public.routine_items;
CREATE TRIGGER trg_routine_items_guard
  BEFORE INSERT OR UPDATE ON public.routine_items
  FOR EACH ROW EXECUTE FUNCTION public.routine_items_guard();

-- An assignment's routine and team belong to the assignment's company.
CREATE OR REPLACE FUNCTION public.routine_assignments_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.routines WHERE id = NEW.routine_id AND company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'routine_not_in_company' USING ERRCODE = '42501';
  END IF;
  IF NEW.team_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.teams WHERE id = NEW.team_id AND company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'team_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_routine_assignments_guard ON public.routine_assignments;
CREATE TRIGGER trg_routine_assignments_guard
  BEFORE INSERT OR UPDATE ON public.routine_assignments
  FOR EACH ROW EXECUTE FUNCTION public.routine_assignments_guard();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.exercises           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_checks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_days        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exercises_read ON public.exercises;
CREATE POLICY exercises_read ON public.exercises
  FOR SELECT TO authenticated
  USING (
    (company_id IS NULL AND status = 'published')
    OR (company_id = public.auth_company_id()
        AND (status = 'published' OR public.auth_role() IN ('hr_admin', 'company_admin')))
  );
DROP POLICY IF EXISTS exercises_wadmin_all ON public.exercises;
CREATE POLICY exercises_wadmin_all ON public.exercises
  FOR ALL USING (public.is_wellness_admin()) WITH CHECK (public.is_wellness_admin());

DROP POLICY IF EXISTS routines_read ON public.routines;
CREATE POLICY routines_read ON public.routines
  FOR SELECT TO authenticated
  USING (
    (company_id IS NULL AND status = 'published')
    OR (company_id = public.auth_company_id()
        AND (status = 'published' OR public.auth_role() IN ('hr_admin', 'company_admin')))
  );
DROP POLICY IF EXISTS routines_wadmin_all ON public.routines;
CREATE POLICY routines_wadmin_all ON public.routines
  FOR ALL USING (public.is_wellness_admin()) WITH CHECK (public.is_wellness_admin());

-- Items follow their routine (the routines policy applies inside EXISTS).
DROP POLICY IF EXISTS routine_items_read ON public.routine_items;
CREATE POLICY routine_items_read ON public.routine_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routines r WHERE r.id = routine_items.routine_id));
DROP POLICY IF EXISTS routine_items_wadmin_all ON public.routine_items;
CREATE POLICY routine_items_wadmin_all ON public.routine_items
  FOR ALL USING (public.is_wellness_admin()) WITH CHECK (public.is_wellness_admin());

DROP POLICY IF EXISTS routine_assignments_hr_read ON public.routine_assignments;
CREATE POLICY routine_assignments_hr_read ON public.routine_assignments
  FOR SELECT TO authenticated
  USING (company_id = public.auth_company_id()
         AND public.auth_role() IN ('hr_admin', 'company_admin', 'manager'));

DROP POLICY IF EXISTS routine_checks_own_read ON public.routine_checks;
CREATE POLICY routine_checks_own_read ON public.routine_checks
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS routine_days_own_read ON public.routine_days;
CREATE POLICY routine_days_own_read ON public.routine_days
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Writes to these go through the RPCs below only.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.routine_checks, public.routine_days,
  public.routine_assignments, public.profile_prefs, public.company_library_prefs
  FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6. Storage: private per-company media
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-media', 'company-media', false, 50 * 1024 * 1024,
        ARRAY['video/mp4', 'video/quicktime', 'image/png', 'image/jpeg', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public             = false,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Paths are {company_id}/{exercises|routines|content|challenges}/{file}.
DROP POLICY IF EXISTS company_media_member_read ON storage.objects;
CREATE POLICY company_media_member_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'company-media'
         AND (storage.foldername(name))[1] = public.auth_company_id()::text);

DROP POLICY IF EXISTS company_media_hr_insert ON storage.objects;
CREATE POLICY company_media_hr_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-media'
              AND (storage.foldername(name))[1] = public.auth_company_id()::text
              AND public.auth_role() IN ('hr_admin', 'company_admin'));

DROP POLICY IF EXISTS company_media_hr_update ON storage.objects;
CREATE POLICY company_media_hr_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company-media'
         AND (storage.foldername(name))[1] = public.auth_company_id()::text
         AND public.auth_role() IN ('hr_admin', 'company_admin'))
  WITH CHECK (bucket_id = 'company-media'
              AND (storage.foldername(name))[1] = public.auth_company_id()::text
              AND public.auth_role() IN ('hr_admin', 'company_admin'));

DROP POLICY IF EXISTS company_media_hr_delete ON storage.objects;
CREATE POLICY company_media_hr_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company-media'
         AND (storage.foldername(name))[1] = public.auth_company_id()::text
         AND public.auth_role() IN ('hr_admin', 'company_admin'));

-- ═══════════════════════════════════════════════════════════════
-- 7. Routine engine (internal)
-- ═══════════════════════════════════════════════════════════════

-- Active assignments for one group on one day. A team's own assignments
-- win: when any is active for the team, the company-wide ones don't apply
-- to that team. Same routine twice counts once.
CREATE OR REPLACE FUNCTION public.routine_assignments_for(p_company_id UUID, p_team_id UUID, p_day DATE)
RETURNS TABLE (assignment_id UUID, routine_id UUID, team_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH a AS (
    SELECT ra.id, ra.routine_id, ra.team_id, ra.created_at
      FROM public.routine_assignments ra
      JOIN public.routines r ON r.id = ra.routine_id AND r.status = 'published'
     WHERE ra.company_id = p_company_id AND ra.active
       AND ra.starts_on <= p_day AND (ra.ends_on IS NULL OR ra.ends_on >= p_day)
       AND (ra.team_id IS NULL OR ra.team_id = p_team_id)
  ), pick AS (
    SELECT a.* FROM a
     WHERE (a.team_id IS NOT NULL) = EXISTS (SELECT 1 FROM a x WHERE x.team_id IS NOT NULL)
  )
  SELECT DISTINCT ON (pick.routine_id) pick.id, pick.routine_id, pick.team_id
    FROM pick
   ORDER BY pick.routine_id, pick.created_at;
$$;

-- Items due for one group on one day: the routine runs that weekday, the
-- item is for every workday or that weekday, and it existed by the end of
-- that day (items added later don't rewrite history).
CREATE OR REPLACE FUNCTION public.routine_due_items(p_company_id UUID, p_team_id UUID, p_day DATE)
RETURNS TABLE (item_id UUID, routine_id UUID, assignment_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.routine_id, a.assignment_id
    FROM public.routine_assignments_for(p_company_id, p_team_id, p_day) a
    JOIN public.routines r ON r.id = a.routine_id
    JOIN public.routine_items i ON i.routine_id = r.id
   WHERE EXTRACT(DOW FROM p_day)::smallint = ANY (r.workdays)
     AND (i.weekday IS NULL OR i.weekday = EXTRACT(DOW FROM p_day)::int)
     AND i.created_at < (SELECT (p_day + 1)::timestamp AT TIME ZONE public.company_tz(p_company_id));
$$;

-- Recount one person's day after a tick / untick.
CREATE OR REPLACE FUNCTION public.refresh_routine_day(p_user_id UUID, p_day DATE)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company  UUID;
  v_team     UUID;
  v_checked  INT;
  v_due      INT;
  v_due_done INT;
BEGIN
  SELECT company_id, team_id INTO v_company, v_team FROM public.profiles WHERE id = p_user_id;
  IF v_company IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_checked FROM public.routine_checks
   WHERE user_id = p_user_id AND check_date = p_day;
  IF v_checked = 0 THEN
    DELETE FROM public.routine_days WHERE user_id = p_user_id AND day = p_day;
    RETURN;
  END IF;
  SELECT count(*), count(c.id) INTO v_due, v_due_done
    FROM public.routine_due_items(v_company, v_team, p_day) d
    LEFT JOIN public.routine_checks c
      ON c.item_id = d.item_id AND c.user_id = p_user_id AND c.check_date = p_day;
  INSERT INTO public.routine_days (user_id, company_id, day, checked, due, all_done, updated_at)
  VALUES (p_user_id, v_company, p_day, v_checked, v_due, v_due > 0 AND v_due_done >= v_due, now())
  ON CONFLICT (user_id, day) DO UPDATE SET
    company_id = EXCLUDED.company_id, checked = EXCLUDED.checked, due = EXCLUDED.due,
    all_done = EXCLUDED.all_done, updated_at = now();
END;
$$;

-- Streaks: workdays in a row (Sun–Thu) with at least one tick. Fri / Sat
-- never break a streak, and today doesn't break it until the day is over.
-- best = longest run ever.
CREATE OR REPLACE FUNCTION public.routine_streaks(p_company_id UUID, p_today DATE, p_user_id UUID DEFAULT NULL)
RETURNS TABLE (user_id UUID, streak INT, best INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH anchor AS (
    SELECT public.wd_ord(CASE EXTRACT(DOW FROM p_today)::int
                           WHEN 5 THEN p_today - 1 WHEN 6 THEN p_today - 2 ELSE p_today END)
           - CASE WHEN EXTRACT(DOW FROM p_today)::int < 5 THEN 1 ELSE 0 END AS min_last
  ), t AS (
    SELECT d.user_id, public.wd_ord(d.day) AS o
      FROM public.routine_days d
     WHERE d.company_id = p_company_id AND d.checked > 0 AND d.day <= p_today
       AND EXTRACT(DOW FROM d.day)::int < 5
       AND (p_user_id IS NULL OR d.user_id = p_user_id)
  ), g AS (
    SELECT t.user_id, t.o, t.o - row_number() OVER (PARTITION BY t.user_id ORDER BY t.o) AS grp FROM t
  ), isl AS (
    SELECT g.user_id, max(g.o) AS last_o, count(*)::int AS len FROM g GROUP BY g.user_id, g.grp
  )
  SELECT isl.user_id,
         COALESCE(max(isl.len) FILTER (WHERE isl.last_o >= (SELECT min_last FROM anchor)), 0)::int,
         max(isl.len)::int
    FROM isl
   GROUP BY isl.user_id;
$$;

-- Owner checks for authoring RPCs. NULL owner = public row (Wellness admin).
CREATE OR REPLACE FUNCTION public.assert_library_writer(p_owner UUID)
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_owner IS NULL THEN
    IF NOT public.is_wellness_admin() THEN
      RAISE EXCEPTION 'public_item_read_only' USING ERRCODE = '42501';
    END IF;
  ELSIF p_owner IS DISTINCT FROM public.auth_company_id()
        OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Media references on authored rows. company-media paths must sit in the
-- owner company's folder; public rows can only use the public bucket.
CREATE OR REPLACE FUNCTION public.check_media_path(p_owner UUID, p_bucket TEXT, p_path TEXT)
RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
BEGIN
  IF p_path IS NULL THEN RAISE EXCEPTION 'media_path_required' USING ERRCODE = '22023'; END IF;
  IF p_bucket IS NULL OR p_bucket NOT IN ('company-media', 'content-assets') THEN
    RAISE EXCEPTION 'bad_media_bucket' USING ERRCODE = '22023';
  END IF;
  IF p_path ~ '\.\.' OR p_path ~ '^/' OR length(p_path) > 300 THEN
    RAISE EXCEPTION 'bad_media_path' USING ERRCODE = '22023';
  END IF;
  IF p_bucket = 'company-media' AND (p_owner IS NULL OR split_part(p_path, '/', 1) <> p_owner::text) THEN
    RAISE EXCEPTION 'media_path_outside_company' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_media(p_owner UUID, p_type TEXT, p_bucket TEXT, p_path TEXT,
                                              p_mime TEXT, p_youtube_id TEXT)
RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
BEGIN
  IF p_type IS NULL THEN RETURN; END IF;
  IF p_type = 'youtube' THEN
    IF p_youtube_id IS NULL OR p_youtube_id !~ '^[A-Za-z0-9_-]{11}$' THEN
      RAISE EXCEPTION 'bad_youtube_id' USING ERRCODE = '22023';
    END IF;
    RETURN;
  END IF;
  IF p_type NOT IN ('video', 'image') THEN
    RAISE EXCEPTION 'bad_media_type' USING ERRCODE = '22023';
  END IF;
  PERFORM public.check_media_path(p_owner, p_bucket, p_path);
  IF p_mime IS NOT NULL AND NOT (
       (p_type = 'video' AND p_mime IN ('video/mp4', 'video/quicktime'))
    OR (p_type = 'image' AND p_mime IN ('image/png', 'image/jpeg'))) THEN
    RAISE EXCEPTION 'bad_media_mime' USING ERRCODE = '22023';
  END IF;
END;
$$;

-- Sheet helpers for the routine import.
-- '' / every / daily / كل يوم → NULL (every workday); names / 0–6 → weekday;
-- anything else → -1.
CREATE OR REPLACE FUNCTION public.parse_weekday(p TEXT)
RETURNS SMALLINT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN v IS NULL OR v IN ('', 'every', 'everyday', 'every day', 'all', 'daily', 'workdays',
                            'every workday', 'كل يوم', 'يوميا', 'يومياً', 'كل الأيام', 'كل الايام') THEN NULL
    WHEN v ~ '^[0-6]$' THEN v::smallint
    WHEN v IN ('sun', 'sunday', 'الأحد', 'الاحد', 'احد', 'أحد') THEN 0
    WHEN v IN ('mon', 'monday', 'الاثنين', 'الإثنين', 'الأثنين', 'اثنين', 'إثنين') THEN 1
    WHEN v IN ('tue', 'tues', 'tuesday', 'الثلاثاء', 'الثلاثا', 'ثلاثاء') THEN 2
    WHEN v IN ('wed', 'wednesday', 'الأربعاء', 'الاربعاء', 'أربعاء', 'اربعاء', 'الأربع', 'الاربع') THEN 3
    WHEN v IN ('thu', 'thur', 'thurs', 'thursday', 'الخميس', 'خميس') THEN 4
    WHEN v IN ('fri', 'friday', 'الجمعة', 'الجمعه', 'جمعة') THEN 5
    WHEN v IN ('sat', 'saturday', 'السبت', 'سبت') THEN 6
    ELSE -1 END
  FROM (SELECT lower(btrim(p)) AS v) x;
$$;

-- '9:30', '09:30', '9.30', '9:30 pm', '9:30 م', Arabic-Indic digits → time.
-- NULL when it isn't a clock time.
CREATE OR REPLACE FUNCTION public.parse_clock(p TEXT)
RETURNS TIME
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE
  v TEXT := lower(btrim(translate(COALESCE(p, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789')));
  m TEXT[];
  h INT;
BEGIN
  m := regexp_match(v, '^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|ص|م)?$');
  IF m IS NULL THEN RETURN NULL; END IF;
  h := m[1]::int;
  IF m[3] IN ('pm', 'p.m.', 'م') AND h < 12 THEN h := h + 12; END IF;
  IF m[3] IN ('am', 'a.m.', 'ص') AND h = 12 THEN h := 0; END IF;
  IF h > 23 OR COALESCE(m[2], '00')::int > 59 THEN RETURN NULL; END IF;
  -- A bare number needs am / pm or a minutes part to read as a time.
  IF m[2] IS NULL AND m[3] IS NULL THEN RETURN NULL; END IF;
  RETURN make_time(h, COALESCE(m[2], '00')::int, 0);
END;
$$;

-- A bare 11-character id, or the id inside a YouTube link. NULL otherwise.
CREATE OR REPLACE FUNCTION public.parse_youtube_id(p TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN v ~ '^[A-Za-z0-9_-]{11}$' THEN v
    ELSE (regexp_match(v, '^(?:https?://)?(?:www\.|m\.|music\.)?(?:youtube(?:-nocookie)?\.com/(?:watch\?(?:.*&)?v=|shorts/|embed/)|youtu\.be/)([A-Za-z0-9_-]{11})(?:[?&#/].*)?$'))[1]
  END
  FROM (SELECT btrim(COALESCE(p, '')) AS v) x;
$$;

CREATE OR REPLACE FUNCTION public.slugify_text(p TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT COALESCE(nullif(trim(BOTH '-' FROM left(trim(BOTH '-' FROM
           regexp_replace(lower(COALESCE(p, '')), '[^a-z0-9]+', '-', 'g')), 50)), ''), 'item');
$$;

-- ═══════════════════════════════════════════════════════════════
-- 8. Employee: Today tab, week view, routine detail
-- ═══════════════════════════════════════════════════════════════

-- Today's routine items for the caller, with exercise + media, checked
-- state and progress. See src/lib/supabase-routines.ts (TodayState).
CREATE OR REPLACE FUNCTION public.my_today()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_company   UUID := public.auth_company_id();
  v_team      UUID;
  v_now       TIMESTAMP;
  v_today     DATE;
  v_time      TIME;
  v_reminders BOOLEAN;
  v_muted     UUID[];
  v_items     JSONB;
  v_routines  JSONB;
  v_total     INT;
  v_done      INT;
  v_next      UUID;
  v_streak    INT;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT p.team_id INTO v_team FROM public.profiles p WHERE p.id = v_uid;
  v_now := public.company_now(v_company);
  v_today := v_now::date;
  v_time := v_now::time;
  SELECT pp.routine_reminders, pp.muted_item_ids INTO v_reminders, v_muted
    FROM public.profile_prefs pp WHERE pp.user_id = v_uid;
  v_muted := COALESCE(v_muted, '{}');

  WITH it AS (
    SELECT i.id, i.routine_id, i.at_time, i.weekday, i.sort_order, i.note_en, i.note_ar,
           COALESCE(nullif(btrim(i.title_en), ''), e.name_en) AS title_en,
           COALESCE(nullif(btrim(i.title_ar), ''), e.name_ar, nullif(btrim(i.title_en), ''), e.name_en) AS title_ar,
           COALESCE(i.sets_reps, e.default_sets_reps) AS sets_reps,
           COALESCE(i.sets_reps_ar, e.default_sets_reps_ar, i.sets_reps, e.default_sets_reps) AS sets_reps_ar,
           c.checked_at,
           e.id AS ex_id,
           CASE WHEN e.id IS NULL THEN NULL
                ELSE to_jsonb(e) - ARRAY['created_by', 'copied_from', 'created_at', 'updated_at'] END AS ex
      FROM public.routine_due_items(v_company, v_team, v_today) d
      JOIN public.routine_items i ON i.id = d.item_id
      LEFT JOIN public.exercises e ON e.id = i.exercise_id
      LEFT JOIN public.routine_checks c
        ON c.item_id = i.id AND c.user_id = v_uid AND c.check_date = v_today
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id',           it.id,
           'routine_id',   it.routine_id,
           'at_time',      to_char(it.at_time, 'HH24:MI'),
           'weekday',      it.weekday,
           'title_en',     it.title_en,
           'title_ar',     it.title_ar,
           'sets_reps',    it.sets_reps,
           'sets_reps_ar', it.sets_reps_ar,
           'note_en',      it.note_en,
           'note_ar',      it.note_ar,
           'checked',      it.checked_at IS NOT NULL,
           'checked_at',   it.checked_at,
           'is_past',      it.at_time IS NOT NULL AND it.at_time <= v_time,
           'muted',        it.id = ANY (v_muted),
           'exercise',     it.ex)
         ORDER BY it.at_time NULLS LAST, it.sort_order, it.title_en), '[]'::jsonb),
         count(*)::int,
         count(it.checked_at)::int
    INTO v_items, v_total, v_done
    FROM it;

  -- Next up: the soonest unticked item still ahead, then untimed ones, then
  -- the earliest one already past.
  SELECT i.id INTO v_next
    FROM public.routine_due_items(v_company, v_team, v_today) d
    JOIN public.routine_items i ON i.id = d.item_id
   WHERE NOT EXISTS (SELECT 1 FROM public.routine_checks c
                      WHERE c.item_id = i.id AND c.user_id = v_uid AND c.check_date = v_today)
   ORDER BY CASE WHEN i.at_time >= v_time THEN 0 WHEN i.at_time IS NULL THEN 1 ELSE 2 END,
            i.at_time, i.sort_order
   LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id',                 r.id,
           'title_en',           r.title_en,
           'title_ar',           r.title_ar,
           'note_en',            r.note_en,
           'note_ar',            r.note_ar,
           'day_title',          r.day_titles -> (EXTRACT(DOW FROM v_today)::int)::text,
           'source_file_bucket', r.source_file_bucket,
           'source_file_path',   r.source_file_path,
           'source_file_mime',   r.source_file_mime,
           'assignment_id',      a.assignment_id,
           'team_id',            a.team_id)
         ORDER BY r.title_en), '[]'::jsonb)
    INTO v_routines
    FROM public.routine_assignments_for(v_company, v_team, v_today) a
    JOIN public.routines r ON r.id = a.routine_id;

  SELECT s.streak INTO v_streak FROM public.routine_streaks(v_company, v_today, v_uid) s;

  RETURN jsonb_build_object(
    'date',         v_today,
    'weekday',      EXTRACT(DOW FROM v_today)::int,
    'now',          to_char(v_now, 'HH24:MI'),
    'timezone',     public.company_tz(v_company),
    'is_workday',   EXTRACT(DOW FROM v_today)::int < 5,
    'assigned',     jsonb_array_length(v_routines) > 0,
    'routines',     v_routines,
    'items',        v_items,
    'progress',     jsonb_build_object(
                      'done',     v_done,
                      'total',    v_total,
                      'pct',      CASE WHEN v_total > 0 THEN round(100.0 * v_done / v_total) END,
                      'all_done', v_total > 0 AND v_done >= v_total,
                      'points',   LEAST(20, 2 * v_done)
                                  + CASE WHEN v_total > 0 AND v_done >= v_total THEN 10 ELSE 0 END),
    'next_item_id', v_next,
    'streak',       COALESCE(v_streak, 0),
    'reminders',    jsonb_build_object('enabled', COALESCE(v_reminders, false),
                                       'muted_item_ids', to_jsonb(v_muted))
  );
END;
$$;

-- Tick (or untick) one of today's items. Only the caller's own, only an
-- item due today (company-local), idempotent. Returns my_today().
CREATE OR REPLACE FUNCTION public.check_routine_item(p_item_id UUID, p_checked BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_team    UUID;
  v_today   DATE;
  v_item    public.routine_items%ROWTYPE;
  v_ex      public.exercises%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT p.team_id INTO v_team FROM public.profiles p
   WHERE p.id = v_uid AND p.company_id = v_company AND p.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  v_today := public.company_today(v_company);

  IF NOT EXISTS (SELECT 1 FROM public.routine_due_items(v_company, v_team, v_today) d
                  WHERE d.item_id = p_item_id) THEN
    RAISE EXCEPTION 'item_not_due_today' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(p_checked, true) THEN
    SELECT * INTO v_item FROM public.routine_items WHERE id = p_item_id;
    SELECT * INTO v_ex FROM public.exercises WHERE id = v_item.exercise_id;
    INSERT INTO public.routine_checks (company_id, user_id, routine_id, item_id, exercise_id,
                                       item_title, item_title_ar, check_date, checked_at)
    VALUES (v_company, v_uid, v_item.routine_id, v_item.id, v_item.exercise_id,
            COALESCE(nullif(btrim(v_item.title_en), ''), v_ex.name_en),
            COALESCE(nullif(btrim(v_item.title_ar), ''), v_ex.name_ar),
            v_today, public.clock_now())
    ON CONFLICT (user_id, item_id, check_date) DO NOTHING;
  ELSE
    DELETE FROM public.routine_checks
     WHERE user_id = v_uid AND item_id = p_item_id AND check_date = v_today;
  END IF;

  PERFORM public.refresh_routine_day(v_uid, v_today);
  RETURN public.my_today();
END;
$$;

-- The caller's Sun–Thu week: items per day with ticks, totals, and the
-- routines running (with the original-table file). p_week_start: any date
-- in the week (default: this week).
CREATE OR REPLACE FUNCTION public.my_routine_week(p_week_start DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_company  UUID := public.auth_company_id();
  v_team     UUID;
  v_today    DATE;
  v_week     DATE;
  v_days     JSONB;
  v_routines JSONB;
  v_totals   JSONB;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT p.team_id INTO v_team FROM public.profiles p WHERE p.id = v_uid;
  v_today := public.company_today(v_company);
  v_week := COALESCE(p_week_start, v_today);
  v_week := v_week - EXTRACT(DOW FROM v_week)::int;

  WITH cal AS (
    SELECT (v_week + g)::date AS day FROM generate_series(0, 4) g
  ), due AS (
    SELECT cal.day, d.item_id FROM cal
     CROSS JOIN LATERAL public.routine_due_items(v_company, v_team, cal.day) d
  ), it AS (
    SELECT due.day, i.id, i.routine_id, i.at_time, i.sort_order, i.exercise_id,
           COALESCE(nullif(btrim(i.title_en), ''), e.name_en) AS title_en,
           COALESCE(nullif(btrim(i.title_ar), ''), e.name_ar, nullif(btrim(i.title_en), ''), e.name_en) AS title_ar,
           COALESCE(i.sets_reps, e.default_sets_reps) AS sets_reps,
           COALESCE(i.sets_reps_ar, e.default_sets_reps_ar, i.sets_reps, e.default_sets_reps) AS sets_reps_ar,
           c.id IS NOT NULL AS checked
      FROM due
      JOIN public.routine_items i ON i.id = due.item_id
      LEFT JOIN public.exercises e ON e.id = i.exercise_id
      LEFT JOIN public.routine_checks c
        ON c.item_id = i.id AND c.user_id = v_uid AND c.check_date = due.day
  )
  SELECT jsonb_agg(jsonb_build_object(
           'date',      cal.day,
           'weekday',   EXTRACT(DOW FROM cal.day)::int,
           'is_today',  cal.day = v_today,
           'is_past',   cal.day < v_today,
           'is_future', cal.day > v_today,
           'due',       (SELECT count(*) FROM it WHERE it.day = cal.day),
           'done',      (SELECT count(*) FROM it WHERE it.day = cal.day AND it.checked),
           'all_done',  (SELECT count(*) > 0 AND bool_and(it.checked) FROM it WHERE it.day = cal.day),
           'day_title', (SELECT r.day_titles -> (EXTRACT(DOW FROM cal.day)::int)::text
                           FROM public.routine_assignments_for(v_company, v_team, cal.day) a
                           JOIN public.routines r ON r.id = a.routine_id
                          WHERE r.day_titles ? (EXTRACT(DOW FROM cal.day)::int)::text
                          ORDER BY r.title_en LIMIT 1),
           'items',     (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                  'id',           it.id,
                                  'routine_id',   it.routine_id,
                                  'exercise_id',  it.exercise_id,
                                  'at_time',      to_char(it.at_time, 'HH24:MI'),
                                  'title_en',     it.title_en,
                                  'title_ar',     it.title_ar,
                                  'sets_reps',    it.sets_reps,
                                  'sets_reps_ar', it.sets_reps_ar,
                                  'checked',      it.checked)
                                ORDER BY it.at_time NULLS LAST, it.sort_order, it.title_en), '[]'::jsonb)
                           FROM it WHERE it.day = cal.day))
         ORDER BY cal.day),
         jsonb_build_object(
           'due',           (SELECT count(*) FROM it),
           'done',          (SELECT count(*) FROM it WHERE it.checked),
           'all_done_days', (SELECT count(*) FROM public.routine_days rd
                              WHERE rd.user_id = v_uid AND rd.all_done
                                AND rd.day BETWEEN v_week AND v_week + 4))
    INTO v_days, v_totals
    FROM cal;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'title_en', r.title_en, 'title_ar', r.title_ar,
           'note_en', r.note_en, 'note_ar', r.note_ar, 'day_titles', r.day_titles,
           'source_file_bucket', r.source_file_bucket, 'source_file_path', r.source_file_path,
           'source_file_mime', r.source_file_mime)
         ORDER BY r.title_en), '[]'::jsonb)
    INTO v_routines
    FROM public.routines r
   WHERE r.id IN (SELECT a.routine_id FROM generate_series(0, 4) g
                   CROSS JOIN LATERAL public.routine_assignments_for(v_company, v_team, (v_week + g)::date) a);

  RETURN jsonb_build_object(
    'week_start', v_week,
    'today',      v_today,
    'days',       COALESCE(v_days, '[]'::jsonb),
    'totals',     v_totals,
    'routines',   v_routines);
END;
$$;

-- One routine with its rows (and, for its own HR, its assignments). For the
-- builder, the "Use this" preview and the full-schedule view.
CREATE OR REPLACE FUNCTION public.routine_detail(p_routine_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_hr      BOOLEAN := public.auth_role() IN ('hr_admin', 'company_admin');
  v_wadmin  BOOLEAN := public.is_wellness_admin();
  r         public.routines%ROWTYPE;
  v_items   JSONB;
  v_assign  JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.routines WHERE id = p_routine_id;
  IF r.id IS NULL OR NOT (
       v_wadmin
    OR (r.company_id IS NULL AND r.status = 'published')
    OR (r.company_id = v_company AND (r.status = 'published' OR v_hr))) THEN
    RAISE EXCEPTION 'routine_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(
           to_jsonb(i) || jsonb_build_object(
             'at_time',  to_char(i.at_time, 'HH24:MI'),
             'exercise', CASE WHEN e.id IS NULL THEN NULL
                              ELSE to_jsonb(e) - ARRAY['created_by', 'copied_from'] END)
         ORDER BY i.weekday NULLS FIRST, i.at_time NULLS LAST, i.sort_order), '[]'::jsonb)
    INTO v_items
    FROM public.routine_items i
    LEFT JOIN public.exercises e ON e.id = i.exercise_id
   WHERE i.routine_id = r.id;

  IF v_hr AND r.company_id = v_company THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'id', a.id, 'team_id', a.team_id, 'team_name', t.name,
             'starts_on', a.starts_on, 'ends_on', a.ends_on, 'active', a.active)
           ORDER BY a.starts_on DESC), '[]'::jsonb)
      INTO v_assign
      FROM public.routine_assignments a
      LEFT JOIN public.teams t ON t.id = a.team_id
     WHERE a.routine_id = r.id;
  END IF;

  RETURN jsonb_build_object(
    'routine',     to_jsonb(r) || jsonb_build_object(
                     'scope',    CASE WHEN r.company_id IS NULL THEN 'public' ELSE 'company' END,
                     'can_edit', CASE WHEN r.company_id IS NULL THEN v_wadmin
                                      ELSE v_hr AND r.company_id = v_company END),
    'items',       v_items,
    'assignments', v_assign);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 9. Authoring: exercises, routines, content, HR challenges, library
-- ═══════════════════════════════════════════════════════════════

-- Create or update an exercise. Input keys: id (update), public (Wellness
-- admin only: a public row), name_en, name_ar, how_en, how_ar, helps_en,
-- helps_ar, body_areas[], default_sets_reps, default_sets_reps_ar,
-- media_type (video | image | youtube | null), media_bucket, media_path,
-- media_mime, media_youtube_id, poster_path, status. On update, missing
-- keys keep their value. HR can't touch public rows.
CREATE OR REPLACE FUNCTION public.save_exercise(p_input JSONB)
RETURNS public.exercises
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_id      UUID;
  v_old     public.exercises%ROWTYPE;
  v_row     public.exercises%ROWTYPE;
  v_owner   UUID;
  v_in      JSONB;
  v_areas   TEXT[];
  v_type    TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_id := nullif(p_input ->> 'id', '')::uuid;
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.exercises WHERE id = v_id FOR UPDATE;
    IF v_old.id IS NULL THEN RAISE EXCEPTION 'exercise_not_found' USING ERRCODE = 'P0002'; END IF;
    v_owner := v_old.company_id;
    v_in := (to_jsonb(v_old) - 'id') || p_input;
  ELSE
    IF COALESCE((p_input ->> 'public')::boolean, false) THEN
      v_owner := NULL;
    ELSIF v_company IS NULL THEN
      RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    ELSE
      v_owner := v_company;
    END IF;
    v_in := p_input;
  END IF;
  PERFORM public.assert_library_writer(v_owner);

  IF public.jtxt(v_in, 'name_en') IS NULL THEN
    RAISE EXCEPTION 'name_required' USING ERRCODE = '22023';
  END IF;
  IF v_in ? 'body_areas' AND jsonb_typeof(v_in -> 'body_areas') = 'array' THEN
    v_areas := ARRAY(SELECT DISTINCT lower(btrim(x)) FROM jsonb_array_elements_text(v_in -> 'body_areas') x
                      WHERE btrim(x) <> '');
  ELSIF v_in ? 'body_areas' AND jsonb_typeof(v_in -> 'body_areas') <> 'null' THEN
    RAISE EXCEPTION 'bad_body_area' USING ERRCODE = '22023';
  END IF;
  v_areas := COALESCE(v_areas, '{}');
  IF NOT v_areas <@ public.exercise_body_areas() THEN
    RAISE EXCEPTION 'bad_body_area' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(public.jtxt(v_in, 'status'), 'published') NOT IN ('draft', 'published', 'archived') THEN
    RAISE EXCEPTION 'bad_status' USING ERRCODE = '22023';
  END IF;

  v_type := public.jtxt(v_in, 'media_type');
  PERFORM public.check_media(v_owner, v_type, public.jtxt(v_in, 'media_bucket'),
                             public.jtxt(v_in, 'media_path'), public.jtxt(v_in, 'media_mime'),
                             public.jtxt(v_in, 'media_youtube_id'));
  IF v_type IN ('video', 'image') AND public.jtxt(v_in, 'poster_path') IS NOT NULL THEN
    PERFORM public.check_media_path(v_owner, public.jtxt(v_in, 'media_bucket'), public.jtxt(v_in, 'poster_path'));
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.exercises (
      company_id, name_en, name_ar, how_en, how_ar, helps_en, helps_ar, body_areas,
      default_sets_reps, default_sets_reps_ar,
      media_type, media_bucket, media_path, media_mime, media_youtube_id, poster_path,
      status, created_by)
    VALUES (
      v_owner, public.jtxt(v_in, 'name_en'), public.jtxt(v_in, 'name_ar'),
      public.jtxt(v_in, 'how_en'), public.jtxt(v_in, 'how_ar'),
      public.jtxt(v_in, 'helps_en'), public.jtxt(v_in, 'helps_ar'), v_areas,
      public.jtxt(v_in, 'default_sets_reps'), public.jtxt(v_in, 'default_sets_reps_ar'),
      v_type,
      CASE WHEN v_type IN ('video', 'image') THEN public.jtxt(v_in, 'media_bucket') END,
      CASE WHEN v_type IN ('video', 'image') THEN public.jtxt(v_in, 'media_path') END,
      CASE WHEN v_type IN ('video', 'image') THEN public.jtxt(v_in, 'media_mime') END,
      CASE WHEN v_type = 'youtube' THEN public.jtxt(v_in, 'media_youtube_id') END,
      CASE WHEN v_type IN ('video', 'image') THEN public.jtxt(v_in, 'poster_path') END,
      COALESCE(public.jtxt(v_in, 'status'), 'published'), auth.uid())
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.exercises SET
      name_en = public.jtxt(v_in, 'name_en'), name_ar = public.jtxt(v_in, 'name_ar'),
      how_en = public.jtxt(v_in, 'how_en'), how_ar = public.jtxt(v_in, 'how_ar'),
      helps_en = public.jtxt(v_in, 'helps_en'), helps_ar = public.jtxt(v_in, 'helps_ar'),
      body_areas = v_areas,
      default_sets_reps = public.jtxt(v_in, 'default_sets_reps'),
      default_sets_reps_ar = public.jtxt(v_in, 'default_sets_reps_ar'),
      media_type = v_type,
      media_bucket = CASE WHEN v_type IN ('video', 'image') THEN public.jtxt(v_in, 'media_bucket') END,
      media_path = CASE WHEN v_type IN ('video', 'image') THEN public.jtxt(v_in, 'media_path') END,
      media_mime = CASE WHEN v_type IN ('video', 'image') THEN public.jtxt(v_in, 'media_mime') END,
      media_youtube_id = CASE WHEN v_type = 'youtube' THEN public.jtxt(v_in, 'media_youtube_id') END,
      poster_path = CASE WHEN v_type IN ('video', 'image') THEN public.jtxt(v_in, 'poster_path') END,
      status = COALESCE(public.jtxt(v_in, 'status'), 'published'),
      updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END;
$$;

-- Create or update a routine, and (when "items" is given) replace its rows:
-- rows with an id are updated in place (their ticks stay), rows without an
-- id are added, missing rows are removed (old ticks keep their copied
-- title). Input keys: id, public (Wellness admin), title_en, title_ar,
-- note_en, note_ar, day_titles {"0":{"en","ar"}…}, workdays [0..6],
-- source_file_bucket, source_file_path, source_file_mime, status,
-- items [{id, exercise_id, title_en, title_ar, weekday (null = every
-- workday), at_time 'HH:MM', sets_reps, sets_reps_ar, note_en, note_ar,
-- sort_order}]. Returns routine_detail().
CREATE OR REPLACE FUNCTION public.save_routine(p_input JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company  UUID := public.auth_company_id();
  v_id       UUID;
  v_old      public.routines%ROWTYPE;
  v_row      public.routines%ROWTYPE;
  v_owner    UUID;
  v_in       JSONB;
  v_workdays SMALLINT[];
  v_titles   JSONB := '{}'::jsonb;
  v_k        TEXT;
  v_v        JSONB;
  v_it       JSONB;
  v_item_id  UUID;
  v_ex       UUID;
  v_wd       SMALLINT;
  v_at       TIME;
  v_keep     UUID[] := '{}';
  v_n        INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_id := nullif(p_input ->> 'id', '')::uuid;
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.routines WHERE id = v_id FOR UPDATE;
    IF v_old.id IS NULL THEN RAISE EXCEPTION 'routine_not_found' USING ERRCODE = 'P0002'; END IF;
    v_owner := v_old.company_id;
    v_in := (to_jsonb(v_old) - 'id') || (p_input - 'items');
  ELSE
    IF COALESCE((p_input ->> 'public')::boolean, false) THEN
      v_owner := NULL;
    ELSIF v_company IS NULL THEN
      RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    ELSE
      v_owner := v_company;
    END IF;
    v_in := p_input - 'items';
  END IF;
  PERFORM public.assert_library_writer(v_owner);

  IF public.jtxt(v_in, 'title_en') IS NULL THEN
    RAISE EXCEPTION 'title_required' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(public.jtxt(v_in, 'status'), 'published') NOT IN ('draft', 'published', 'archived') THEN
    RAISE EXCEPTION 'bad_status' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_in -> 'workdays') = 'array' THEN
    BEGIN
      v_workdays := ARRAY(SELECT DISTINCT x::smallint FROM jsonb_array_elements_text(v_in -> 'workdays') x ORDER BY 1);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'bad_workdays' USING ERRCODE = '22023';
    END;
    IF cardinality(v_workdays) = 0 OR NOT v_workdays <@ '{0,1,2,3,4,5,6}'::smallint[] THEN
      RAISE EXCEPTION 'bad_workdays' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_workdays := '{0,1,2,3,4}';
  END IF;

  IF jsonb_typeof(v_in -> 'day_titles') = 'object' THEN
    FOR v_k, v_v IN SELECT key, value FROM jsonb_each(v_in -> 'day_titles') LOOP
      IF v_k !~ '^[0-6]$' OR jsonb_typeof(v_v) <> 'object' THEN
        RAISE EXCEPTION 'bad_day_titles' USING ERRCODE = '22023';
      END IF;
      IF public.jtxt(v_v, 'en') IS NOT NULL OR public.jtxt(v_v, 'ar') IS NOT NULL THEN
        IF length(COALESCE(v_v ->> 'en', '')) > 60 OR length(COALESCE(v_v ->> 'ar', '')) > 60 THEN
          RAISE EXCEPTION 'bad_day_titles' USING ERRCODE = '22023';
        END IF;
        v_titles := v_titles || jsonb_build_object(v_k, jsonb_strip_nulls(jsonb_build_object(
                      'en', public.jtxt(v_v, 'en'), 'ar', public.jtxt(v_v, 'ar'))));
      END IF;
    END LOOP;
  END IF;

  IF public.jtxt(v_in, 'source_file_path') IS NOT NULL THEN
    PERFORM public.check_media_path(v_owner, public.jtxt(v_in, 'source_file_bucket'),
                                    public.jtxt(v_in, 'source_file_path'));
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.routines (company_id, title_en, title_ar, note_en, note_ar, day_titles, workdays,
                                 source_file_bucket, source_file_path, source_file_mime, status, created_by)
    VALUES (v_owner, public.jtxt(v_in, 'title_en'), public.jtxt(v_in, 'title_ar'),
            public.jtxt(v_in, 'note_en'), public.jtxt(v_in, 'note_ar'), v_titles, v_workdays,
            CASE WHEN public.jtxt(v_in, 'source_file_path') IS NOT NULL THEN public.jtxt(v_in, 'source_file_bucket') END,
            public.jtxt(v_in, 'source_file_path'),
            CASE WHEN public.jtxt(v_in, 'source_file_path') IS NOT NULL THEN public.jtxt(v_in, 'source_file_mime') END,
            COALESCE(public.jtxt(v_in, 'status'), 'published'), auth.uid())
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.routines SET
      title_en = public.jtxt(v_in, 'title_en'), title_ar = public.jtxt(v_in, 'title_ar'),
      note_en = public.jtxt(v_in, 'note_en'), note_ar = public.jtxt(v_in, 'note_ar'),
      day_titles = v_titles, workdays = v_workdays,
      source_file_bucket = CASE WHEN public.jtxt(v_in, 'source_file_path') IS NOT NULL
                                THEN public.jtxt(v_in, 'source_file_bucket') END,
      source_file_path = public.jtxt(v_in, 'source_file_path'),
      source_file_mime = CASE WHEN public.jtxt(v_in, 'source_file_path') IS NOT NULL
                              THEN public.jtxt(v_in, 'source_file_mime') END,
      status = COALESCE(public.jtxt(v_in, 'status'), 'published'),
      updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  IF p_input ? 'items' THEN
    IF jsonb_typeof(p_input -> 'items') <> 'array' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023', DETAIL = 'items';
    END IF;
    IF jsonb_array_length(p_input -> 'items') > 100 THEN
      RAISE EXCEPTION 'too_many_items' USING ERRCODE = '22023';
    END IF;
    FOR v_it IN SELECT value FROM jsonb_array_elements(p_input -> 'items') LOOP
      v_n := v_n + 1;
      v_item_id := nullif(v_it ->> 'id', '')::uuid;
      v_ex := nullif(v_it ->> 'exercise_id', '')::uuid;
      v_wd := CASE WHEN public.jtxt(v_it, 'weekday') IS NULL THEN NULL ELSE (v_it ->> 'weekday')::smallint END;
      v_at := CASE WHEN public.jtxt(v_it, 'at_time') IS NULL THEN NULL ELSE (v_it ->> 'at_time')::time END;
      IF v_wd IS NOT NULL AND NOT (v_wd = ANY (v_workdays)) THEN
        RAISE EXCEPTION 'weekday_not_workday' USING ERRCODE = '22023', DETAIL = v_n::text;
      END IF;
      IF v_ex IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM public.exercises e
            WHERE e.id = v_ex AND (e.company_id IS NULL OR e.company_id = v_owner)) THEN
        RAISE EXCEPTION 'exercise_not_found' USING ERRCODE = 'P0002', DETAIL = v_n::text;
      END IF;
      IF v_ex IS NULL AND public.jtxt(v_it, 'title_en') IS NULL THEN
        RAISE EXCEPTION 'item_title_required' USING ERRCODE = '22023', DETAIL = v_n::text;
      END IF;
      IF v_item_id IS NOT NULL THEN
        UPDATE public.routine_items SET
          exercise_id = v_ex, title_en = public.jtxt(v_it, 'title_en'), title_ar = public.jtxt(v_it, 'title_ar'),
          weekday = v_wd, at_time = v_at,
          sets_reps = public.jtxt(v_it, 'sets_reps'), sets_reps_ar = public.jtxt(v_it, 'sets_reps_ar'),
          note_en = public.jtxt(v_it, 'note_en'), note_ar = public.jtxt(v_it, 'note_ar'),
          sort_order = COALESCE(nullif(v_it ->> 'sort_order', '')::int, v_n)
        WHERE id = v_item_id AND routine_id = v_row.id;
        IF NOT FOUND THEN RAISE EXCEPTION 'item_not_found' USING ERRCODE = 'P0002', DETAIL = v_n::text; END IF;
      ELSE
        INSERT INTO public.routine_items (routine_id, exercise_id, title_en, title_ar, weekday, at_time,
                                          sets_reps, sets_reps_ar, note_en, note_ar, sort_order)
        VALUES (v_row.id, v_ex, public.jtxt(v_it, 'title_en'), public.jtxt(v_it, 'title_ar'), v_wd, v_at,
                public.jtxt(v_it, 'sets_reps'), public.jtxt(v_it, 'sets_reps_ar'),
                public.jtxt(v_it, 'note_en'), public.jtxt(v_it, 'note_ar'),
                COALESCE(nullif(v_it ->> 'sort_order', '')::int, v_n))
        RETURNING id INTO v_item_id;
      END IF;
      v_keep := v_keep || v_item_id;
    END LOOP;
    DELETE FROM public.routine_items WHERE routine_id = v_row.id AND NOT (id = ANY (v_keep));
  END IF;

  RETURN public.routine_detail(v_row.id);
END;
$$;

-- Create or update an article or a fact. Input keys: id, public (Wellness
-- admin), kind ('article' | 'fact'), title_en, title_ar, description_en,
-- description_ar, body_en, body_ar (a fact: up to 300 characters), category,
-- duration_mins, media_bucket + media_path (cover image), status
-- ('draft' | 'published').
CREATE OR REPLACE FUNCTION public.save_content_item(p_input JSONB)
RETURNS public.content_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_id      UUID;
  v_old     public.content_items%ROWTYPE;
  v_row     public.content_items%ROWTYPE;
  v_owner   UUID;
  v_in      JSONB;
  v_kind    TEXT;
  v_status  TEXT;
  v_cat     TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_id := nullif(p_input ->> 'id', '')::uuid;
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.content_items WHERE id = v_id FOR UPDATE;
    IF v_old.id IS NULL THEN RAISE EXCEPTION 'content_not_found' USING ERRCODE = 'P0002'; END IF;
    v_owner := v_old.company_id;
    v_in := (to_jsonb(v_old) - 'id') || p_input;
  ELSE
    IF COALESCE((p_input ->> 'public')::boolean, false) THEN
      v_owner := NULL;
    ELSIF v_company IS NULL THEN
      RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    ELSE
      v_owner := v_company;
    END IF;
    v_in := p_input;
  END IF;
  PERFORM public.assert_library_writer(v_owner);

  v_kind := COALESCE(public.jtxt(v_in, 'kind'), 'article');
  IF v_kind NOT IN ('article', 'fact') THEN RAISE EXCEPTION 'bad_kind' USING ERRCODE = '22023'; END IF;
  IF public.jtxt(v_in, 'title_en') IS NULL THEN RAISE EXCEPTION 'title_required' USING ERRCODE = '22023'; END IF;
  IF length(public.jtxt(v_in, 'title_en')) > 160 OR length(COALESCE(public.jtxt(v_in, 'title_ar'), '')) > 160 THEN
    RAISE EXCEPTION 'title_too_long' USING ERRCODE = '22023';
  END IF;
  IF public.jtxt(v_in, 'body_en') IS NULL AND public.jtxt(v_in, 'body_ar') IS NULL THEN
    RAISE EXCEPTION 'body_required' USING ERRCODE = '22023';
  END IF;
  IF v_kind = 'fact' AND (length(COALESCE(v_in ->> 'body_en', '')) > 300 OR length(COALESCE(v_in ->> 'body_ar', '')) > 300) THEN
    RAISE EXCEPTION 'fact_too_long' USING ERRCODE = '22023';
  END IF;
  IF length(COALESCE(v_in ->> 'body_en', '')) > 30000 OR length(COALESCE(v_in ->> 'body_ar', '')) > 30000 THEN
    RAISE EXCEPTION 'body_too_long' USING ERRCODE = '22023';
  END IF;
  v_status := COALESCE(public.jtxt(v_in, 'status'), 'draft');
  IF v_status NOT IN ('draft', 'published', 'archived') THEN RAISE EXCEPTION 'bad_status' USING ERRCODE = '22023'; END IF;
  v_cat := COALESCE(public.jtxt(v_in, 'category'), 'general');
  IF v_cat NOT IN ('sleep', 'stress', 'energy', 'movement', 'mindfulness', 'nutrition', 'general') THEN
    RAISE EXCEPTION 'bad_category' USING ERRCODE = '22023';
  END IF;
  IF public.jtxt(v_in, 'media_path') IS NOT NULL THEN
    PERFORM public.check_media_path(v_owner, public.jtxt(v_in, 'media_bucket'), public.jtxt(v_in, 'media_path'));
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.content_items (
      slug, kind, title_en, title_ar, description_en, description_ar, body_en, body_ar,
      duration_mins, category, published, status, sort_order, featured, locale,
      company_id, created_by, media_bucket, media_path)
    VALUES (
      CASE WHEN v_owner IS NULL THEN '' ELSE 'co-' || left(replace(v_owner::text, '-', ''), 8) || '-' END
        || public.slugify_text(public.jtxt(v_in, 'title_en')) || '-' || substr(md5(gen_random_uuid()::text), 1, 6),
      v_kind, public.jtxt(v_in, 'title_en'), public.jtxt(v_in, 'title_ar'),
      public.jtxt(v_in, 'description_en'), public.jtxt(v_in, 'description_ar'),
      public.jtxt(v_in, 'body_en'), public.jtxt(v_in, 'body_ar'),
      CASE WHEN (v_in ->> 'duration_mins') ~ '^\d{1,3}$' THEN (v_in ->> 'duration_mins')::smallint END,
      v_cat, v_status = 'published', v_status, 0, false, 'global',
      v_owner, auth.uid(),
      CASE WHEN public.jtxt(v_in, 'media_path') IS NOT NULL THEN public.jtxt(v_in, 'media_bucket') END,
      public.jtxt(v_in, 'media_path'))
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.content_items SET
      kind = v_kind, title_en = public.jtxt(v_in, 'title_en'), title_ar = public.jtxt(v_in, 'title_ar'),
      description_en = public.jtxt(v_in, 'description_en'), description_ar = public.jtxt(v_in, 'description_ar'),
      body_en = public.jtxt(v_in, 'body_en'), body_ar = public.jtxt(v_in, 'body_ar'),
      duration_mins = CASE WHEN (v_in ->> 'duration_mins') ~ '^\d{1,3}$' THEN (v_in ->> 'duration_mins')::smallint END,
      category = v_cat, status = v_status, published = v_status = 'published',
      media_bucket = CASE WHEN public.jtxt(v_in, 'media_path') IS NOT NULL THEN public.jtxt(v_in, 'media_bucket') END,
      media_path = public.jtxt(v_in, 'media_path'),
      updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END;
$$;

-- HR's own habit challenge (private template). Input keys: id, title_en,
-- title_ar, weeks (1–4, default 1), success_days (default 80% of the
-- workdays, e.g. 8 of 10), payload {category, action_en, action_ar, why_*,
-- tip_*, reminder_*, reminder_time, missed_*, check_mode, article_slug,
-- media_type, media_bucket, media_path, media_mime, media_youtube_id,
-- media_url (content-assets only)}. Schedule it with
-- hr_schedule_habit_challenge() like any habit template.
CREATE OR REPLACE FUNCTION public.hr_save_challenge_template(p_input JSONB)
RETURNS public.challenge_templates
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_id      UUID;
  v_old     public.challenge_templates%ROWTYPE;
  v_row     public.challenge_templates%ROWTYPE;
  v_p       JSONB;
  v_clean   JSONB;
  v_weeks   INT;
  v_need    INT;
  v_cat     TEXT;
  v_badge   JSONB;
  v_type    TEXT;
  v_title   TEXT;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_id := nullif(p_input ->> 'id', '')::uuid;
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.challenge_templates WHERE id = v_id FOR UPDATE;
    IF v_old.id IS NULL THEN RAISE EXCEPTION 'template_not_found' USING ERRCODE = 'P0002'; END IF;
    IF v_old.company_id IS NULL THEN RAISE EXCEPTION 'public_item_read_only' USING ERRCODE = '42501'; END IF;
    IF v_old.company_id <> v_company THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501'; END IF;
  END IF;

  v_title := COALESCE(public.jtxt(p_input, 'title_en'), v_old.title_en);
  IF v_title IS NULL THEN RAISE EXCEPTION 'title_required' USING ERRCODE = '22023'; END IF;
  IF length(v_title) > 80 THEN RAISE EXCEPTION 'title_too_long' USING ERRCODE = '22023'; END IF;

  v_p := COALESCE(v_old.payload, '{}'::jsonb)
         || CASE WHEN jsonb_typeof(p_input -> 'payload') = 'object' THEN p_input -> 'payload' ELSE '{}'::jsonb END;
  IF public.jtxt(v_p, 'action_en') IS NULL THEN RAISE EXCEPTION 'action_required' USING ERRCODE = '22023'; END IF;

  v_weeks := COALESCE(nullif(p_input ->> 'weeks', '')::int, nullif(v_p ->> 'weeks', '')::int, 1);
  IF v_weeks NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'bad_weeks' USING ERRCODE = '22023'; END IF;
  v_need := COALESCE(nullif(p_input ->> 'success_days', '')::int,
                     CASE WHEN p_input ? 'weeks' THEN NULL ELSE nullif(v_p ->> 'success_days', '')::int END,
                     ceil(0.8 * v_weeks * 5)::int);
  IF v_need NOT BETWEEN 1 AND v_weeks * 5 THEN RAISE EXCEPTION 'bad_success_days' USING ERRCODE = '22023'; END IF;

  IF COALESCE(public.jtxt(v_p, 'check_mode'), 'same_day') NOT IN ('same_day', 'next_morning') THEN
    RAISE EXCEPTION 'bad_check_mode' USING ERRCODE = '22023';
  END IF;
  v_cat := public.jtxt(v_p, 'category');
  IF v_cat IS NOT NULL AND v_cat NOT IN ('movement', 'sleep', 'mood', 'hydration', 'stress') THEN
    RAISE EXCEPTION 'bad_category' USING ERRCODE = '22023';
  END IF;
  v_badge := CASE v_cat
    WHEN 'movement'  THEN '{"badge_icon": "activity", "badge_color": "#8BBF7A"}'
    WHEN 'sleep'     THEN '{"badge_icon": "moon",     "badge_color": "#9C8BD9"}'
    WHEN 'mood'      THEN '{"badge_icon": "smile",    "badge_color": "#E39A7B"}'
    WHEN 'hydration' THEN '{"badge_icon": "drop",     "badge_color": "#6FB7D9"}'
    WHEN 'stress'    THEN '{"badge_icon": "wind",     "badge_color": "#C9A15B"}'
    ELSE '{"badge_icon": "trophy", "badge_color": "#F5B544"}' END::jsonb;

  v_type := public.jtxt(v_p, 'media_type');
  PERFORM public.check_media(v_company, v_type, public.jtxt(v_p, 'media_bucket'), public.jtxt(v_p, 'media_path'),
                             public.jtxt(v_p, 'media_mime'), public.jtxt(v_p, 'media_youtube_id'));

  -- Only the keys the app reads; media keys only for the media type chosen.
  SELECT COALESCE(jsonb_object_agg(k, v_p -> k), '{}'::jsonb) INTO v_clean
    FROM unnest(ARRAY['category', 'action_en', 'action_ar', 'why_en', 'why_ar', 'tip_en', 'tip_ar',
                      'reminder_en', 'reminder_ar', 'reminder_time', 'missed_en', 'missed_ar',
                      'check_mode', 'article_slug']) k
   WHERE public.jtxt(v_p, k) IS NOT NULL;
  IF v_type = 'youtube' THEN
    v_clean := v_clean || jsonb_build_object('media_type', 'youtube', 'media_youtube_id', public.jtxt(v_p, 'media_youtube_id'));
  ELSIF v_type IN ('video', 'image') THEN
    v_clean := v_clean || jsonb_strip_nulls(jsonb_build_object(
      'media_type', v_type, 'media_bucket', public.jtxt(v_p, 'media_bucket'),
      'media_path', public.jtxt(v_p, 'media_path'), 'media_mime', public.jtxt(v_p, 'media_mime'),
      'media_url', CASE WHEN public.jtxt(v_p, 'media_bucket') = 'content-assets'
                        AND public.jtxt(v_p, 'media_url') ~ '^https://' THEN public.jtxt(v_p, 'media_url') END));
  END IF;
  v_clean := v_clean || v_badge || jsonb_build_object(
    'check_mode', COALESCE(public.jtxt(v_p, 'check_mode'), 'same_day'),
    'weeks', v_weeks, 'success_days', v_need, 'company_template', true);

  IF v_id IS NULL THEN
    INSERT INTO public.challenge_templates (slug, title_en, title_ar, kind, default_window_days, target,
                                            metric, payload, company_id, created_by)
    VALUES ('co-' || left(replace(v_company::text, '-', ''), 8) || '-' || public.slugify_text(v_title)
              || '-' || substr(md5(gen_random_uuid()::text), 1, 5),
            v_title, COALESCE(public.jtxt(p_input, 'title_ar'), v_title), 'habit', v_weeks * 5, v_need,
            'habit', v_clean, v_company, auth.uid())
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.challenge_templates SET
      title_en = v_title,
      title_ar = COALESCE(public.jtxt(p_input, 'title_ar'), title_ar, v_title),
      default_window_days = v_weeks * 5, target = v_need, payload = v_clean, updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END;
$$;

-- Publish / draft / archive any library item the caller owns.
-- challenge_template accepts 'published' (un-archive) and 'archived'.
CREATE OR REPLACE FUNCTION public.set_library_status(p_item_type TEXT, p_item_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_found BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF p_item_type = 'challenge_template' THEN
    IF p_status NOT IN ('published', 'archived') THEN RAISE EXCEPTION 'bad_status' USING ERRCODE = '22023'; END IF;
  ELSIF p_status NOT IN ('draft', 'published', 'archived') THEN
    RAISE EXCEPTION 'bad_status' USING ERRCODE = '22023';
  END IF;

  IF p_item_type = 'content' THEN
    SELECT true, company_id INTO v_found, v_owner FROM public.content_items WHERE id = p_item_id;
  ELSIF p_item_type = 'exercise' THEN
    SELECT true, company_id INTO v_found, v_owner FROM public.exercises WHERE id = p_item_id;
  ELSIF p_item_type = 'routine' THEN
    SELECT true, company_id INTO v_found, v_owner FROM public.routines WHERE id = p_item_id;
  ELSIF p_item_type = 'challenge_template' THEN
    SELECT true, company_id INTO v_found, v_owner FROM public.challenge_templates WHERE id = p_item_id;
  ELSE
    RAISE EXCEPTION 'bad_item_type' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(v_found, false) THEN RAISE EXCEPTION 'item_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.assert_library_writer(v_owner);

  IF p_item_type = 'content' THEN
    UPDATE public.content_items SET status = p_status, published = p_status = 'published', updated_at = now()
     WHERE id = p_item_id;
  ELSIF p_item_type = 'exercise' THEN
    UPDATE public.exercises SET status = p_status, updated_at = now() WHERE id = p_item_id;
  ELSIF p_item_type = 'routine' THEN
    UPDATE public.routines SET status = p_status, updated_at = now() WHERE id = p_item_id;
  ELSE
    UPDATE public.challenge_templates
       SET archived_at = CASE WHEN p_status = 'archived' THEN COALESCE(archived_at, now()) END, updated_at = now()
     WHERE id = p_item_id;
  END IF;
  RETURN jsonb_build_object('item_type', p_item_type, 'id', p_item_id, 'status', p_status);
END;
$$;

-- "Use this": an editable private copy of a public (or own) exercise.
CREATE OR REPLACE FUNCTION public.hr_copy_exercise(p_exercise_id UUID)
RETURNS public.exercises
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  e         public.exercises%ROWTYPE;
  v_row     public.exercises%ROWTYPE;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO e FROM public.exercises
   WHERE id = p_exercise_id
     AND ((company_id IS NULL AND status = 'published') OR company_id = v_company);
  IF e.id IS NULL THEN RAISE EXCEPTION 'exercise_not_found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.exercises (
    company_id, name_en, name_ar, how_en, how_ar, helps_en, helps_ar, body_areas,
    default_sets_reps, default_sets_reps_ar, media_type, media_bucket, media_path, media_mime,
    media_youtube_id, poster_path, status, copied_from, created_by)
  VALUES (
    v_company, e.name_en, e.name_ar, e.how_en, e.how_ar, e.helps_en, e.helps_ar, e.body_areas,
    e.default_sets_reps, e.default_sets_reps_ar, e.media_type, e.media_bucket, e.media_path, e.media_mime,
    e.media_youtube_id, e.poster_path, 'published', e.id, auth.uid())
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- "Use this": an editable private copy of a public (or own) routine with all
-- its rows. Public exercises stay referenced (they are usable as-is).
-- Returns routine_detail() of the copy. Not assigned yet.
CREATE OR REPLACE FUNCTION public.hr_copy_routine(p_routine_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  r         public.routines%ROWTYPE;
  v_new     UUID;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.routines
   WHERE id = p_routine_id
     AND ((company_id IS NULL AND status = 'published') OR company_id = v_company);
  IF r.id IS NULL THEN RAISE EXCEPTION 'routine_not_found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.routines (company_id, title_en, title_ar, note_en, note_ar, day_titles, workdays,
                               source_file_bucket, source_file_path, source_file_mime, status,
                               copied_from, created_by)
  VALUES (v_company, r.title_en, r.title_ar, r.note_en, r.note_ar, r.day_titles, r.workdays,
          r.source_file_bucket, r.source_file_path, r.source_file_mime, 'published', r.id, auth.uid())
  RETURNING id INTO v_new;
  INSERT INTO public.routine_items (routine_id, exercise_id, title_en, title_ar, weekday, at_time,
                                    sets_reps, sets_reps_ar, note_en, note_ar, sort_order)
  SELECT v_new, i.exercise_id, i.title_en, i.title_ar, i.weekday, i.at_time,
         i.sets_reps, i.sets_reps_ar, i.note_en, i.note_ar, i.sort_order
    FROM public.routine_items i WHERE i.routine_id = r.id;
  RETURN public.routine_detail(v_new);
END;
$$;

-- Give a routine to everyone (team NULL) or one team, from a date (default
-- today, never in the past) until an optional end date.
CREATE OR REPLACE FUNCTION public.hr_assign_routine(p_routine_id UUID, p_team_id UUID DEFAULT NULL,
                                                    p_starts_on DATE DEFAULT NULL, p_ends_on DATE DEFAULT NULL)
RETURNS public.routine_assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_today   DATE;
  v_start   DATE;
  v_row     public.routine_assignments%ROWTYPE;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_today := public.company_today(v_company);
  v_start := COALESCE(p_starts_on, v_today);
  IF NOT EXISTS (SELECT 1 FROM public.routines WHERE id = p_routine_id AND company_id = v_company) THEN
    RAISE EXCEPTION 'routine_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.routines WHERE id = p_routine_id AND status = 'published') THEN
    RAISE EXCEPTION 'routine_not_published' USING ERRCODE = '22023';
  END IF;
  IF p_team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id AND company_id = v_company) THEN
    RAISE EXCEPTION 'team_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_start < v_today THEN RAISE EXCEPTION 'starts_in_the_past' USING ERRCODE = '22023'; END IF;
  IF p_ends_on IS NOT NULL AND p_ends_on < v_start THEN RAISE EXCEPTION 'bad_dates' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.routine_assignments a
              WHERE a.routine_id = p_routine_id AND a.active
                AND a.team_id IS NOT DISTINCT FROM p_team_id
                AND a.starts_on <= COALESCE(p_ends_on, 'infinity'::date)
                AND COALESCE(a.ends_on, 'infinity'::date) >= v_start) THEN
    RAISE EXCEPTION 'already_assigned' USING ERRCODE = '23P01';
  END IF;
  INSERT INTO public.routine_assignments (routine_id, company_id, team_id, starts_on, ends_on, created_by)
  VALUES (p_routine_id, v_company, p_team_id, v_start, p_ends_on, auth.uid())
  RETURNING * INTO v_row;
  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'routine.assigned', 'routine',
          p_routine_id, 'info', jsonb_build_object('team_id', p_team_id, 'starts_on', v_start, 'ends_on', p_ends_on));
  RETURN v_row;
END;
$$;

-- Stop an assignment. One that hasn't started is cancelled; a running one
-- ends on p_ends_on (default today: still shown today, gone tomorrow;
-- yesterday = gone now).
CREATE OR REPLACE FUNCTION public.hr_end_routine_assignment(p_assignment_id UUID, p_ends_on DATE DEFAULT NULL)
RETURNS public.routine_assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_today   DATE;
  v_end     DATE;
  a         public.routine_assignments%ROWTYPE;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO a FROM public.routine_assignments WHERE id = p_assignment_id AND company_id = v_company FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'assignment_not_found' USING ERRCODE = 'P0002'; END IF;
  v_today := public.company_today(v_company);
  v_end := COALESCE(p_ends_on, v_today);
  IF v_end < v_today - 1 THEN RAISE EXCEPTION 'end_in_the_past' USING ERRCODE = '22023'; END IF;
  IF a.starts_on > v_end THEN
    UPDATE public.routine_assignments SET active = false WHERE id = a.id RETURNING * INTO a;
  ELSE
    UPDATE public.routine_assignments SET ends_on = v_end WHERE id = a.id RETURNING * INTO a;
  END IF;
  RETURN a;
END;
$$;

-- HR: every assignment with routine and team names and a status.
CREATE OR REPLACE FUNCTION public.hr_routine_assignments()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_today   DATE;
  v_out     JSONB;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_today := public.company_today(v_company);
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', a.id, 'routine_id', a.routine_id, 'routine_title_en', r.title_en, 'routine_title_ar', r.title_ar,
           'routine_status', r.status, 'team_id', a.team_id, 'team_name', t.name,
           'starts_on', a.starts_on, 'ends_on', a.ends_on, 'active', a.active, 'created_at', a.created_at,
           'status', CASE WHEN NOT a.active THEN 'cancelled'
                          WHEN a.starts_on > v_today THEN 'upcoming'
                          WHEN a.ends_on IS NOT NULL AND a.ends_on < v_today THEN 'ended'
                          ELSE 'active' END)
         ORDER BY a.active DESC, a.starts_on DESC), '[]'::jsonb)
    INTO v_out
    FROM public.routine_assignments a
    JOIN public.routines r ON r.id = a.routine_id
    LEFT JOIN public.teams t ON t.id = a.team_id
   WHERE a.company_id = v_company;
  RETURN v_out;
END;
$$;

-- Import a routine from sheet rows. p_routine: {title_en, title_ar, note_en,
-- note_ar, workdays, day_titles, assign (bool), team_id, starts_on}.
-- p_rows: [{row, time, exercise, exercise_ar, sets_reps, sets_reps_ar,
-- weekday, body_areas ("neck, shoulders" or [..]), youtube (link or id),
-- video_path (a file already uploaded to company-media/{company_id}/…,
-- .mp4 / .mov / .png / .jpg; wins over youtube), how_en, how_ar, note_en,
-- note_ar}]. Exercises are matched by English name (company's own first,
-- then Wellness House); missing ones are created, and our own matched
-- exercise without media gets the row's video. Rows with problems are
-- skipped and listed. p_dry_run = true returns the same summary and saves
-- nothing (the preview).
CREATE OR REPLACE FUNCTION public.hr_import_routine(p_routine JSONB, p_rows JSONB, p_dry_run BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company   UUID := public.auth_company_id();
  v_title     TEXT := public.jtxt(p_routine, 'title_en');
  v_workdays  SMALLINT[] := '{0,1,2,3,4}';
  v_routine   UUID;
  v_problems  JSONB := '[]'::jsonb;
  v_warnings  JSONB := '[]'::jsonb;
  v_new_names JSONB := '[]'::jsonb;
  v_items     INT := 0;
  v_matched   INT := 0;
  v_created   INT := 0;
  v_idx       INT := 0;
  v_assign    UUID;
  r           JSONB;
  v_rowno     INT;
  v_name      TEXT;
  v_raw       TEXT;
  v_at        TIME;
  v_wd        SMALLINT;
  v_yt        TEXT;
  v_vpath     TEXT;
  v_vmime     TEXT;
  v_mtype     TEXT;
  v_areas     TEXT[];
  v_ex        UUID;
  v_ex_media  TEXT;
  v_ex_owner  UUID;
  v_today     DATE;
  v_start     DATE;
  v_team      UUID;
  v_summary   JSONB;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF v_title IS NULL THEN RAISE EXCEPTION 'title_required' USING ERRCODE = '22023'; END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023'; END IF;
  IF jsonb_array_length(p_rows) > 100 THEN RAISE EXCEPTION 'too_many_items' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(p_routine -> 'workdays') = 'array' THEN
    v_workdays := ARRAY(SELECT DISTINCT x::smallint FROM jsonb_array_elements_text(p_routine -> 'workdays') x ORDER BY 1);
    IF cardinality(v_workdays) = 0 OR NOT v_workdays <@ '{0,1,2,3,4,5,6}'::smallint[] THEN
      RAISE EXCEPTION 'bad_workdays' USING ERRCODE = '22023';
    END IF;
  END IF;
  v_today := public.company_today(v_company);
  v_team := nullif(p_routine ->> 'team_id', '')::uuid;
  v_start := COALESCE(nullif(p_routine ->> 'starts_on', '')::date, v_today);

  BEGIN
    INSERT INTO public.routines (company_id, title_en, title_ar, note_en, note_ar, workdays, day_titles, created_by)
    VALUES (v_company, v_title, public.jtxt(p_routine, 'title_ar'), public.jtxt(p_routine, 'note_en'),
            public.jtxt(p_routine, 'note_ar'), v_workdays,
            CASE WHEN jsonb_typeof(p_routine -> 'day_titles') = 'object' THEN p_routine -> 'day_titles' ELSE '{}'::jsonb END,
            auth.uid())
    RETURNING id INTO v_routine;

    FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
      v_idx := v_idx + 1;
      v_rowno := CASE WHEN (r ->> 'row') ~ '^\d{1,6}$' THEN (r ->> 'row')::int ELSE v_idx END;
      v_name := public.jtxt(r, 'exercise');
      IF v_name IS NULL THEN
        v_problems := v_problems || jsonb_build_object('row', v_rowno, 'reason', 'missing_exercise');
        CONTINUE;
      END IF;
      IF length(v_name) > 120 THEN
        v_problems := v_problems || jsonb_build_object('row', v_rowno, 'reason', 'name_too_long');
        CONTINUE;
      END IF;

      v_raw := public.jtxt(r, 'time');
      v_at := public.parse_clock(v_raw);
      IF v_raw IS NOT NULL AND v_at IS NULL THEN
        v_problems := v_problems || jsonb_build_object('row', v_rowno, 'reason', 'bad_time', 'value', v_raw);
        CONTINUE;
      END IF;

      v_raw := public.jtxt(r, 'weekday');
      v_wd := public.parse_weekday(v_raw);
      IF v_wd = -1 THEN
        v_problems := v_problems || jsonb_build_object('row', v_rowno, 'reason', 'bad_weekday', 'value', v_raw);
        CONTINUE;
      END IF;
      IF v_wd IS NOT NULL AND NOT (v_wd = ANY (v_workdays)) THEN
        v_problems := v_problems || jsonb_build_object('row', v_rowno, 'reason', 'weekday_not_workday', 'value', v_raw);
        CONTINUE;
      END IF;

      v_raw := public.jtxt(r, 'youtube');
      v_yt := public.parse_youtube_id(v_raw);
      IF v_raw IS NOT NULL AND v_yt IS NULL THEN
        v_warnings := v_warnings || jsonb_build_object('row', v_rowno, 'reason', 'bad_youtube', 'value', v_raw);
      END IF;

      v_vpath := public.jtxt(r, 'video_path');
      v_vmime := CASE lower(substring(COALESCE(v_vpath, '') FROM '\.([A-Za-z0-9]+)$'))
                   WHEN 'mp4' THEN 'video/mp4' WHEN 'mov' THEN 'video/quicktime'
                   WHEN 'png' THEN 'image/png' WHEN 'jpg' THEN 'image/jpeg' WHEN 'jpeg' THEN 'image/jpeg' END;
      IF v_vpath IS NOT NULL AND (split_part(v_vpath, '/', 1) <> v_company::text OR v_vpath ~ '\.\.'
                                  OR length(v_vpath) > 300 OR v_vmime IS NULL) THEN
        v_warnings := v_warnings || jsonb_build_object('row', v_rowno, 'reason', 'bad_video_path', 'value', v_vpath);
        v_vpath := NULL;
      END IF;
      v_mtype := CASE WHEN v_vpath IS NOT NULL THEN split_part(v_vmime, '/', 1)
                      WHEN v_yt IS NOT NULL THEN 'youtube' END;

      IF jsonb_typeof(r -> 'body_areas') = 'array' THEN
        v_areas := ARRAY(SELECT DISTINCT lower(btrim(x)) FROM jsonb_array_elements_text(r -> 'body_areas') x WHERE btrim(x) <> '');
      ELSE
        v_areas := ARRAY(SELECT DISTINCT replace(lower(btrim(x)), ' ', '_')
                           FROM regexp_split_to_table(COALESCE(r ->> 'body_areas', ''), '[,;،/]') x WHERE btrim(x) <> '');
      END IF;
      IF NOT v_areas <@ public.exercise_body_areas() THEN
        v_warnings := v_warnings || jsonb_build_object('row', v_rowno, 'reason', 'unknown_body_area',
                        'value', array_to_string(ARRAY(SELECT unnest(v_areas) EXCEPT SELECT unnest(public.exercise_body_areas())), ', '));
        v_areas := ARRAY(SELECT unnest(v_areas) INTERSECT SELECT unnest(public.exercise_body_areas()));
      END IF;

      v_ex := NULL;
      SELECT e.id, e.media_type, e.company_id INTO v_ex, v_ex_media, v_ex_owner
        FROM public.exercises e
       WHERE lower(btrim(e.name_en)) = lower(v_name)
         AND ((e.company_id = v_company AND e.status <> 'archived') OR (e.company_id IS NULL AND e.status = 'published'))
       ORDER BY (e.company_id IS NULL), e.created_at
       LIMIT 1;
      IF v_ex IS NULL THEN
        INSERT INTO public.exercises (company_id, name_en, name_ar, how_en, how_ar, body_areas,
                                      default_sets_reps, default_sets_reps_ar, media_type, media_bucket,
                                      media_path, media_mime, media_youtube_id, created_by)
        VALUES (v_company, v_name, public.jtxt(r, 'exercise_ar'), public.jtxt(r, 'how_en'), public.jtxt(r, 'how_ar'),
                COALESCE(v_areas, '{}'), public.jtxt(r, 'sets_reps'), public.jtxt(r, 'sets_reps_ar'),
                v_mtype,
                CASE WHEN v_vpath IS NOT NULL THEN 'company-media' END, v_vpath,
                CASE WHEN v_vpath IS NOT NULL THEN v_vmime END,
                CASE WHEN v_mtype = 'youtube' THEN v_yt END, auth.uid())
        RETURNING id INTO v_ex;
        v_created := v_created + 1;
        v_new_names := v_new_names || to_jsonb(v_name);
      ELSE
        v_matched := v_matched + 1;
        -- Fill in a video on our own exercise that has none yet.
        IF v_mtype IS NOT NULL AND v_ex_media IS NULL AND v_ex_owner = v_company THEN
          UPDATE public.exercises SET
            media_type = v_mtype,
            media_bucket = CASE WHEN v_vpath IS NOT NULL THEN 'company-media' END,
            media_path = v_vpath,
            media_mime = CASE WHEN v_vpath IS NOT NULL THEN v_vmime END,
            media_youtube_id = CASE WHEN v_mtype = 'youtube' THEN v_yt END,
            updated_at = now()
          WHERE id = v_ex;
        END IF;
      END IF;

      INSERT INTO public.routine_items (routine_id, exercise_id, weekday, at_time, sets_reps, sets_reps_ar,
                                        note_en, note_ar, sort_order)
      VALUES (v_routine, v_ex, v_wd, v_at, public.jtxt(r, 'sets_reps'), public.jtxt(r, 'sets_reps_ar'),
              public.jtxt(r, 'note_en'), public.jtxt(r, 'note_ar'), v_idx);
      v_items := v_items + 1;
    END LOOP;

    IF COALESCE((p_routine ->> 'assign')::boolean, false) AND v_items > 0 THEN
      IF v_start < v_today THEN RAISE EXCEPTION 'starts_in_the_past' USING ERRCODE = '22023'; END IF;
      INSERT INTO public.routine_assignments (routine_id, company_id, team_id, starts_on, created_by)
      VALUES (v_routine, v_company, v_team, v_start, auth.uid())
      RETURNING id INTO v_assign;
    END IF;

    -- saved: false for a preview, and when no row could be imported (nothing
    -- is kept then, not even an empty routine).
    v_summary := jsonb_build_object(
      'dry_run', COALESCE(p_dry_run, false),
      'saved', NOT COALESCE(p_dry_run, false) AND v_items > 0,
      'routine_id', CASE WHEN COALESCE(p_dry_run, false) OR v_items = 0 THEN NULL ELSE v_routine END,
      'assignment_id', CASE WHEN COALESCE(p_dry_run, false) OR v_items = 0 THEN NULL ELSE v_assign END,
      'rows', jsonb_array_length(p_rows), 'items', v_items,
      'exercises_matched', v_matched, 'exercises_created', v_created, 'new_exercises', v_new_names,
      'problems', v_problems, 'warnings', v_warnings);

    IF COALESCE(p_dry_run, false) OR v_items = 0 THEN
      RAISE EXCEPTION 'wellness_dry_run_rollback';
    END IF;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'wellness_dry_run_rollback' THEN RAISE; END IF;
  END;

  RETURN v_summary;
END;
$$;

-- Hide or pin an item in the company's library. Hiding is for public items
-- (own items use set_library_status). Arguments left NULL keep their value.
CREATE OR REPLACE FUNCTION public.hr_set_library_pref(p_item_type TEXT, p_item_id UUID,
                                                      p_hidden BOOLEAN DEFAULT NULL, p_pinned BOOLEAN DEFAULT NULL,
                                                      p_sort_order INT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_owner   UUID;
  v_found   BOOLEAN;
  v_row     public.company_library_prefs%ROWTYPE;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_item_type = 'content' THEN
    SELECT true, company_id INTO v_found, v_owner FROM public.content_items
     WHERE id = p_item_id AND (company_id = v_company OR (company_id IS NULL AND published));
  ELSIF p_item_type = 'exercise' THEN
    SELECT true, company_id INTO v_found, v_owner FROM public.exercises
     WHERE id = p_item_id AND (company_id = v_company OR (company_id IS NULL AND status = 'published'));
  ELSIF p_item_type = 'routine' THEN
    SELECT true, company_id INTO v_found, v_owner FROM public.routines
     WHERE id = p_item_id AND (company_id = v_company OR (company_id IS NULL AND status = 'published'));
  ELSIF p_item_type = 'challenge_template' THEN
    SELECT true, company_id INTO v_found, v_owner FROM public.challenge_templates
     WHERE id = p_item_id AND (company_id = v_company OR (company_id IS NULL AND archived_at IS NULL));
  ELSE
    RAISE EXCEPTION 'bad_item_type' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(v_found, false) THEN RAISE EXCEPTION 'item_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_owner IS NOT NULL AND COALESCE(p_hidden, false) THEN
    RAISE EXCEPTION 'hide_public_items_only' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.company_library_prefs (company_id, item_type, item_id, hidden, pinned, sort_order, updated_by)
  VALUES (v_company, p_item_type, p_item_id, COALESCE(p_hidden, false), COALESCE(p_pinned, false), p_sort_order, auth.uid())
  ON CONFLICT (company_id, item_type, item_id) DO UPDATE SET
    hidden     = COALESCE(p_hidden, company_library_prefs.hidden),
    pinned     = COALESCE(p_pinned, company_library_prefs.pinned),
    sort_order = COALESCE(p_sort_order, company_library_prefs.sort_order),
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING * INTO v_row;

  IF NOT v_row.hidden AND NOT v_row.pinned AND v_row.sort_order IS NULL THEN
    DELETE FROM public.company_library_prefs
     WHERE company_id = v_company AND item_type = p_item_type AND item_id = p_item_id;
  END IF;
  RETURN jsonb_build_object('item_type', p_item_type, 'item_id', p_item_id,
                            'hidden', v_row.hidden, 'pinned', v_row.pinned, 'sort_order', v_row.sort_order);
END;
$$;

-- One list for every library type: 'content' | 'exercise' | 'routine' |
-- 'challenge_template'; scope 'all' | 'public' | 'company'. Each row is the
-- table row plus scope ('public' | 'company'), hidden, pinned, pref_sort and
-- can_edit. Pinned first. Employees never get hidden public items, drafts or
-- archived rows; HR / company admins get them (with the flags) so they can
-- manage them. Routines also carry item_count and assigned.
CREATE OR REPLACE FUNCTION public.library_list(p_type TEXT, p_scope TEXT DEFAULT 'all')
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_hr      BOOLEAN := public.auth_role() IN ('hr_admin', 'company_admin');
  v_pub     BOOLEAN;
  v_own     BOOLEAN;
  v_today   DATE;
  v_out     JSONB;
BEGIN
  IF auth.uid() IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p_scope, 'all') NOT IN ('all', 'public', 'company') THEN
    RAISE EXCEPTION 'bad_scope' USING ERRCODE = '22023';
  END IF;
  v_pub := COALESCE(p_scope, 'all') IN ('all', 'public');
  v_own := COALESCE(p_scope, 'all') IN ('all', 'company');

  IF p_type = 'content' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x.ci) || jsonb_build_object(
             'scope', CASE WHEN (x.ci).company_id IS NULL THEN 'public' ELSE 'company' END,
             'hidden', x.hidden, 'pinned', x.pinned, 'pref_sort', x.pref_sort,
             'can_edit', v_hr AND (x.ci).company_id IS NOT NULL)
           ORDER BY x.pinned DESC, x.pref_sort NULLS LAST, (x.ci).company_id IS NULL, (x.ci).sort_order, (x.ci).title_en), '[]'::jsonb)
      INTO v_out
      FROM (SELECT ci, COALESCE(lp.hidden, false) AS hidden, COALESCE(lp.pinned, false) AS pinned, lp.sort_order AS pref_sort
              FROM public.content_items ci
              LEFT JOIN public.company_library_prefs lp
                ON lp.company_id = v_company AND lp.item_type = 'content' AND lp.item_id = ci.id
             WHERE (v_pub AND ci.company_id IS NULL AND ci.published AND (v_hr OR NOT COALESCE(lp.hidden, false)))
                OR (v_own AND ci.company_id = v_company AND (ci.published OR (v_hr AND ci.status <> 'archived')))) x;

  ELSIF p_type = 'exercise' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x.e) || jsonb_build_object(
             'scope', CASE WHEN (x.e).company_id IS NULL THEN 'public' ELSE 'company' END,
             'hidden', x.hidden, 'pinned', x.pinned, 'pref_sort', x.pref_sort,
             'can_edit', v_hr AND (x.e).company_id IS NOT NULL)
           ORDER BY x.pinned DESC, x.pref_sort NULLS LAST, (x.e).company_id IS NULL, lower((x.e).name_en)), '[]'::jsonb)
      INTO v_out
      FROM (SELECT e, COALESCE(lp.hidden, false) AS hidden, COALESCE(lp.pinned, false) AS pinned, lp.sort_order AS pref_sort
              FROM public.exercises e
              LEFT JOIN public.company_library_prefs lp
                ON lp.company_id = v_company AND lp.item_type = 'exercise' AND lp.item_id = e.id
             WHERE (v_pub AND e.company_id IS NULL AND e.status = 'published' AND (v_hr OR NOT COALESCE(lp.hidden, false)))
                OR (v_own AND e.company_id = v_company AND (e.status = 'published' OR v_hr))) x;

  ELSIF p_type = 'routine' THEN
    v_today := public.company_today(v_company);
    SELECT COALESCE(jsonb_agg(to_jsonb(x.r) || jsonb_build_object(
             'scope', CASE WHEN (x.r).company_id IS NULL THEN 'public' ELSE 'company' END,
             'hidden', x.hidden, 'pinned', x.pinned, 'pref_sort', x.pref_sort,
             'can_edit', v_hr AND (x.r).company_id IS NOT NULL,
             'item_count', (SELECT count(*) FROM public.routine_items i WHERE i.routine_id = (x.r).id),
             'assigned', v_hr AND EXISTS (SELECT 1 FROM public.routine_assignments a
                                           WHERE a.routine_id = (x.r).id AND a.active
                                             AND (a.ends_on IS NULL OR a.ends_on >= v_today)))
           ORDER BY x.pinned DESC, x.pref_sort NULLS LAST, (x.r).company_id IS NULL, lower((x.r).title_en)), '[]'::jsonb)
      INTO v_out
      FROM (SELECT r, COALESCE(lp.hidden, false) AS hidden, COALESCE(lp.pinned, false) AS pinned, lp.sort_order AS pref_sort
              FROM public.routines r
              LEFT JOIN public.company_library_prefs lp
                ON lp.company_id = v_company AND lp.item_type = 'routine' AND lp.item_id = r.id
             WHERE (v_pub AND r.company_id IS NULL AND r.status = 'published' AND (v_hr OR NOT COALESCE(lp.hidden, false)))
                OR (v_own AND r.company_id = v_company AND (r.status = 'published' OR v_hr))) x;

  ELSIF p_type = 'challenge_template' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x.t) || jsonb_build_object(
             'scope', CASE WHEN (x.t).company_id IS NULL THEN 'public' ELSE 'company' END,
             'hidden', x.hidden, 'pinned', x.pinned, 'pref_sort', x.pref_sort,
             'can_edit', v_hr AND (x.t).company_id IS NOT NULL,
             'weeks', CASE WHEN (x.t).payload ->> 'weeks' ~ '^[1-4]$' THEN ((x.t).payload ->> 'weeks')::int ELSE 1 END)
           ORDER BY x.pinned DESC, x.pref_sort NULLS LAST, (x.t).company_id IS NULL, lower((x.t).title_en)), '[]'::jsonb)
      INTO v_out
      FROM (SELECT t, COALESCE(lp.hidden, false) AS hidden, COALESCE(lp.pinned, false) AS pinned, lp.sort_order AS pref_sort
              FROM public.challenge_templates t
              LEFT JOIN public.company_library_prefs lp
                ON lp.company_id = v_company AND lp.item_type = 'challenge_template' AND lp.item_id = t.id
             WHERE t.kind = 'habit'
               AND ((v_pub AND t.company_id IS NULL AND t.archived_at IS NULL AND (v_hr OR NOT COALESCE(lp.hidden, false)))
                 OR (v_own AND t.company_id = v_company AND (t.archived_at IS NULL OR v_hr)))) x;
  ELSE
    RAISE EXCEPTION 'bad_item_type' USING ERRCODE = '22023';
  END IF;
  RETURN v_out;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 10. Habit challenges: company-local dates, HR's own templates (1–4
--     weeks, workdays only), default week on/off
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.habit_target_date(p_payload JSONB, p_today DATE)
RETURNS DATE
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE WHEN p_payload ->> 'check_mode' = 'next_morning' THEN p_today - 1 ELSE p_today END;
$$;

-- Kept for callers of the old signature: uses the caller's company day.
CREATE OR REPLACE FUNCTION public.habit_target_date(p_payload JSONB)
RETURNS DATE
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.habit_target_date(p_payload, public.company_today(public.auth_company_id()));
$$;

CREATE OR REPLACE FUNCTION public.habit_weeks(p_payload JSONB)
RETURNS INT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE WHEN p_payload ->> 'weeks' ~ '^[1-4]$' THEN (p_payload ->> 'weeks')::int ELSE 1 END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_default_habit_week(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today DATE;
  v_dow   INT;
  v_week  DATE;
  v_n     INT;
  t       public.challenge_templates%ROWTYPE;
BEGIN
  IF p_company_id IS NULL THEN RETURN; END IF;
  -- HR switched the default weekly habit off (e.g. while a routine runs).
  IF EXISTS (SELECT 1 FROM public.companies
              WHERE id = p_company_id AND settings ->> 'weekly_habit_enabled' = 'false') THEN
    RETURN;
  END IF;
  v_today := public.company_today(p_company_id);
  v_dow := EXTRACT(DOW FROM v_today)::int;
  -- Sun → Thu: this week. Fri / Sat: the week ahead.
  v_week := CASE WHEN v_dow <= 4 THEN v_today - v_dow ELSE v_today + (7 - v_dow) END;

  -- Two employees opening the app at once must not book two defaults.
  PERFORM pg_advisory_xact_lock(hashtext('habit_default_week'), hashtext(p_company_id::text));

  IF EXISTS (SELECT 1 FROM public.challenges
              WHERE company_id = p_company_id AND kind = 'habit'
                AND start_date <= v_week + 4 AND end_date >= v_week) THEN
    RETURN;
  END IF;

  -- Only public templates rotate, minus the ones this company hid.
  SELECT COUNT(*) INTO v_n FROM public.challenge_templates ct
   WHERE ct.kind = 'habit' AND ct.archived_at IS NULL AND ct.company_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.company_library_prefs lp
                      WHERE lp.company_id = p_company_id AND lp.item_type = 'challenge_template'
                        AND lp.item_id = ct.id AND lp.hidden);
  IF v_n = 0 THEN RETURN; END IF;
  SELECT * INTO t FROM public.challenge_templates ct
   WHERE ct.kind = 'habit' AND ct.archived_at IS NULL AND ct.company_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.company_library_prefs lp
                      WHERE lp.company_id = p_company_id AND lp.item_type = 'challenge_template'
                        AND lp.item_id = ct.id AND lp.hidden)
   ORDER BY ct.slug OFFSET ((v_week - DATE '2026-01-04') / 7) % v_n LIMIT 1;

  INSERT INTO public.challenges (
    company_id, title_en, title_ar, description_en, description_ar,
    metric, goal_value, start_date, end_date, duration_days,
    badge_icon, badge_color, active, kind, template_id, team_id, payload)
  VALUES (
    p_company_id, t.title_en, t.title_ar, t.payload ->> 'action_en', t.payload ->> 'action_ar',
    'habit', COALESCE(t.target, 4), v_week, v_week + 4, 5,
    COALESCE(t.payload ->> 'badge_icon', 'trophy'), COALESCE(t.payload ->> 'badge_color', '#F5B544'),
    true, 'habit', t.id, NULL, t.payload || '{"auto": true}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_habit_challenge(p_challenge_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c        public.challenges%ROWTYPE;
  v_last   DATE;
  v_need   INT;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF c.id IS NULL OR c.kind <> 'habit' OR (c.payload ->> 'finalized') = 'true' THEN RETURN; END IF;
  v_last := c.end_date + CASE WHEN c.payload ->> 'check_mode' = 'next_morning' THEN 1 ELSE 0 END;
  IF public.company_today(c.company_id) <= v_last THEN RETURN; END IF;

  IF c.active THEN
    v_need := COALESCE((c.payload ->> 'success_days')::INT, c.goal_value::INT, 4);

    WITH done AS (
      SELECT user_id FROM public.habit_logs
       WHERE challenge_id = c.id
       GROUP BY user_id HAVING COUNT(*) >= v_need
    ), ins AS (
      INSERT INTO public.awarded_rewards (profile_id, company_id, competition_id, tier, status, notes)
      SELECT d.user_id, c.company_id, c.id, 'bronze', 'ready', 'Habit challenge completed'
        FROM done d
       WHERE NOT EXISTS (SELECT 1 FROM public.awarded_rewards r
                          WHERE r.profile_id = d.user_id AND r.competition_id = c.id)
      RETURNING profile_id
    )
    INSERT INTO public.notifications (user_id, company_id, kind, title_en, title_ar, body_en, body_ar, sent_at)
    SELECT profile_id, c.company_id, 'challenge_update',
           'You completed ' || c.title_en,
           'خلّصت تحدي ' || COALESCE(c.title_ar, c.title_en),
           'Your reward is ready in Mine.',
           'مكافأتك جاهزة في «حسابي».',
           now()
      FROM ins;
  END IF;

  UPDATE public.challenges SET payload = payload || '{"finalized": true}'::jsonb WHERE id = c.id;
END;
$$;

-- Same shape as before, plus:
--   days   the challenge's workdays (dates); a 2-week challenge has 10
--   weeks  1–4
-- days_total / elapsed now count workdays only; Fri / Sat can't be logged.
CREATE OR REPLACE FUNCTION public.my_habit_challenge()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_team    UUID;
  v_today   DATE;
  c         public.challenges%ROWTYPE;
  v_status  TEXT;
  v_target  DATE;
  v_days    DATE[];
  v_elapsed INT;
  v_members INT;
  v_logs    INT;
  v_dates   JSONB;
  v_ended   RECORD;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  SELECT team_id INTO v_team FROM public.profiles WHERE id = v_uid;
  v_today := public.company_today(v_company);

  -- No challenge picked for this week? Put in the default one (HR can still
  -- swap it before anyone logs a day, or cancel an upcoming one).
  PERFORM public.ensure_default_habit_week(v_company);

  -- Settle any finished week for this company first (gives out rewards).
  FOR v_ended IN
    SELECT id FROM public.challenges
     WHERE company_id = v_company AND kind = 'habit'
       AND COALESCE(payload ->> 'finalized', 'false') <> 'true'
       AND end_date < v_today
  LOOP
    PERFORM public.finalize_habit_challenge(v_ended.id);
  END LOOP;

  SELECT * INTO c FROM public.challenges
   WHERE company_id = v_company AND kind = 'habit' AND active
     AND (team_id IS NULL OR team_id = v_team)
     AND start_date <= v_today
     AND end_date + CASE WHEN payload ->> 'check_mode' = 'next_morning' THEN 1 ELSE 0 END >= v_today
   ORDER BY start_date DESC LIMIT 1;

  IF c.id IS NOT NULL THEN
    v_status := 'active';
  ELSE
    SELECT * INTO c FROM public.challenges
     WHERE company_id = v_company AND kind = 'habit' AND active
       AND (team_id IS NULL OR team_id = v_team)
       AND start_date > v_today
     ORDER BY start_date LIMIT 1;
    IF c.id IS NULL THEN RETURN jsonb_build_object('status', 'none'); END IF;
    v_status := 'upcoming';
  END IF;

  v_target  := public.habit_target_date(c.payload, v_today);
  v_days    := public.habit_workdays(c.start_date, c.end_date);
  v_elapsed := (SELECT count(*)::int FROM unnest(v_days) d WHERE d <= v_target);
  v_members := public.habit_members(v_company, c.team_id);

  SELECT COALESCE(jsonb_agg(log_date ORDER BY log_date), '[]'::jsonb) INTO v_dates
    FROM public.habit_logs WHERE challenge_id = c.id AND user_id = v_uid;
  SELECT COUNT(*) INTO v_logs FROM public.habit_logs
   WHERE challenge_id = c.id AND log_date <= LEAST(v_target, c.end_date);

  RETURN jsonb_build_object(
    'status',       v_status,
    'challenge',    jsonb_build_object(
                      'id', c.id, 'title_en', c.title_en, 'title_ar', c.title_ar,
                      'start_date', c.start_date, 'end_date', c.end_date,
                      'team_id', c.team_id, 'payload', c.payload),
    'target_date',  v_target,
    'can_log',      v_status = 'active' AND v_target BETWEEN c.start_date AND c.end_date
                    AND EXTRACT(DOW FROM v_target) < 5,
    'logged_target', v_dates @> to_jsonb(v_target),
    'my_dates',     v_dates,
    'my_count',     jsonb_array_length(v_dates),
    'success_days', COALESCE((c.payload ->> 'success_days')::INT, 4),
    'days_total',   cardinality(v_days),
    'days',         to_jsonb(v_days),
    'weeks',        public.habit_weeks(c.payload),
    'elapsed',      v_elapsed,
    -- Shared progress only when the group is big enough to stay anonymous.
    'team_pct',     CASE WHEN v_members >= public.hr_min_cohort(v_company) AND v_elapsed > 0
                         THEN round(100.0 * v_logs / (v_members * v_elapsed)) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.log_habit(p_challenge_id UUID, p_done BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_team    UUID;
  c         public.challenges%ROWTYPE;
  v_target  DATE;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT team_id INTO v_team FROM public.profiles WHERE id = v_uid;
  SELECT * INTO c FROM public.challenges
   WHERE id = p_challenge_id AND kind = 'habit' AND active
     AND company_id = v_company AND (team_id IS NULL OR team_id = v_team);
  IF c.id IS NULL THEN RAISE EXCEPTION 'challenge_not_found' USING ERRCODE = 'P0002'; END IF;

  v_target := public.habit_target_date(c.payload, public.company_today(v_company));
  IF v_target < c.start_date OR v_target > c.end_date THEN
    RAISE EXCEPTION 'outside_challenge_window' USING ERRCODE = '22023';
  END IF;
  IF EXTRACT(DOW FROM v_target) >= 5 THEN
    RAISE EXCEPTION 'not_a_workday' USING ERRCODE = '22023';
  END IF;

  IF p_done THEN
    INSERT INTO public.habit_logs (challenge_id, user_id, company_id, log_date)
    VALUES (c.id, v_uid, v_company, v_target)
    ON CONFLICT (challenge_id, user_id, log_date) DO NOTHING;
    INSERT INTO public.challenge_participants (challenge_id, user_id, company_id)
    VALUES (c.id, v_uid, v_company)
    ON CONFLICT (challenge_id, user_id) DO NOTHING;
  ELSE
    DELETE FROM public.habit_logs
     WHERE challenge_id = c.id AND user_id = v_uid AND log_date = v_target;
  END IF;

  RETURN public.my_habit_challenge();
END;
$$;

-- Public templates and the company's own; a company template runs for its
-- payload.weeks (1–4) weeks from the Sunday given, Sun–Thu each week.
CREATE OR REPLACE FUNCTION public.hr_schedule_habit_challenge(
  p_template_id UUID, p_week_start DATE, p_team_id UUID DEFAULT NULL)
RETURNS public.challenges
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  t         public.challenge_templates%ROWTYPE;
  v_clash   public.challenges%ROWTYPE;
  v_row     public.challenges%ROWTYPE;
  v_weeks   INT;
  v_end     DATE;
  v_need    INT;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.challenge_templates
   WHERE id = p_template_id AND kind = 'habit' AND (company_id IS NULL OR company_id = v_company);
  IF t.id IS NULL THEN RAISE EXCEPTION 'template_not_found' USING ERRCODE = 'P0002'; END IF;
  IF t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'template_archived' USING ERRCODE = 'P0002'; END IF;
  IF EXTRACT(DOW FROM p_week_start) <> 0 THEN
    RAISE EXCEPTION 'week_must_start_on_sunday' USING ERRCODE = '22023';
  END IF;
  v_weeks := public.habit_weeks(t.payload);
  v_end   := p_week_start + 7 * (v_weeks - 1) + 4;
  v_need  := COALESCE(CASE WHEN t.payload ->> 'success_days' ~ '^\d{1,2}$' THEN (t.payload ->> 'success_days')::int END,
                      t.target, 4);
  IF v_end < public.company_today(v_company) THEN
    RAISE EXCEPTION 'week_in_the_past' USING ERRCODE = '22023';
  END IF;
  IF p_team_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.teams WHERE id = p_team_id AND company_id = v_company) THEN
    RAISE EXCEPTION 'team_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- A default the app put in gives way to HR's pick, as long as nobody has
  -- logged a day on it yet.
  DELETE FROM public.challenges d
   WHERE d.company_id = v_company AND d.kind = 'habit'
     AND d.payload ->> 'auto' = 'true'
     AND d.start_date <= v_end AND d.end_date >= p_week_start
     AND NOT EXISTS (SELECT 1 FROM public.habit_logs l WHERE l.challenge_id = d.id);

  -- One habit challenge at a time for the same people.
  SELECT * INTO v_clash FROM public.challenges
   WHERE company_id = v_company AND kind = 'habit' AND active
     AND start_date <= v_end AND end_date >= p_week_start
     AND (team_id IS NULL OR p_team_id IS NULL OR team_id = p_team_id)
   LIMIT 1;
  IF v_clash.id IS NOT NULL THEN
    RAISE EXCEPTION 'habit_week_taken' USING ERRCODE = '23P01',
      DETAIL = COALESCE(v_clash.title_ar, v_clash.title_en) || ' | ' || v_clash.title_en;
  END IF;

  INSERT INTO public.challenges (
    company_id, title_en, title_ar, description_en, description_ar,
    metric, goal_value, start_date, end_date, duration_days,
    badge_icon, badge_color, active, kind, template_id, team_id, payload)
  VALUES (
    v_company, t.title_en, t.title_ar, t.payload ->> 'action_en', t.payload ->> 'action_ar',
    'habit', v_need, p_week_start, v_end, v_weeks * 5,
    COALESCE(t.payload ->> 'badge_icon', 'trophy'), COALESCE(t.payload ->> 'badge_color', '#F5B544'),
    true, 'habit', t.id, p_team_id,
    t.payload || jsonb_build_object('weeks', v_weeks, 'success_days', v_need))
  RETURNING * INTO v_row;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'challenge.habit_scheduled',
          t.slug, v_row.id, 'info',
          jsonb_build_object('week_start', p_week_start, 'team_id', p_team_id, 'weeks', v_weeks));
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_cancel_habit_challenge(p_challenge_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.challenges SET active = false
   WHERE id = p_challenge_id AND company_id = v_company AND kind = 'habit'
     AND start_date > public.company_today(v_company);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'only_upcoming_can_be_cancelled' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_habit_challenges()
RETURNS TABLE (
  id UUID, title_en TEXT, title_ar TEXT, template_id UUID, team_id UUID, team_name TEXT,
  start_date DATE, end_date DATE, status TEXT,
  members INT, participants INT, completed INT, completion_pct NUMERIC, auto BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_company UUID := public.auth_company_id();
  v_floor   INT;
  v_today   DATE;
  r         RECORD;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_floor := public.hr_min_cohort(v_company);
  v_today := public.company_today(v_company);
  PERFORM public.ensure_default_habit_week(v_company);

  FOR r IN SELECT c.id FROM public.challenges c
            WHERE c.company_id = v_company AND c.kind = 'habit'
              AND COALESCE(c.payload ->> 'finalized', 'false') <> 'true' AND c.end_date < v_today
  LOOP
    PERFORM public.finalize_habit_challenge(r.id);
  END LOOP;

  RETURN QUERY
  WITH base AS (
    SELECT c.*, public.habit_members(v_company, c.team_id) AS n_members,
           COALESCE((c.payload ->> 'success_days')::INT, 4) AS need
      FROM public.challenges c
     WHERE c.company_id = v_company AND c.kind = 'habit'
  ), per_user AS (
    SELECT l.challenge_id, l.user_id, COUNT(*) AS days
      FROM public.habit_logs l JOIN base b ON b.id = l.challenge_id
     GROUP BY l.challenge_id, l.user_id
  )
  SELECT b.id, b.title_en, b.title_ar, b.template_id, b.team_id, tm.name,
         b.start_date, b.end_date,
         CASE WHEN NOT b.active THEN 'cancelled'
              WHEN b.start_date > v_today THEN 'upcoming'
              WHEN b.end_date + CASE WHEN b.payload ->> 'check_mode' = 'next_morning' THEN 1 ELSE 0 END >= v_today THEN 'active'
              ELSE 'done' END,
         b.n_members,
         (SELECT COUNT(*)::INT FROM per_user p WHERE p.challenge_id = b.id),
         (SELECT COUNT(*)::INT FROM per_user p WHERE p.challenge_id = b.id AND p.days >= b.need),
         CASE WHEN b.n_members >= v_floor
              THEN round(100.0 * (SELECT COUNT(*) FROM per_user p WHERE p.challenge_id = b.id AND p.days >= b.need) / b.n_members)
         END,
         COALESCE(b.payload ->> 'auto', 'false') = 'true'
    FROM base b LEFT JOIN public.teams tm ON tm.id = b.team_id
   ORDER BY b.start_date DESC;
END;
$$;

-- Template media edits also reach weeks still running (now incl. bucket).
CREATE OR REPLACE FUNCTION public.sync_template_media_to_challenges()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_keys CONSTANT TEXT[] := ARRAY['media_type', 'media_url', 'media_path', 'media_mime', 'media_youtube_id', 'media_bucket'];
  v_new  JSONB;
  v_old  JSONB;
BEGIN
  IF NEW.kind <> 'habit' THEN RETURN NEW; END IF;
  SELECT COALESCE(jsonb_object_agg(k, NEW.payload -> k), '{}'::jsonb) INTO v_new
    FROM unnest(v_keys) AS k WHERE NEW.payload ? k;
  SELECT COALESCE(jsonb_object_agg(k, OLD.payload -> k), '{}'::jsonb) INTO v_old
    FROM unnest(v_keys) AS k WHERE OLD.payload ? k;
  IF v_new = v_old THEN RETURN NEW; END IF;

  UPDATE public.challenges c
     SET payload = (c.payload - v_keys) || v_new
   WHERE c.template_id = NEW.id AND c.kind = 'habit'
     AND c.end_date + 1 >= public.company_today(c.company_id)   -- +1: evening habits log the morning after
     AND COALESCE(c.payload ->> 'finalized', 'false') <> 'true';
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 11. Score: routine points
-- ═══════════════════════════════════════════════════════════════
--   +10  each habit-challenge day logged            (habit_day)
--   +20  completing a habit challenge               (week_done)
--   +5   each article read to the end               (article)
--   +2   each routine item ticked, max 20 a day     (routine_item; the
--        11th tick on a day and later rows carry 0)
--   +10  a day with every routine item done         (routine_day)
CREATE OR REPLACE FUNCTION public.score_events(p_company_id UUID)
RETURNS TABLE (user_id UUID, wk DATE, kind TEXT, pts INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.user_id, l.log_date - EXTRACT(DOW FROM l.log_date)::INT, 'habit_day', 10
    FROM public.habit_logs l
   WHERE l.company_id = p_company_id
  UNION ALL
  SELECT x.user_id, x.wk, 'week_done', 20 FROM (
    SELECT l.user_id, c.start_date - EXTRACT(DOW FROM c.start_date)::INT AS wk
      FROM public.habit_logs l
      JOIN public.challenges c ON c.id = l.challenge_id
     WHERE l.company_id = p_company_id
     GROUP BY l.challenge_id, l.user_id, c.start_date, c.payload
    HAVING COUNT(*) >= COALESCE((c.payload ->> 'success_days')::INT, 4)
  ) x
  UNION ALL
  SELECT a.user_id, a.d - EXTRACT(DOW FROM a.d)::INT, 'article', 5
    FROM (SELECT p.user_id, COALESCE(p.finished_at, p.started_at)::DATE AS d
            FROM public.content_progress p
            JOIN public.content_items i ON i.id = p.item_id AND i.kind = 'article'
           WHERE p.company_id = p_company_id AND p.completed) a
  UNION ALL
  SELECT c.user_id, c.check_date - EXTRACT(DOW FROM c.check_date)::INT, 'routine_item',
         CASE WHEN row_number() OVER (PARTITION BY c.user_id, c.check_date ORDER BY c.checked_at, c.id) <= 10
              THEN 2 ELSE 0 END
    FROM public.routine_checks c
   WHERE c.company_id = p_company_id
  UNION ALL
  SELECT d.user_id, d.day - EXTRACT(DOW FROM d.day)::INT, 'routine_day', 10
    FROM public.routine_days d
   WHERE d.company_id = p_company_id AND d.all_done;
$$;

-- Same as before (week_start from the company's today) plus routine parts:
--   week_parts / total_parts  + routine_items, routine_full_days
--   routine { streak, best_streak, week_days }
CREATE OR REPLACE FUNCTION public.my_scorecard()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_team    UUID;
  v_today   DATE;
  v_week    DATE;
  v_floor   INT;
  v_me      JSONB;
  v_team_j  JSONB;
  v_comp_j  JSONB;
  v_streak  INT;
  v_best    INT;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT team_id INTO v_team FROM public.profiles WHERE id = v_uid;
  v_floor := public.hr_min_cohort(v_company);
  v_today := public.company_today(v_company);
  v_week  := v_today - EXTRACT(DOW FROM v_today)::INT;

  WITH ev AS (SELECT * FROM public.score_events(v_company) e WHERE e.user_id = v_uid),
       w  AS (SELECT (v_week - 7 * g)::DATE AS wk FROM generate_series(0, 5) g)
  SELECT jsonb_build_object(
    'week',  COALESCE((SELECT SUM(pts) FROM ev WHERE wk = v_week), 0),
    'total', COALESCE((SELECT SUM(pts) FROM ev), 0),
    'best_week', COALESCE((SELECT MAX(s) FROM (SELECT SUM(pts) s FROM ev GROUP BY wk) b), 0),
    'week_parts', jsonb_build_object(
      'habit_days',        (SELECT COUNT(*) FROM ev WHERE wk = v_week AND kind = 'habit_day'),
      'weeks_done',        (SELECT COUNT(*) FROM ev WHERE wk = v_week AND kind = 'week_done'),
      'articles',          (SELECT COUNT(*) FROM ev WHERE wk = v_week AND kind = 'article'),
      'routine_items',     (SELECT COUNT(*) FROM ev WHERE wk = v_week AND kind = 'routine_item'),
      'routine_full_days', (SELECT COUNT(*) FROM ev WHERE wk = v_week AND kind = 'routine_day')),
    'total_parts', jsonb_build_object(
      'habit_days',        (SELECT COUNT(*) FROM ev WHERE kind = 'habit_day'),
      'weeks_done',        (SELECT COUNT(*) FROM ev WHERE kind = 'week_done'),
      'articles',          (SELECT COUNT(*) FROM ev WHERE kind = 'article'),
      'routine_items',     (SELECT COUNT(*) FROM ev WHERE kind = 'routine_item'),
      'routine_full_days', (SELECT COUNT(*) FROM ev WHERE kind = 'routine_day')),
    'weekly', (SELECT jsonb_agg(jsonb_build_object(
                        'week_start', w.wk,
                        'points', COALESCE((SELECT SUM(pts) FROM ev WHERE ev.wk = w.wk), 0))
                      ORDER BY w.wk) FROM w))
    INTO v_me;

  SELECT s.streak, s.best INTO v_streak, v_best FROM public.routine_streaks(v_company, v_today, v_uid) s;
  v_me := v_me || jsonb_build_object('routine', jsonb_build_object(
    'streak',      COALESCE(v_streak, 0),
    'best_streak', COALESCE(v_best, 0),
    'week_days',   (SELECT count(*) FROM public.routine_days d
                     WHERE d.user_id = v_uid AND d.day BETWEEN v_week AND v_week + 6)));

  -- Group numbers only for groups big enough to stay anonymous.
  IF v_team IS NOT NULL AND public.habit_members(v_company, v_team) >= v_floor THEN
    v_team_j := public.score_group(v_company, v_team, v_week)
                || jsonb_build_object('name', (SELECT name FROM public.teams WHERE id = v_team));
  END IF;
  IF public.habit_members(v_company, NULL) >= v_floor THEN
    v_comp_j := public.score_group(v_company, NULL, v_week);
  END IF;

  RETURN jsonb_build_object(
    'week_start', v_week,
    'me',         v_me,
    'team',       v_team_j,
    'company',    v_comp_j
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 12. HR reports
-- ═══════════════════════════════════════════════════════════════

-- Routine report, aggregate only. p_range '7d' | '14d' (default) | '30d' |
-- '90d', counted back from the company's today. People are counted, never
-- named. Teams under the company's minimum cohort are grouped into one
-- "small teams" row (shown only if that group itself reaches the floor).
-- Company-level percentages are null when the company is under the floor.
-- Exercises are ranked, not people, so they have no floor.
CREATE OR REPLACE FUNCTION public.hr_routine_report(p_range TEXT DEFAULT '14d')
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company  UUID := public.auth_company_id();
  v_days     INT := CASE p_range WHEN '7d' THEN 7 WHEN '30d' THEN 30 WHEN '90d' THEN 90 ELSE 14 END;
  v_tz       TEXT;
  v_today    DATE;
  v_from     DATE;
  v_floor    INT;
  v_members  INT;
  v_sup      BOOLEAN;
  v_out      JSONB;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_tz      := public.company_tz(v_company);
  v_today   := public.company_today(v_company);
  v_from    := v_today - (v_days - 1);
  v_floor   := public.hr_min_cohort(v_company);
  v_members := public.habit_members(v_company, NULL);
  v_sup     := v_members < v_floor;

  WITH tm AS (
    SELECT p.team_id, count(*)::int AS members
      FROM public.profiles p
     WHERE p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded
     GROUP BY p.team_id
  ), cal AS (
    SELECT d::date AS day FROM generate_series(v_from, v_today, interval '1 day') d
  ), grid AS (
    SELECT tm.team_id, tm.members, cal.day, di.item_id
      FROM tm CROSS JOIN cal
     CROSS JOIN LATERAL public.routine_due_items(v_company, tm.team_id, cal.day) di
  ), gi AS (
    SELECT g.*, COALESCE(i.exercise_id, i.id) AS ex_key, i.exercise_id,
           COALESCE(nullif(btrim(i.title_en), ''), e.name_en) AS title_en,
           COALESCE(nullif(btrim(i.title_ar), ''), e.name_ar) AS title_ar
      FROM grid g
      JOIN public.routine_items i ON i.id = g.item_id
      LEFT JOIN public.exercises e ON e.id = i.exercise_id
  ), td AS (
    SELECT team_id, day, max(members)::int AS members, count(*)::int AS items
      FROM grid GROUP BY team_id, day
  ), chk AS (
    SELECT c.user_id, c.check_date, c.checked_at, c.item_id, c.exercise_id, p.team_id
      FROM public.routine_checks c
      JOIN public.profiles p ON p.id = c.user_id
     WHERE c.company_id = v_company AND c.check_date BETWEEN v_from AND v_today
       AND p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded
  ), fulls AS (
    SELECT d.day, count(*)::int AS n
      FROM public.routine_days d
      JOIN public.profiles p ON p.id = d.user_id
     WHERE d.company_id = v_company AND d.all_done AND d.day BETWEEN v_from AND v_today
       AND p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded
     GROUP BY d.day
  ), by_day AS (
    SELECT cal.day,
           COALESCE((SELECT sum(td.members) FROM td WHERE td.day = cal.day), 0)::int AS assigned,
           COALESCE((SELECT sum(td.members * td.items) FROM td WHERE td.day = cal.day), 0)::int AS due,
           (SELECT count(*) FROM chk WHERE chk.check_date = cal.day)::int AS done,
           (SELECT count(DISTINCT chk.user_id) FROM chk WHERE chk.check_date = cal.day)::int AS active,
           COALESCE((SELECT f.n FROM fulls f WHERE f.day = cal.day), 0)::int AS full_days
      FROM cal
  ), ts AS (
    SELECT tm.team_id, tm.members,
           COALESCE((SELECT sum(td.members * td.items) FROM td WHERE td.team_id IS NOT DISTINCT FROM tm.team_id), 0)::int AS due,
           (SELECT count(*) FROM td WHERE td.team_id IS NOT DISTINCT FROM tm.team_id)::int AS due_days,
           (SELECT count(*) FROM chk WHERE chk.team_id IS NOT DISTINCT FROM tm.team_id)::int AS done,
           (SELECT count(DISTINCT chk.user_id) FROM chk WHERE chk.team_id IS NOT DISTINCT FROM tm.team_id)::int AS active,
           tm.team_id IS NOT NULL AND tm.members >= v_floor AS shown,
           tm.team_id IS NULL AND tm.members >= v_floor AS no_team
      FROM tm
  ), small AS (
    SELECT count(*)::int AS teams, COALESCE(sum(members), 0)::int AS members, COALESCE(sum(due), 0)::int AS due,
           COALESCE(sum(done), 0)::int AS done, COALESCE(sum(active), 0)::int AS active,
           COALESCE(sum(members * due_days), 0)::int AS person_days
      FROM ts WHERE NOT ts.shown AND NOT ts.no_team AND ts.due_days > 0
  ), team_rows AS (
    SELECT jsonb_build_object(
             'team_id', ts.team_id, 'name', t.name, 'department', t.department,
             'small', false, 'no_team', ts.no_team, 'teams', 1,
             'members', ts.members, 'active', ts.active,
             'active_pct', round(100.0 * ts.active / ts.members),
             'done', ts.done, 'due', ts.due,
             'completion_pct', CASE WHEN ts.due > 0 THEN LEAST(100, round(100.0 * ts.done / ts.due)) END,
             'avg_items_per_day', CASE WHEN ts.due_days > 0 THEN round(ts.done::numeric / (ts.members * ts.due_days), 1) END
           ) AS j,
           CASE WHEN ts.due > 0 THEN ts.done::numeric / ts.due ELSE -1 END AS rank_key
      FROM ts LEFT JOIN public.teams t ON t.id = ts.team_id
     WHERE (ts.shown OR ts.no_team) AND ts.due_days > 0
    UNION ALL
    SELECT jsonb_build_object(
             'team_id', NULL, 'name', NULL, 'department', NULL,
             'small', true, 'no_team', false, 'teams', s.teams,
             'members', s.members, 'active', s.active,
             'active_pct', round(100.0 * s.active / s.members),
             'done', s.done, 'due', s.due,
             'completion_pct', CASE WHEN s.due > 0 THEN LEAST(100, round(100.0 * s.done / s.due)) END,
             'avg_items_per_day', CASE WHEN s.person_days > 0 THEN round(s.done::numeric / s.person_days, 1) END),
           -2
      FROM small s WHERE s.members >= v_floor
  ), ex_due AS (
    SELECT gi.ex_key, (array_agg(gi.exercise_id))[1] AS exercise_id,
           (array_agg(gi.title_en))[1] AS title_en, (array_agg(gi.title_ar))[1] AS title_ar,
           sum(gi.members)::int AS due
      FROM gi GROUP BY gi.ex_key
  ), ex_done AS (
    SELECT COALESCE(chk.exercise_id, chk.item_id) AS ex_key, count(*)::int AS done
      FROM chk GROUP BY 1
  ), hours AS (
    SELECT EXTRACT(HOUR FROM chk.checked_at AT TIME ZONE v_tz)::int AS hr, count(*)::int AS n
      FROM chk GROUP BY 1
  )
  SELECT jsonb_build_object(
    'range',       p_range,
    'from',        v_from,
    'to',          v_today,
    'timezone',    v_tz,
    'min_cohort',  v_floor,
    'members',     v_members,
    'suppressed',  v_sup,
    'has_routine', EXISTS (SELECT 1 FROM public.routine_assignments a
                            WHERE a.company_id = v_company AND a.active
                              AND (a.ends_on IS NULL OR a.ends_on >= v_today)),
    'today', (SELECT jsonb_build_object(
                'date', b.day, 'assigned', b.assigned, 'active', b.active, 'done', b.done, 'due', b.due,
                'full_days', b.full_days,
                'pct', CASE WHEN NOT v_sup AND b.due > 0 THEN LEAST(100, round(100.0 * b.done / b.due)) END,
                'active_pct', CASE WHEN NOT v_sup AND b.assigned > 0 THEN round(100.0 * b.active / b.assigned) END)
                FROM by_day b WHERE b.day = v_today),
    'totals', (SELECT jsonb_build_object(
                 'done', COALESCE(sum(b.done), 0), 'due', COALESCE(sum(b.due), 0),
                 'full_days', COALESCE(sum(b.full_days), 0),
                 'active_people', (SELECT count(DISTINCT chk.user_id) FROM chk),
                 'completion_pct', CASE WHEN NOT v_sup AND sum(b.due) > 0
                                        THEN LEAST(100, round(100.0 * sum(b.done) / sum(b.due))) END)
                 FROM by_day b),
    'by_day', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'date', b.day, 'weekday', EXTRACT(DOW FROM b.day)::int,
                 'assigned', b.assigned, 'active', b.active, 'done', b.done, 'due', b.due, 'full_days', b.full_days,
                 'pct', CASE WHEN NOT v_sup AND b.due > 0 THEN LEAST(100, round(100.0 * b.done / b.due)) END,
                 'active_pct', CASE WHEN NOT v_sup AND b.assigned > 0 THEN round(100.0 * b.active / b.assigned) END)
               ORDER BY b.day), '[]'::jsonb)
                 FROM by_day b WHERE b.due > 0 OR b.done > 0),
    'by_team', (SELECT COALESCE(jsonb_agg(tr.j ORDER BY tr.rank_key DESC, tr.j ->> 'name'), '[]'::jsonb) FROM team_rows tr),
    'small_teams_hidden', EXISTS (SELECT 1 FROM small s WHERE s.members > 0 AND s.members < v_floor),
    'by_exercise', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                      'key', d.ex_key, 'exercise_id', d.exercise_id, 'title_en', d.title_en, 'title_ar', d.title_ar,
                      'done', COALESCE(x.done, 0), 'due', d.due,
                      'pct', CASE WHEN d.due > 0 THEN LEAST(100, round(100.0 * COALESCE(x.done, 0) / d.due)) END)
                    ORDER BY CASE WHEN d.due > 0 THEN COALESCE(x.done, 0)::numeric / d.due END DESC NULLS LAST,
                             COALESCE(x.done, 0) DESC, d.title_en), '[]'::jsonb)
                      FROM ex_due d LEFT JOIN ex_done x ON x.ex_key = d.ex_key),
    'by_hour', (SELECT jsonb_agg(jsonb_build_object('hour', h, 'checks', COALESCE(hours.n, 0)) ORDER BY h)
                  FROM generate_series(0, 23) h LEFT JOIN hours ON hours.hr = h))
    INTO v_out;
  RETURN v_out;
END;
$$;

-- Per-person view, opt-in only. Only when the company switched
-- hr_people_view on, and only people who chose "share my progress with
-- HR". Everyone else is a count. Effort only: days active, items ticked,
-- full days, streak, last active.
CREATE OR REPLACE FUNCTION public.hr_routine_people(p_range TEXT DEFAULT '14d')
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_days    INT := CASE p_range WHEN '7d' THEN 7 WHEN '30d' THEN 30 WHEN '90d' THEN 90 ELSE 14 END;
  v_today   DATE;
  v_from    DATE;
  v_members INT;
  v_people  JSONB;
  v_n       INT;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_today   := public.company_today(v_company);
  v_from    := v_today - (v_days - 1);
  v_members := public.habit_members(v_company, NULL);

  IF NOT (public.company_settings_json(v_company) ->> 'hr_people_view')::boolean THEN
    RETURN jsonb_build_object('enabled', false, 'range', p_range, 'from', v_from, 'to', v_today,
                              'people', '[]'::jsonb, 'opted_in', 0, 'not_shared', v_members);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'user_id', p.id, 'display_name', p.display_name, 'initials', p.initials, 'avatar_kind', p.avatar_kind,
           'team_id', p.team_id, 'team_name', t.name,
           'days_active', COALESCE(x.days, 0), 'items_done', COALESCE(x.items, 0),
           'full_days', COALESCE(f.n, 0), 'streak', COALESCE(s.streak, 0), 'last_active', x.last)
         ORDER BY COALESCE(x.items, 0) DESC, p.display_name), '[]'::jsonb),
         count(*)::int
    INTO v_people, v_n
    FROM public.profiles p
    JOIN public.profile_prefs pp ON pp.user_id = p.id AND pp.share_with_hr
    LEFT JOIN public.teams t ON t.id = p.team_id
    LEFT JOIN LATERAL (SELECT count(*)::int AS items, count(DISTINCT c.check_date)::int AS days, max(c.check_date) AS last
                         FROM public.routine_checks c
                        WHERE c.user_id = p.id AND c.company_id = v_company
                          AND c.check_date BETWEEN v_from AND v_today) x ON true
    LEFT JOIN LATERAL (SELECT count(*)::int AS n FROM public.routine_days d
                        WHERE d.user_id = p.id AND d.all_done AND d.day BETWEEN v_from AND v_today) f ON true
    LEFT JOIN public.routine_streaks(v_company, v_today) s ON s.user_id = p.id
   WHERE p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded;

  RETURN jsonb_build_object('enabled', true, 'range', p_range, 'from', v_from, 'to', v_today,
                            'people', v_people, 'opted_in', v_n, 'not_shared', GREATEST(v_members - v_n, 0));
END;
$$;

-- HR dashboard: same as before (company-local dates now) plus a routine
-- block and routine_active per week.
CREATE OR REPLACE FUNCTION public.hr_participation_overview(p_range TEXT DEFAULT '30d')
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company UUID := public.auth_company_id();
  v_days    INT  := CASE p_range WHEN '7d' THEN 7 WHEN '90d' THEN 90 ELSE 30 END;
  v_today   DATE;
  v_start   DATE;
  v_floor   INT;
  v_members INT;
  v_took    INT;
  v_done    INT;
  v_readers INT;
  v_reads   INT;
  v_fin     INT;
  v_current JSONB;
  v_top     JSONB;
  v_weekly  JSONB;
  v_routine JSONB;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_today   := public.company_today(v_company);
  v_start   := v_today - v_days;
  v_floor   := public.hr_min_cohort(v_company);
  v_members := public.habit_members(v_company, NULL);

  SELECT COUNT(DISTINCT l.user_id) INTO v_took
    FROM public.habit_logs l
   WHERE l.company_id = v_company AND l.log_date >= v_start;

  SELECT COUNT(DISTINCT x.user_id) INTO v_done FROM (
    SELECT l.user_id
      FROM public.habit_logs l
      JOIN public.challenges c ON c.id = l.challenge_id
     WHERE l.company_id = v_company AND c.end_date >= v_start
     GROUP BY l.challenge_id, l.user_id, c.payload
    HAVING COUNT(*) >= COALESCE((c.payload ->> 'success_days')::INT, 4)
  ) x;

  SELECT COUNT(DISTINCT p.user_id), COUNT(*), COUNT(*) FILTER (WHERE p.completed)
    INTO v_readers, v_reads, v_fin
    FROM public.content_progress p
    JOIN public.content_items i ON i.id = p.item_id AND i.kind = 'article'
   WHERE p.company_id = v_company AND p.started_at >= v_start;

  SELECT to_jsonb(h) INTO v_current FROM (
    SELECT r.id, r.title_en, r.title_ar, r.team_name, r.start_date, r.end_date,
           r.status, r.members, r.participants, r.completed, r.completion_pct
      FROM public.hr_habit_challenges() r
     WHERE r.status IN ('active', 'upcoming')
     ORDER BY (r.status = 'active') DESC, r.start_date
     LIMIT 1
  ) h;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.reads DESC, t.title_en), '[]'::jsonb) INTO v_top FROM (
    SELECT i.id, i.title_en, i.title_ar, COUNT(*) AS reads
      FROM public.content_progress p
      JOIN public.content_items i ON i.id = p.item_id AND i.kind = 'article'
     WHERE p.company_id = v_company AND p.started_at >= v_start
     GROUP BY i.id, i.title_en, i.title_ar
     ORDER BY COUNT(*) DESC
     LIMIT 5
  ) t;

  SELECT jsonb_agg(jsonb_build_object(
           'week_start', w.wk,
           'took_part', (SELECT COUNT(DISTINCT l.user_id) FROM public.habit_logs l
                          WHERE l.company_id = v_company AND l.log_date >= w.wk AND l.log_date < w.wk + 7),
           'readers',   (SELECT COUNT(DISTINCT p.user_id) FROM public.content_progress p
                          WHERE p.company_id = v_company AND p.started_at >= w.wk AND p.started_at < w.wk + 7),
           'routine_active', (SELECT COUNT(DISTINCT c.user_id) FROM public.routine_checks c
                               WHERE c.company_id = v_company AND c.check_date >= w.wk AND c.check_date < w.wk + 7))
         ORDER BY w.wk)
    INTO v_weekly
    FROM (SELECT (v_today - EXTRACT(DOW FROM v_today)::INT - 7 * g)::DATE AS wk
            FROM generate_series(0, 7) g) w;

  -- Today's routine numbers (people counted, not named).
  WITH tm AS (
    SELECT p.team_id, count(*)::int AS members FROM public.profiles p
     WHERE p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded GROUP BY p.team_id
  ), td AS (
    SELECT tm.team_id, tm.members,
           (SELECT count(*) FROM public.routine_due_items(v_company, tm.team_id, v_today))::int AS items
      FROM tm
  )
  SELECT jsonb_build_object(
    'has_routine',     EXISTS (SELECT 1 FROM public.routine_assignments a
                                WHERE a.company_id = v_company AND a.active
                                  AND (a.ends_on IS NULL OR a.ends_on >= v_today)),
    'assigned_today',  COALESCE((SELECT sum(members) FROM td WHERE items > 0), 0),
    'due_today',       COALESCE((SELECT sum(members * items) FROM td), 0),
    'done_today',      (SELECT count(*) FROM public.routine_checks c
                         WHERE c.company_id = v_company AND c.check_date = v_today),
    'active_today',    (SELECT count(DISTINCT c.user_id) FROM public.routine_checks c
                         WHERE c.company_id = v_company AND c.check_date = v_today),
    'active_in_range', (SELECT count(DISTINCT c.user_id) FROM public.routine_checks c
                         WHERE c.company_id = v_company AND c.check_date >= v_start))
    INTO v_routine;
  v_routine := v_routine || jsonb_build_object('pct_today',
    CASE WHEN v_members >= v_floor AND (v_routine ->> 'due_today')::int > 0
         THEN LEAST(100, round(100.0 * (v_routine ->> 'done_today')::int / (v_routine ->> 'due_today')::int)) END);

  RETURN jsonb_build_object(
    'range',             p_range,
    'members',           v_members,
    'took_part',         v_took,
    'completed',         v_done,
    'readers',           v_readers,
    'reads',             v_reads,
    'finished_reads',    v_fin,
    'participation_pct', CASE WHEN v_members >= v_floor AND v_members > 0
                              THEN round(100.0 * v_took / v_members) END,
    'min_cohort',        v_floor,
    'current',           v_current,
    'top_articles',      v_top,
    'weekly',            COALESCE(v_weekly, '[]'::jsonb),
    'routine',           v_routine
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 13. Recognition board
-- ═══════════════════════════════════════════════════════════════

-- For everyone in the company, only when HR turned recognition on.
-- p_period 'today' | 'week' (Sun → today). Effort only, never health:
--   teams  every team at/over the minimum cohort, by % of members active,
--          then % of due items done. No names. Small teams left out.
--   named  (recognition = 'named') opted-in people only:
--          top              most items ticked in the period (> 0)
--          did_everything   opted-in names who did every item today,
--                           + more = everyone else who did (a count)
--          longest_streak   longest current streaks
--          Never a bottom list.
--   me     my own opt-in, items in the period, streak
CREATE OR REPLACE FUNCTION public.recognition_board(p_period TEXT DEFAULT 'today', p_limit INT DEFAULT 5)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_mode    TEXT;
  v_today   DATE;
  v_from    DATE;
  v_floor   INT;
  v_limit   INT := LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20);
  v_opt     BOOLEAN;
  v_teams   JSONB;
  v_named   JSONB;
  v_me      JSONB;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p_period, 'today') NOT IN ('today', 'week') THEN
    RAISE EXCEPTION 'bad_period' USING ERRCODE = '22023';
  END IF;
  v_mode  := public.company_settings_json(v_company) ->> 'recognition';
  v_today := public.company_today(v_company);
  v_from  := CASE WHEN p_period = 'week' THEN v_today - EXTRACT(DOW FROM v_today)::int ELSE v_today END;
  v_floor := public.hr_min_cohort(v_company);
  SELECT COALESCE(pp.recognition_opt_in, false) INTO v_opt FROM public.profile_prefs pp WHERE pp.user_id = v_uid;
  v_opt := COALESCE(v_opt, false);

  SELECT jsonb_build_object(
           'opted_in',   v_opt,
           'items_done', (SELECT count(*) FROM public.routine_checks c
                           WHERE c.user_id = v_uid AND c.check_date BETWEEN v_from AND v_today),
           'streak',     COALESCE((SELECT s.streak FROM public.routine_streaks(v_company, v_today, v_uid) s), 0))
    INTO v_me;

  IF v_mode = 'off' THEN
    RETURN jsonb_build_object('enabled', false, 'mode', 'off', 'period', COALESCE(p_period, 'today'),
                              'from', v_from, 'to', v_today, 'teams', '[]'::jsonb, 'named', NULL, 'me', v_me);
  END IF;

  WITH tm AS (
    SELECT p.team_id, count(*)::int AS members FROM public.profiles p
     WHERE p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded AND p.team_id IS NOT NULL
     GROUP BY p.team_id HAVING count(*) >= v_floor
  ), cal AS (
    SELECT d::date AS day FROM generate_series(v_from, v_today, interval '1 day') d
  ), td AS (
    SELECT tm.team_id, tm.members, cal.day,
           (SELECT count(*) FROM public.routine_due_items(v_company, tm.team_id, cal.day))::int AS items
      FROM tm CROSS JOIN cal
  ), chk AS (
    SELECT c.user_id, p.team_id FROM public.routine_checks c
      JOIN public.profiles p ON p.id = c.user_id
     WHERE c.company_id = v_company AND c.check_date BETWEEN v_from AND v_today
       AND p.deleted_at IS NULL AND p.onboarded
  ), ts AS (
    SELECT tm.team_id, tm.members,
           COALESCE((SELECT sum(td.members * td.items) FROM td WHERE td.team_id = tm.team_id), 0)::int AS due,
           (SELECT count(*) FROM chk WHERE chk.team_id = tm.team_id)::int AS done,
           (SELECT count(DISTINCT chk.user_id) FROM chk WHERE chk.team_id = tm.team_id)::int AS active
      FROM tm
  ), ranked AS (
    SELECT ts.*, t.name,
           round(100.0 * ts.active / ts.members) AS active_pct,
           CASE WHEN ts.due > 0 THEN LEAST(100, round(100.0 * ts.done / ts.due)) END AS completion_pct
      FROM ts JOIN public.teams t ON t.id = ts.team_id
     WHERE ts.due > 0
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'team_id', r.team_id, 'name', r.name, 'members', r.members, 'active', r.active,
           'active_pct', r.active_pct, 'completion_pct', r.completion_pct,
           'rank', dense_rank_val)
         ORDER BY r.active_pct DESC, r.completion_pct DESC NULLS LAST, r.name), '[]'::jsonb)
    INTO v_teams
    FROM (SELECT ranked.*, dense_rank() OVER (ORDER BY ranked.active_pct DESC, ranked.completion_pct DESC NULLS LAST) AS dense_rank_val
            FROM ranked) r;

  IF v_mode = 'named' THEN
    WITH opted AS (
      SELECT p.id, p.display_name, p.initials, p.avatar_kind
        FROM public.profiles p
        JOIN public.profile_prefs pp ON pp.user_id = p.id AND pp.recognition_opt_in
       WHERE p.company_id = v_company AND p.deleted_at IS NULL AND p.onboarded
    ), strk AS (
      SELECT * FROM public.routine_streaks(v_company, v_today)
    ), stats AS (
      SELECT o.*,
             (SELECT count(*) FROM public.routine_checks c
               WHERE c.user_id = o.id AND c.company_id = v_company
                 AND c.check_date BETWEEN v_from AND v_today)::int AS items_done,
             (SELECT count(*) FROM public.routine_days d
               WHERE d.user_id = o.id AND d.all_done AND d.day BETWEEN v_from AND v_today)::int AS full_days,
             EXISTS (SELECT 1 FROM public.routine_days d
                      WHERE d.user_id = o.id AND d.all_done AND d.day = v_today) AS full_today,
             COALESCE(s.streak, 0) AS streak
        FROM opted o
        LEFT JOIN strk s ON s.user_id = o.id
    ), did_all AS (
      SELECT count(*)::int AS n FROM public.routine_days d
        JOIN public.profiles p ON p.id = d.user_id
       WHERE d.company_id = v_company AND d.all_done AND d.day = v_today
         AND p.deleted_at IS NULL AND p.onboarded
    ), shown AS (
      SELECT s.* FROM stats s WHERE s.full_today ORDER BY s.display_name LIMIT v_limit
    )
    SELECT jsonb_build_object(
      'opted_in', (SELECT count(*) FROM opted),
      'top', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'user_id', s.id, 'display_name', s.display_name, 'initials', s.initials, 'avatar_kind', s.avatar_kind,
                'items_done', s.items_done, 'full_days', s.full_days, 'streak', s.streak)
              ORDER BY s.items_done DESC, s.streak DESC, s.display_name), '[]'::jsonb)
                FROM (SELECT * FROM stats WHERE items_done > 0
                       ORDER BY items_done DESC, streak DESC, display_name LIMIT v_limit) s),
      'did_everything', jsonb_build_object(
        'names', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'user_id', s.id, 'display_name', s.display_name, 'initials', s.initials,
                    'avatar_kind', s.avatar_kind) ORDER BY s.display_name), '[]'::jsonb) FROM shown s),
        'more',  GREATEST((SELECT n FROM did_all) - (SELECT count(*) FROM shown), 0)),
      'longest_streak', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                           'user_id', s.id, 'display_name', s.display_name, 'initials', s.initials,
                           'avatar_kind', s.avatar_kind, 'streak', s.streak)
                         ORDER BY s.streak DESC, s.display_name), '[]'::jsonb)
                           FROM (SELECT * FROM stats WHERE streak > 0
                                  ORDER BY streak DESC, display_name LIMIT v_limit) s))
      INTO v_named;
  END IF;

  RETURN jsonb_build_object('enabled', true, 'mode', v_mode, 'period', COALESCE(p_period, 'today'),
                            'from', v_from, 'to', v_today, 'teams', v_teams, 'named', v_named, 'me', v_me);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 14. Grants
-- ═══════════════════════════════════════════════════════════════

-- Internal helpers: not callable by app users.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname IN (
                'company_tz', 'clock_now', 'company_now', 'company_today', 'wd_ord', 'habit_workdays',
                'jtxt', 'company_settings_json', 'routine_assignments_for', 'routine_due_items',
                'refresh_routine_day', 'routine_streaks', 'assert_library_writer', 'check_media_path',
                'check_media', 'parse_weekday', 'parse_clock', 'parse_youtube_id', 'slugify_text',
                'habit_weeks', 'ensure_default_habit_week', 'finalize_habit_challenge',
                'score_events', 'score_group', 'routine_items_guard', 'routine_assignments_guard',
                'sync_template_media_to_challenges')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- The two-argument habit_target_date is internal; the old one stays an RPC.
REVOKE EXECUTE ON FUNCTION public.habit_target_date(JSONB, DATE) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.habit_target_date(JSONB, DATE) TO service_role;

-- RLS helpers: policies evaluated for signed-in users call these.
REVOKE EXECUTE ON FUNCTION public.library_hidden(TEXT, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.library_hidden(TEXT, UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.exercise_body_areas() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.exercise_body_areas() TO authenticated, service_role;

-- RPCs: signed-in only. Each checks the caller inside.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND (p.proname IN (
                'my_company_settings', 'hr_set_company_settings', 'my_prefs', 'set_my_prefs',
                'my_today', 'check_routine_item', 'my_routine_week', 'routine_detail',
                'save_exercise', 'save_routine', 'save_content_item', 'hr_save_challenge_template',
                'set_library_status', 'hr_copy_exercise', 'hr_copy_routine',
                'hr_assign_routine', 'hr_end_routine_assignment', 'hr_routine_assignments',
                'hr_import_routine', 'hr_set_library_pref', 'library_list',
                'my_habit_challenge', 'log_habit', 'hr_schedule_habit_challenge',
                'hr_cancel_habit_challenge', 'hr_habit_challenges', 'my_scorecard',
                'hr_routine_report', 'hr_routine_people', 'hr_participation_overview',
                'recognition_board')
                OR p.oid = 'public.habit_target_date(jsonb)'::regprocedure)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- Checks after running:
--   SELECT tablename, policyname, cmd, qual FROM pg_policies
--    WHERE schemaname = 'public' AND tablename IN ('content_items', 'challenge_templates') ORDER BY 1, 2;
--     → content_items: content_items_read, content_items_wadmin_all, service_role_content
--       challenge_templates: challenge_templates_read, challenge_templates_wadmin_all
--   SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE 'company_media%';
--     → 4 rows
--   SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'company-media';
--     → company-media | f | 52428800
