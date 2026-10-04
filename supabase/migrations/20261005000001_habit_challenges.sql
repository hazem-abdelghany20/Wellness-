-- Weekly habit challenges.
--
-- The old challenges scored self-reported outcomes ("average sleep 7+ for
-- 21 days") on a leaderboard, and nothing ever updated the scores or gave
-- out rewards. A habit challenge is a small daily action for one work week:
--
--   * HR picks one template and one week (Sun → Thu), optionally one team.
--     Only one habit challenge may run at a time for the same people.
--   * Employees tap "Did it" once a day (or the next morning for evening
--     habits). No scores, no ranking.
--   * Everyone sees one shared team progress bar (shown only when the group
--     is at least the company's minimum cohort).
--   * When the week ends, everyone who did it on success_days of the 5 days
--     gets a bronze reward in their wallet plus a notification. This runs
--     lazily, the first time anyone opens the challenge after it ends, so no
--     scheduler is needed.

-- ── challenges: habit kind ───────────────────────────────────
ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_metric_check;
ALTER TABLE public.challenges ADD CONSTRAINT challenges_metric_check
  CHECK (metric IN ('sleep','stress','energy','mood','checkins','content','habit'));

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS kind        TEXT  NOT NULL DEFAULT 'metric',
  ADD COLUMN IF NOT EXISTS template_id UUID  REFERENCES public.challenge_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_id     UUID  REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payload     JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_kind_check;
ALTER TABLE public.challenges ADD CONSTRAINT challenges_kind_check CHECK (kind IN ('metric','habit'));

CREATE INDEX IF NOT EXISTS idx_challenges_habit
  ON public.challenges (company_id, start_date) WHERE kind = 'habit';

-- ── habit_logs: one row per person per done day ──────────────
CREATE TABLE IF NOT EXISTS public.habit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  log_date     DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_challenge ON public.habit_logs (challenge_id);

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS habit_logs_own_read ON public.habit_logs;
CREATE POLICY habit_logs_own_read ON public.habit_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS habit_logs_service ON public.habit_logs;
CREATE POLICY habit_logs_service ON public.habit_logs
  USING (auth.role() = 'service_role');
-- Writes go through log_habit() only.

-- ── templates ────────────────────────────────────────────────
-- payload keys: action_*, why_*, reminder_*, reminder_time, missed_*,
-- tip_*, check_mode ('same_day' | 'next_morning'), success_days,
-- article_slug, badge_icon, badge_color.
INSERT INTO public.challenge_templates (slug, title_en, title_ar, kind, default_window_days, target, metric, payload) VALUES
('habit-water', 'The Water Bottle', 'قزازة المية', 'habit', 5, 4, 'habit', $j${
  "action_en": "Keep a 1-litre bottle on your desk and finish it before you leave.",
  "action_ar": "قزازة مية (لتر) على مكتبك، تخلّصها قبل ما تروّح.",
  "why_en": "On busy days we forget to drink. Mild thirst can feel like tiredness, a headache or poor focus.",
  "why_ar": "في الأيام المزحومة بننسى نشرب. والعطش الخفيف ساعات بيبان كإنه تعب أو صداع أو قلة تركيز.",
  "tip_en": "Keep the bottle where you can see it, not in your bag.",
  "tip_ar": "خلّي القزازة في مكان عينك بتشوفه، مش في الشنطة.",
  "reminder_en": "How's the bottle doing?", "reminder_ar": "القزازة وصلت لفين؟", "reminder_time": "12:00",
  "missed_en": "It doesn't have to be all of it. Half a bottle beats none.",
  "missed_ar": "مش لازم كلها. نص القزازة أحسن من ولا حاجة.",
  "check_mode": "same_day", "success_days": 4, "article_slug": "inside-out-performance",
  "badge_icon": "bolt", "badge_color": "#6FB7D9"
}$j$::jsonb),
('habit-lunch-walk', 'Walk-After-Lunch Week', 'أسبوع المشي بعد الغدا', 'habit', 5, 4, 'habit', $j${
  "action_en": "Walk for 10 minutes after lunch, indoors or out.",
  "action_ar": "امشي ١٠ دقايق بعد الغدا، جوه المكتب أو برّه.",
  "why_en": "Energy and focus dip after lunch. Ten minutes of movement breaks the slump without costing work time.",
  "why_ar": "بعد الغدا الطاقة بتقع والتركيز بيروح. ١٠ دقايق حركة بتكسر الخمول من غير ما تاخد من وقت الشغل.",
  "tip_en": "Ask a colleague to join you. It is easier to keep a walk you agreed on.",
  "tip_ar": "اعزم زميل يمشي معاك. المشي اللي متفقين عليه أسهل تلتزم بيه.",
  "reminder_en": "Done with lunch? 10 minutes of walking, then back.", "reminder_ar": "خلّصت الغدا؟ ١٠ دقايق مشي وارجع.", "reminder_time": "13:30",
  "missed_en": "One missed day changes nothing. Tomorrow's a fresh start.",
  "missed_ar": "يوم واحد مش هيفرق. بكره فرصة جديدة.",
  "check_mode": "same_day", "success_days": 4, "article_slug": "inside-out-performance",
  "badge_icon": "activity", "badge_color": "#8BBF7A"
}$j$::jsonb),
('habit-5min-reset', 'The 5-Minute Reset', 'استراحة الـ ٥ دقايق', 'habit', 5, 4, 'habit', $j${
  "action_en": "At least one 5-minute break between two tasks or meetings: stand up, drink water, take 3 deep breaths.",
  "action_ar": "استراحة ٥ دقايق واحدة على الأقل بين مهمتين أو اجتماعين: قوم، اشرب مية، وخد ٣ أنفاس عميقة.",
  "why_en": "Back-to-back work stacks up tension by evening. A short gap clears your head before the next thing.",
  "why_ar": "الشغل المتلاصق من غير فاصل بيراكم التوتر لآخر اليوم. فاصل صغير بيصفّي الدماغ قبل اللي بعده.",
  "tip_en": "Block 5 minutes in your calendar so meetings can't take them.",
  "tip_ar": "احجز ٥ دقايق في الكالندر علشان الاجتماعات ما تاخدهمش.",
  "reminder_en": "Before your next meeting: stand, water, 3 breaths.", "reminder_ar": "قبل الاجتماع الجاي: قوم، مية، ٣ أنفاس.", "reminder_time": "11:30",
  "missed_en": "Busy day. Tomorrow, try blocking 5 minutes in your calendar.",
  "missed_ar": "اليوم كان زحمة. بكره حاول تحجز ٥ دقايق في الكالندر.",
  "check_mode": "same_day", "success_days": 4, "article_slug": "busy-trap",
  "badge_icon": "wind", "badge_color": "#C9A15B"
}$j$::jsonb),
('habit-same-bedtime', 'Same Bedtime Week', 'ميعاد نوم ثابت', 'habit', 5, 4, 'habit', $j${
  "action_en": "Pick a bedtime and go to bed within 30 minutes of it every night.",
  "action_ar": "اختار ميعاد نوم، ونام في حدود نص ساعة منه كل ليلة.",
  "why_en": "A steady bedtime helps the body settle, and waking up gets easier without changing how many hours you sleep.",
  "why_ar": "الجسم بيرتاح أكتر لما النوم يبقى في ميعاد ثابت، والصحيان بيبقى أسهل من غير ما تغيّر عدد الساعات.",
  "tip_en": "Choose a time you can really keep on a work night, not an ideal one.",
  "tip_ar": "اختار ميعاد تقدر تلتزم بيه فعلاً في ليلة شغل، مش الميعاد المثالي.",
  "reminder_en": "30 minutes to your bedtime. Start winding down.", "reminder_ar": "فاضل نص ساعة على ميعادك. ابدأ تهدّي.", "reminder_time": "22:30",
  "missed_en": "One late night won't ruin the week. Back to your time tonight.",
  "missed_ar": "ليلة متأخرة مش هتبوّظ الأسبوع. الليلة ارجع لميعادك.",
  "check_mode": "next_morning", "success_days": 4, "article_slug": "heavy-day",
  "badge_icon": "moon", "badge_color": "#9C8BD9"
}$j$::jsonb),
('habit-phone-out', 'Phone Out of Bed', 'الموبايل برّه السرير', 'habit', 5, 4, 'habit', $j${
  "action_en": "No phone for the last 30 minutes before sleep. Charge it outside the bedroom.",
  "action_ar": "آخر ٣٠ دقيقة قبل النوم من غير موبايل. اشحنه برّه أوضة النوم.",
  "why_en": "Late-night screens delay sleep and keep the mind running. Thirty quiet minutes change how you wake up.",
  "why_ar": "الشاشة آخر الليل بتأخر النوم وبتخلّي الدماغ شغال. ٣٠ دقيقة هدوء بتفرق في الصحيان.",
  "tip_en": "Use a cheap alarm clock so the phone has no reason to be by the bed.",
  "tip_ar": "استخدم منبّه عادي علشان الموبايل ما يبقاش ليه لازمة جنب السرير.",
  "reminder_en": "Phone goes to charge outside. Good night.", "reminder_ar": "الموبايل يروح يشحن برّه. تصبح على خير.", "reminder_time": "22:30",
  "missed_en": "That's okay. Tonight is another try.",
  "missed_ar": "عادي. الليلة دي محاولة جديدة.",
  "check_mode": "next_morning", "success_days": 4, "article_slug": "quiet-solitude",
  "badge_icon": "phone", "badge_color": "#7FA3C9"
}$j$::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  title_en = EXCLUDED.title_en, title_ar = EXCLUDED.title_ar, kind = EXCLUDED.kind,
  default_window_days = EXCLUDED.default_window_days, target = EXCLUDED.target,
  metric = EXCLUDED.metric, payload = EXCLUDED.payload;

-- ── helpers ──────────────────────────────────────────────────
-- Last day a person can still log for this challenge, and the date a log
-- made today counts for (evening habits are logged the next morning).
CREATE OR REPLACE FUNCTION public.habit_target_date(p_payload JSONB)
RETURNS DATE
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT CASE WHEN p_payload ->> 'check_mode' = 'next_morning'
              THEN current_date - 1 ELSE current_date END;
$$;

CREATE OR REPLACE FUNCTION public.habit_members(p_company_id UUID, p_team_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::INT FROM public.profiles
   WHERE company_id = p_company_id
     AND deleted_at IS NULL AND onboarded = true
     AND (p_team_id IS NULL OR team_id = p_team_id);
$$;

-- Award bronze to everyone who reached success_days, once, after the week.
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
  IF current_date <= v_last THEN RETURN; END IF;

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

-- ── employee: current challenge + my state ───────────────────
CREATE OR REPLACE FUNCTION public.my_habit_challenge()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_company UUID := public.auth_company_id();
  v_team    UUID;
  c         public.challenges%ROWTYPE;
  v_status  TEXT;
  v_target  DATE;
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

  -- Settle any finished week for this company first (gives out rewards).
  FOR v_ended IN
    SELECT id FROM public.challenges
     WHERE company_id = v_company AND kind = 'habit'
       AND COALESCE(payload ->> 'finalized', 'false') <> 'true'
       AND end_date < current_date
  LOOP
    PERFORM public.finalize_habit_challenge(v_ended.id);
  END LOOP;

  SELECT * INTO c FROM public.challenges
   WHERE company_id = v_company AND kind = 'habit' AND active
     AND (team_id IS NULL OR team_id = v_team)
     AND start_date <= current_date
     AND end_date + CASE WHEN payload ->> 'check_mode' = 'next_morning' THEN 1 ELSE 0 END >= current_date
   ORDER BY start_date DESC LIMIT 1;

  IF c.id IS NOT NULL THEN
    v_status := 'active';
  ELSE
    SELECT * INTO c FROM public.challenges
     WHERE company_id = v_company AND kind = 'habit' AND active
       AND (team_id IS NULL OR team_id = v_team)
       AND start_date > current_date
     ORDER BY start_date LIMIT 1;
    IF c.id IS NULL THEN RETURN jsonb_build_object('status', 'none'); END IF;
    v_status := 'upcoming';
  END IF;

  v_target  := public.habit_target_date(c.payload);
  v_elapsed := GREATEST(0, LEAST(v_target, c.end_date) - c.start_date + 1);
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
    'can_log',      v_status = 'active' AND v_target BETWEEN c.start_date AND c.end_date,
    'logged_target', v_dates @> to_jsonb(v_target),
    'my_dates',     v_dates,
    'my_count',     jsonb_array_length(v_dates),
    'success_days', COALESCE((c.payload ->> 'success_days')::INT, 4),
    'days_total',   c.end_date - c.start_date + 1,
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

  v_target := public.habit_target_date(c.payload);
  IF v_target < c.start_date OR v_target > c.end_date THEN
    RAISE EXCEPTION 'outside_challenge_window' USING ERRCODE = '22023';
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

-- ── HR: schedule, cancel, list ───────────────────────────────
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
     AND start_date > current_date;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'only_upcoming_can_be_cancelled' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_habit_challenges()
RETURNS TABLE (
  id UUID, title_en TEXT, title_ar TEXT, template_id UUID, team_id UUID, team_name TEXT,
  start_date DATE, end_date DATE, status TEXT,
  members INT, participants INT, completed INT, completion_pct NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_company UUID := public.auth_company_id();
  v_floor   INT;
  r         RECORD;
BEGIN
  IF v_company IS NULL OR public.auth_role() NOT IN ('hr_admin', 'company_admin', 'manager') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_floor := public.hr_min_cohort(v_company);

  FOR r IN SELECT c.id FROM public.challenges c
            WHERE c.company_id = v_company AND c.kind = 'habit'
              AND COALESCE(c.payload ->> 'finalized', 'false') <> 'true' AND c.end_date < current_date
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
              WHEN b.start_date > current_date THEN 'upcoming'
              WHEN b.end_date + CASE WHEN b.payload ->> 'check_mode' = 'next_morning' THEN 1 ELSE 0 END >= current_date THEN 'active'
              ELSE 'done' END,
         b.n_members,
         (SELECT COUNT(*)::INT FROM per_user p WHERE p.challenge_id = b.id),
         (SELECT COUNT(*)::INT FROM per_user p WHERE p.challenge_id = b.id AND p.days >= b.need),
         CASE WHEN b.n_members >= v_floor
              THEN round(100.0 * (SELECT COUNT(*) FROM per_user p WHERE p.challenge_id = b.id AND p.days >= b.need) / b.n_members)
         END
    FROM base b LEFT JOIN public.teams tm ON tm.id = b.team_id
   ORDER BY b.start_date DESC;
END;
$$;

-- ── grants ───────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.finalize_habit_challenge(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.habit_members(UUID, UUID)     FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.finalize_habit_challenge(UUID) TO service_role;
GRANT  EXECUTE ON FUNCTION public.habit_members(UUID, UUID)     TO service_role;

DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname IN ('my_habit_challenge', 'log_habit', 'hr_schedule_habit_challenge',
                                'hr_cancel_habit_challenge', 'hr_habit_challenges', 'habit_target_date')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;
