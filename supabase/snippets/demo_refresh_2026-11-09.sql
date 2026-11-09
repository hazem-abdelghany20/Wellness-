-- Wellness+ demo refresh — 2026-11-09
-- Run once in the Supabase SQL editor of the live project (ewfqkhfoodijhxaqiome).
-- Touches ONLY the demo company "Wellhouse Group". One transaction; safe to re-run.
--
--   1. Removes the May test broadcasts and adds two realistic ones.
--   2. Hides the stray test sign-up ("ahmed") with a soft delete (deleted_at).
--   3. Books a habit challenge for each of the last 6 weeks (if missing),
--      already marked finalized so no reward/notification burst fires.
--   4. Adds "Did it" days for those weeks + this Sunday, and article reads,
--      so Score, the team bar and the HR dashboard have real numbers.
--      Amira gets this Sunday done and today left open, so the live
--      "Did it today" tap still works in the demo.

BEGIN;

CREATE TEMP TABLE _co ON COMMIT DROP AS
SELECT id FROM public.companies
 WHERE id = '00000000-0000-0000-0000-000000000001' AND name = 'Wellhouse Group';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM _co) THEN RAISE EXCEPTION 'Wellhouse Group not found — nothing changed'; END IF;
END $$;

-- ── 1. Broadcasts ────────────────────────────────────────────
DELETE FROM public.broadcasts
 WHERE company_id = (SELECT id FROM _co)
   AND (scheduled_at < '2026-06-01' OR title_en IN ('QA test bcast', 'UAT smoke'));

INSERT INTO public.broadcasts (company_id, title_en, title_ar, body_en, body_ar, scope, status, scheduled_at, sent_at)
SELECT (SELECT id FROM _co), v.t_en, v.t_ar, v.b_en, v.b_ar, 'all', v.st, v.at, CASE WHEN v.st = 'sent' THEN v.at END
FROM (VALUES
  ('This week: The Water Bottle', 'تحدي الأسبوع: قزازة المية',
   'One litre on your desk, finished before you leave. Tap "Did it" each day.',
   'قزازة مية لتر على مكتبك، تخلّصها قبل ما تروّح. دوس "عملتها" كل يوم.',
   'sent', TIMESTAMPTZ '2026-11-08 09:00+02'),
  ('New in the Library: short reads on stress', 'جديد في المكتبة: مقالات قصيرة عن الضغط',
   'Ten 3–5 minute reads on overthinking, burnout and busy weeks.',
   'عشر مقالات من ٣ لـ ٥ دقايق عن التفكير الزيادة والاحتراق والأسابيع المزحومة.',
   'sent', TIMESTAMPTZ '2026-11-02 10:00+02')
) AS v(t_en, t_ar, b_en, b_ar, st, at)
WHERE NOT EXISTS (SELECT 1 FROM public.broadcasts b
                   WHERE b.company_id = (SELECT id FROM _co) AND b.title_en = v.t_en);

-- ── 2. Stray test sign-up ────────────────────────────────────
UPDATE public.profiles
   SET deleted_at = now(), onboarded = false
 WHERE company_id = (SELECT id FROM _co)
   AND deleted_at IS NULL
   AND lower(display_name) LIKE 'ahmed%'
   AND team_id IS NULL;

-- ── Members who get activity ─────────────────────────────────
CREATE TEMP TABLE _m ON COMMIT DROP AS
SELECT p.id, p.display_name,
       CASE WHEN p.display_name = 'Amira Hassan' THEN 85
            ELSE 35 + abs(hashtext(p.id::text)::bigint) % 50 END AS rate   -- % chance of a done day
  FROM public.profiles p
 WHERE p.company_id = (SELECT id FROM _co)
   AND p.deleted_at IS NULL AND p.onboarded = true;

-- Week starts (Sunday). w = 0 is this week.
CREATE TEMP TABLE _w ON COMMIT DROP AS
SELECT g AS w, (current_date - EXTRACT(DOW FROM current_date)::INT - 7 * g)::DATE AS wk
  FROM generate_series(0, 6) g;

-- ── 3. Past habit challenges (only weeks with none) ──────────
INSERT INTO public.challenges (
  company_id, title_en, title_ar, description_en, description_ar,
  metric, goal_value, start_date, end_date, duration_days,
  badge_icon, badge_color, active, kind, template_id, team_id, payload)
SELECT (SELECT id FROM _co), t.title_en, t.title_ar, t.payload ->> 'action_en', t.payload ->> 'action_ar',
       'habit', COALESCE(t.target, 4), w.wk, w.wk + 4, 5,
       COALESCE(t.payload ->> 'badge_icon', 'trophy'), COALESCE(t.payload ->> 'badge_color', '#F5B544'),
       true, 'habit', t.id, NULL, t.payload || '{"auto": true, "finalized": true}'::jsonb
  FROM _w w
  CROSS JOIN LATERAL (
    SELECT * FROM public.challenge_templates WHERE kind = 'habit'
     ORDER BY slug
    OFFSET ((w.wk - DATE '2026-01-04') / 7) % (SELECT COUNT(*) FROM public.challenge_templates WHERE kind = 'habit')
     LIMIT 1) t
 WHERE w.w BETWEEN 1 AND 6
   AND NOT EXISTS (SELECT 1 FROM public.challenges c
                    WHERE c.company_id = (SELECT id FROM _co) AND c.kind = 'habit'
                      AND c.start_date <= w.wk + 4 AND c.end_date >= w.wk);

-- ── 4a. "Did it" days ────────────────────────────────────────
-- Past weeks: Sun–Thu, participation ramps up toward this week.
INSERT INTO public.habit_logs (challenge_id, user_id, company_id, log_date, created_at)
SELECT c.id, m.id, c.company_id, w.wk + d, (w.wk + d) + TIME '13:00'
  FROM _w w
  JOIN public.challenges c
    ON c.company_id = (SELECT id FROM _co) AND c.kind = 'habit' AND c.active
   AND c.team_id IS NULL AND c.start_date = w.wk
  CROSS JOIN _m m
  CROSS JOIN generate_series(0, 4) d
 WHERE w.w BETWEEN 1 AND 6
   AND abs(hashtext(m.id::text || w.wk::text || d::text)::bigint) % 100 < LEAST(95, m.rate + 6 * (6 - w.w))
ON CONFLICT (challenge_id, user_id, log_date) DO NOTHING;

-- This week: Sunday for most people (Amira included); today for some — never Amira.
INSERT INTO public.habit_logs (challenge_id, user_id, company_id, log_date, created_at)
SELECT c.id, m.id, c.company_id, x.d, x.d + TIME '12:30'
  FROM _w w
  JOIN public.challenges c
    ON c.company_id = (SELECT id FROM _co) AND c.kind = 'habit' AND c.active
   AND c.team_id IS NULL AND c.start_date = w.wk
  CROSS JOIN _m m
  CROSS JOIN LATERAL (VALUES (w.wk), (current_date)) x(d)
 WHERE w.w = 0
   AND x.d BETWEEN w.wk AND w.wk + 4
   AND x.d <= current_date
   AND (
        (x.d = w.wk AND x.d < current_date
           AND (m.display_name = 'Amira Hassan' OR abs(hashtext(m.id::text || 'sun')::bigint) % 100 < 75))
     OR (x.d = current_date AND x.d > w.wk
           AND m.display_name <> 'Amira Hassan' AND abs(hashtext(m.id::text || 'today')::bigint) % 100 < 45)
   )
ON CONFLICT (challenge_id, user_id, log_date) DO NOTHING;

-- ── 4b. Article reads over the last 6 weeks ──────────────────
INSERT INTO public.content_progress (user_id, item_id, company_id, completed, started_at, finished_at)
SELECT m.id, i.id, (SELECT id FROM _co),
       (abs(hashtext(m.id::text || i.id::text || 'fin')::bigint) % 100 < 70) AS completed,
       s.started_at,
       CASE WHEN abs(hashtext(m.id::text || i.id::text || 'fin')::bigint) % 100 < 70
            THEN s.started_at + interval '6 minutes' END
  FROM _m m
  JOIN public.content_items i ON i.kind = 'article'
  CROSS JOIN LATERAL (
    SELECT LEAST(now() - interval '1 hour',
             (current_date - (abs(hashtext(m.id::text || i.id::text || 'day')::bigint) % 42)::int)::timestamptz
             + interval '1 hour' * (9 + abs(hashtext(i.id::text || m.id::text)::bigint) % 10)) AS started_at) s
 WHERE abs(hashtext(m.id::text || i.id::text)::bigint) % 100 < 30
ON CONFLICT (user_id, item_id) DO NOTHING;

COMMIT;

-- ── Check ────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM public.habit_logs WHERE company_id = '00000000-0000-0000-0000-000000000001') AS did_it_days,
  (SELECT COUNT(*) FROM public.content_progress WHERE company_id = '00000000-0000-0000-0000-000000000001') AS article_reads,
  (SELECT COUNT(*) FROM public.broadcasts WHERE company_id = '00000000-0000-0000-0000-000000000001') AS broadcasts,
  (SELECT string_agg(display_name, ', ') FROM public.profiles
    WHERE company_id = '00000000-0000-0000-0000-000000000001' AND deleted_at IS NOT NULL)          AS hidden_profiles;
