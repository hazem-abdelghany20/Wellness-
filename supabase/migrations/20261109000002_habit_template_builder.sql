-- Habit template builder + how-to media.
--
-- Wellness House admins now write habit templates in the admin console and
-- company HR picks and schedules them. New template fields live in
-- challenge_templates.payload, next to the keys the app already reads:
--
--   category          movement | sleep | mood | hydration | stress
--   media_type        video | image | youtube
--   media_url         public URL in the content-assets bucket (video / image)
--   media_path        object path in content-assets (video / image)
--   media_mime        video/mp4 | video/quicktime | image/png | image/jpeg
--   media_youtube_id  11-character YouTube video id (youtube)
--
-- 1. challenge_templates.archived_at. Archived templates leave HR's picker
--    and the default-week rotation and can't be newly scheduled. Weeks
--    already scheduled keep running: a challenge carries its own copy of
--    the template payload.
-- 2. Category on the five seeded habit templates.
-- 3. The content-assets bucket also accepts .mov (video/quicktime). Upload,
--    replace and delete stay Wellness-admin-only through the storage.objects
--    policies from 20260519000012 (not changed here); anyone can read.
-- 4. ensure_default_habit_week() and hr_schedule_habit_challenge() skip
--    archived templates. Both still copy the whole template payload, media
--    included, into the challenge, and my_habit_challenge() already returns
--    challenge.payload, so the employee app gets the media without changes
--    to that function.
-- 5. Media edits on a template also reach weeks that haven't ended yet, so a
--    replaced or removed how-to video doesn't linger on a running challenge.
--    Nothing else is synced: action / why / check_mode / success_days stay
--    as they were when the week was booked.
--
-- Idempotent: safe to paste into the SQL editor more than once.

-- ── 1. archived_at ───────────────────────────────────────────
ALTER TABLE public.challenge_templates
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- ── 2. categories for the seeded habits ─────────────────────
UPDATE public.challenge_templates t
   SET payload = t.payload || jsonb_build_object('category', v.category)
  FROM (VALUES
    ('habit-water',        'hydration'),
    ('habit-lunch-walk',   'movement'),
    ('habit-5min-reset',   'stress'),
    ('habit-same-bedtime', 'sleep'),
    ('habit-phone-out',    'sleep')
  ) AS v(slug, category)
 WHERE t.slug = v.slug
   AND NOT (t.payload ? 'category');

-- ── 3. bucket: allow .mov ────────────────────────────────────
UPDATE storage.buckets
   SET allowed_mime_types = array_append(allowed_mime_types, 'video/quicktime')
 WHERE id = 'content-assets'
   AND allowed_mime_types IS NOT NULL
   AND NOT ('video/quicktime' = ANY (allowed_mime_types));

-- ── 4a. default week: skip archived templates ───────────────
CREATE OR REPLACE FUNCTION public.ensure_default_habit_week(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dow  INT := EXTRACT(DOW FROM current_date)::INT;
  -- Sun → Thu: this week. Fri / Sat: the week ahead.
  v_week DATE := CASE WHEN v_dow <= 4 THEN current_date - v_dow ELSE current_date + (7 - v_dow) END;
  v_n    INT;
  t      public.challenge_templates%ROWTYPE;
BEGIN
  IF p_company_id IS NULL THEN RETURN; END IF;
  -- Two employees opening the app at once must not book two defaults.
  PERFORM pg_advisory_xact_lock(hashtext('habit_default_week'), hashtext(p_company_id::text));

  IF EXISTS (SELECT 1 FROM public.challenges
              WHERE company_id = p_company_id AND kind = 'habit'
                AND start_date <= v_week + 4 AND end_date >= v_week) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_n FROM public.challenge_templates
   WHERE kind = 'habit' AND archived_at IS NULL;
  IF v_n = 0 THEN RETURN; END IF;
  SELECT * INTO t FROM public.challenge_templates
   WHERE kind = 'habit' AND archived_at IS NULL
   ORDER BY slug OFFSET ((v_week - DATE '2026-01-04') / 7) % v_n LIMIT 1;

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

-- ── 4b. HR schedule: archived templates can't be booked ─────
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
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.challenge_templates WHERE id = p_template_id AND kind = 'habit';
  IF t.id IS NULL THEN RAISE EXCEPTION 'template_not_found' USING ERRCODE = 'P0002'; END IF;
  IF t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'template_archived' USING ERRCODE = 'P0002'; END IF;
  IF EXTRACT(DOW FROM p_week_start) <> 0 THEN
    RAISE EXCEPTION 'week_must_start_on_sunday' USING ERRCODE = '22023';
  END IF;
  IF p_week_start + 4 < current_date THEN
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
     AND d.start_date <= p_week_start + 4 AND d.end_date >= p_week_start
     AND NOT EXISTS (SELECT 1 FROM public.habit_logs l WHERE l.challenge_id = d.id);

  -- One habit challenge at a time for the same people.
  SELECT * INTO v_clash FROM public.challenges
   WHERE company_id = v_company AND kind = 'habit' AND active
     AND start_date <= p_week_start + 4 AND end_date >= p_week_start
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
    'habit', COALESCE(t.target, 4), p_week_start, p_week_start + 4, 5,
    COALESCE(t.payload ->> 'badge_icon', 'trophy'), COALESCE(t.payload ->> 'badge_color', '#F5B544'),
    true, 'habit', t.id, p_team_id, t.payload)
  RETURNING * INTO v_row;

  INSERT INTO public.audit_log (actor_email, actor_id, action, target, target_id, severity, details)
  VALUES (COALESCE(auth.jwt() ->> 'email', 'system'), auth.uid(), 'challenge.habit_scheduled',
          t.slug, v_row.id, 'info',
          jsonb_build_object('week_start', p_week_start, 'team_id', p_team_id));
  RETURN v_row;
END;
$$;

-- ── 5. template media → weeks still running ─────────────────
CREATE OR REPLACE FUNCTION public.sync_template_media_to_challenges()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_keys CONSTANT TEXT[] := ARRAY['media_type', 'media_url', 'media_path', 'media_mime', 'media_youtube_id'];
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
     AND c.end_date + 1 >= current_date      -- +1: evening habits log the morning after
     AND COALESCE(c.payload ->> 'finalized', 'false') <> 'true';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS challenge_templates_sync_media ON public.challenge_templates;
CREATE TRIGGER challenge_templates_sync_media
  AFTER UPDATE OF payload ON public.challenge_templates
  FOR EACH ROW EXECUTE FUNCTION public.sync_template_media_to_challenges();

-- ── grants (same as before for the replaced functions) ───────
REVOKE EXECUTE ON FUNCTION public.ensure_default_habit_week(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.ensure_default_habit_week(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.hr_schedule_habit_challenge(UUID, DATE, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.hr_schedule_habit_challenge(UUID, DATE, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.sync_template_media_to_challenges() FROM PUBLIC, anon, authenticated;

-- Check after running. Expect the four content_assets_* policies (read for
-- everyone; insert / update / delete only when public.is_wellness_admin()).
-- Any other INSERT / UPDATE / DELETE policy here that doesn't pin its own
-- bucket_id would also let other users write into content-assets.
--   SELECT policyname, cmd, roles, qual, with_check
--     FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
--    ORDER BY policyname;
--   SELECT allowed_mime_types, file_size_limit FROM storage.buckets WHERE id = 'content-assets';
