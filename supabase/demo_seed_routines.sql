-- Wellness+ demo data — sprint 2 routines and libraries (Wellhouse Group only).
--
-- Demo data, NOT a migration. Needs 20261110000001_routines_and_libraries.sql.
-- Run as postgres (psql / SQL editor) after the migrations and seed:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/demo_seed_routines.sql
-- One transaction; safe to re-run (fixed ids, upserts, ON CONFLICT DO NOTHING).
-- Works on whatever members Wellhouse Group has (no user ids hard-coded).
--
--   1. Settings: recognition = 'named', hr_people_view = true.
--   2. 14 office exercises (EN + AR, sets/reps, body areas, no media yet).
--   3. Routine "Desk Day" (8 timed items 09:30–17:00, every workday) and
--      "Weekly split" (Sun upper body · Mon lower body · Tue mobility ·
--      Wed core · Thu full body, light), both for the whole company. The
--      assignments start on the Sunday 3 weeks ago so the history below is
--      consistent with what was due.
--   4. 3 weeks of ticks, varying by person; today only up to the current
--      time. Amira's today is left open for a live tick in the demo.
--   5. Opt-ins: Amira, Lina, Nadia on the named board; Amira and Yusuf share
--      their progress with HR.
--   6. One HR article and two facts, private to Wellhouse.
--   7. HR's own 2-week challenge "Water, 8 glasses", booked from next Sunday
--      when those weeks are free.

BEGIN;

CREATE TEMP TABLE _co ON COMMIT DROP AS
SELECT id, public.company_tz(id) AS tz, public.company_today(id) AS today,
       public.company_now(id) AS local_now
  FROM public.companies
 WHERE id = '00000000-0000-0000-0000-000000000001' AND name = 'Wellhouse Group';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM _co) THEN RAISE EXCEPTION 'Wellhouse Group not found — nothing changed'; END IF;
  IF to_regclass('public.routine_checks') IS NULL THEN
    RAISE EXCEPTION 'Run migration 20261110000001_routines_and_libraries.sql first';
  END IF;
END $$;

CREATE TEMP TABLE _ctx ON COMMIT DROP AS
SELECT c.id AS co, c.tz, c.today, c.local_now,
       (c.today - EXTRACT(DOW FROM c.today)::int - 21)::date AS starts_on,
       (SELECT id FROM auth.users WHERE email = 'sara.hr@demo.wellhouse.test' LIMIT 1) AS hr_user
  FROM _co c;

-- ── 1. Settings ──────────────────────────────────────────────
UPDATE public.companies
   SET settings = COALESCE(settings, '{}'::jsonb) || '{"recognition": "named", "hr_people_view": true}'::jsonb
 WHERE id = (SELECT co FROM _ctx);

-- ── 2. Exercises ─────────────────────────────────────────────
INSERT INTO public.exercises (id, company_id, name_en, name_ar, how_en, how_ar, helps_en, helps_ar,
                              body_areas, default_sets_reps, default_sets_reps_ar, status, created_by, created_at)
SELECT v.id::uuid, (SELECT co FROM _ctx), v.name_en, v.name_ar, v.how_en, v.how_ar, v.helps_en, v.helps_ar,
       v.areas::text[], v.sr_en, v.sr_ar, 'published', (SELECT hr_user FROM _ctx),
       ((SELECT starts_on FROM _ctx) - 7)::timestamp AT TIME ZONE (SELECT tz FROM _ctx)
FROM (VALUES
  ('00000000-0000-0000-0020-000000000001', 'Neck tilt', 'إمالة الرقبة',
   'Sit tall. Drop one ear toward your shoulder, hold, then switch sides.',
   'اقعد مفرود. ميّل ودنك ناحية كتفك، اثبت شوية، وبعدين بدّل.',
   'Eases a stiff neck after screen time.', 'بيريّح الرقبة المشدودة من الشاشة.',
   '{neck}', '2 × 20 s each side', '٢ × ٢٠ ث لكل جنب'),
  ('00000000-0000-0000-0020-000000000002', 'Shoulder rolls', 'لف الكتف',
   'Roll both shoulders up, back and down in slow circles.',
   'لف كتافك لفوق ولورا ولتحت في دواير بطيئة.',
   'Loosens tight shoulders.', 'بيفك شد الكتاف.',
   '{shoulders,upper_back}', '2 × 10', '٢ × ١٠'),
  ('00000000-0000-0000-0020-000000000003', 'Chin tucks', 'سحب الدقن',
   'Look straight ahead and glide your chin back. Hold 3 seconds.',
   'بص قدامك واسحب دقنك لورا في خط مستقيم. اثبت ٣ ثواني.',
   'Counters the head-forward screen posture.', 'بيعدل وضع الراس اللي بيتقدم قدام الشاشة.',
   '{neck,upper_back}', '2 × 10', '٢ × ١٠'),
  ('00000000-0000-0000-0020-000000000004', 'Wrist stretch', 'إطالة الرسغ',
   'Arm out, palm up; gently pull your fingers back with the other hand. Then palm down.',
   'افرد دراعك وكفك لفوق، واسحب صوابعك لورا بالراحة بإيدك التانية. وبعدين الكف لتحت.',
   'Relief for typing wrists.', 'راحة للرسغ من الكتابة.',
   '{wrists,arms}', '1 × 30 s each hand', '١ × ٣٠ ث لكل إيد'),
  ('00000000-0000-0000-0020-000000000005', 'Standing calf raise', 'رفع السمانة واقف',
   'Stand behind your chair, rise onto your toes, lower slowly.',
   'اقف ورا الكرسي، اطلع على صوابع رجلك، وانزل بالراحة.',
   'Gets the blood moving after sitting.', 'بيحرك الدورة الدموية بعد القعدة الطويلة.',
   '{legs}', '2 × 15', '٢ × ١٥'),
  ('00000000-0000-0000-0020-000000000006', 'Seated spinal twist', 'لفة الضهر وانت قاعد',
   'Sit tall and turn your chest toward the back of the chair. Hold, then switch.',
   'اقعد مفرود ولف صدرك ناحية ضهر الكرسي. اثبت، وبعدين بدّل.',
   'Frees a stiff lower back.', 'بيفك تيبّس أسفل الضهر.',
   '{lower_back,core}', '2 × 15 s each side', '٢ × ١٥ ث لكل جنب'),
  ('00000000-0000-0000-0020-000000000007', 'Chest opener', 'فتح الصدر',
   'Clasp your hands behind you, squeeze your shoulder blades and lift your chest.',
   'شبّك إيديك ورا ضهرك، اضغط لوحي الكتف على بعض وارفع صدرك.',
   'Undoes the desk hunch.', 'بيعدل التقوّس من القعدة على المكتب.',
   '{chest,shoulders}', '2 × 20 s', '٢ × ٢٠ ث'),
  ('00000000-0000-0000-0020-000000000008', 'Hip flexor stretch', 'إطالة عضلات الحوض',
   'Stagger your feet, tuck your hips under and lean forward gently.',
   'رجل قدام ورجل ورا، اسحب حوضك لتحت ومِيل لقدام بالراحة.',
   'Opens hips that are tight from sitting.', 'بيفتح الحوض المشدود من القعدة.',
   '{hips,legs}', '2 × 30 s each side', '٢ × ٣٠ ث لكل جنب'),
  ('00000000-0000-0000-0020-000000000009', 'Wall push-ups', 'ضغط على الحيطة',
   'Hands on the wall at shoulder height. Lower your chest to the wall, push back.',
   'إيديك على الحيطة في مستوى الكتف. قرّب صدرك من الحيطة وازق تاني.',
   'Upper-body strength, no floor needed.', 'قوة للجزء العلوي من غير ما تنزل الأرض.',
   '{chest,arms,shoulders}', '2 × 10', '٢ × ١٠'),
  ('00000000-0000-0000-0020-000000000010', 'Desk squats', 'سكوات قدام المكتب',
   'Feet hip-width. Sit back toward your chair and stand up just before you touch it.',
   'رجليك بعرض الحوض. انزل كإنك هتقعد على الكرسي واطلع قبل ما تلمسه.',
   'Wakes up legs and glutes.', 'بيصحّي الرجلين والمؤخرة.',
   '{legs,hips}', '2 × 12', '٢ × ١٢'),
  ('00000000-0000-0000-0020-000000000011', 'Eye 20-20-20', 'قاعدة ٢٠-٢٠-٢٠ للعين',
   'Look at something 20 feet (6 m) away for 20 seconds.',
   'بص على حاجة بعيدة ٦ متر لمدة ٢٠ ثانية.',
   'Rests tired eyes.', 'بيريّح العين التعبانة.',
   '{eyes}', '20 s', '٢٠ ث'),
  ('00000000-0000-0000-0020-000000000012', 'Deep breathing', 'تنفس عميق',
   'Breathe in for 4, hold for 4, breathe out for 6. Repeat.',
   'خد نفس في ٤، اثبت ٤، وطلّع في ٦. وكرر.',
   'Calms you down between tasks.', 'بيهديك بين المهام.',
   '{breathing}', '5 breaths', '٥ أنفاس'),
  ('00000000-0000-0000-0020-000000000013', 'Seated knee lift', 'رفع الركبة وانت قاعد',
   'Sit near the edge, lift one knee toward your chest, lower slowly, switch.',
   'اقعد على طرف الكرسي، ارفع ركبة ناحية صدرك، نزّلها بالراحة، وبدّل.',
   'Wakes up your core.', 'بيشغّل عضلات البطن.',
   '{core,hips}', '2 × 10 each side', '٢ × ١٠ لكل جنب'),
  ('00000000-0000-0000-0020-000000000014', 'Desk plank', 'بلانك على المكتب',
   'Forearms on the desk edge, body in one straight line. Hold.',
   'دراعاتك على طرف المكتب وجسمك في خط مستقيم. اثبت.',
   'Core strength without the floor.', 'قوة للبطن من غير الأرض.',
   '{core,shoulders}', '2 × 20 s', '٢ × ٢٠ ث')
) AS v(id, name_en, name_ar, how_en, how_ar, helps_en, helps_ar, areas, sr_en, sr_ar)
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar, how_en = EXCLUDED.how_en, how_ar = EXCLUDED.how_ar,
  helps_en = EXCLUDED.helps_en, helps_ar = EXCLUDED.helps_ar, body_areas = EXCLUDED.body_areas,
  default_sets_reps = EXCLUDED.default_sets_reps, default_sets_reps_ar = EXCLUDED.default_sets_reps_ar,
  status = 'published', created_at = EXCLUDED.created_at, updated_at = now();

-- ── 3. Routines + items + assignments ────────────────────────
INSERT INTO public.routines (id, company_id, title_en, title_ar, note_en, note_ar, day_titles, workdays,
                             status, created_by, created_at)
SELECT v.id::uuid, (SELECT co FROM _ctx), v.t_en, v.t_ar, v.n_en, v.n_ar, v.titles::jsonb, '{0,1,2,3,4}',
       'published', (SELECT hr_user FROM _ctx),
       ((SELECT starts_on FROM _ctx) - 7)::timestamp AT TIME ZONE (SELECT tz FROM _ctx)
FROM (VALUES
  ('00000000-0000-0000-0021-000000000001', 'Desk Day', 'يوم المكتب',
   'Short moves through the workday from our coach. Two minutes each.',
   'حركات قصيرة طول يوم الشغل من الكوتش بتاعنا. دقيقتين لكل واحدة.', '{}'),
  ('00000000-0000-0000-0021-000000000002', 'Weekly split', 'تقسيمة الأسبوع',
   'One focus a day, any time that suits you.',
   'تركيز واحد كل يوم، في أي وقت يناسبك.',
   '{"0": {"en": "Upper body", "ar": "الجزء العلوي"},
     "1": {"en": "Lower body", "ar": "الجزء السفلي"},
     "2": {"en": "Mobility", "ar": "مرونة"},
     "3": {"en": "Core", "ar": "البطن والوسط"},
     "4": {"en": "Full body, light", "ar": "الجسم كله، خفيف"}}')
) AS v(id, t_en, t_ar, n_en, n_ar, titles)
ON CONFLICT (id) DO UPDATE SET
  title_en = EXCLUDED.title_en, title_ar = EXCLUDED.title_ar, note_en = EXCLUDED.note_en,
  note_ar = EXCLUDED.note_ar, day_titles = EXCLUDED.day_titles, workdays = EXCLUDED.workdays,
  status = 'published', created_at = EXCLUDED.created_at, updated_at = now();

INSERT INTO public.routine_items (id, routine_id, exercise_id, weekday, at_time, sets_reps, sets_reps_ar,
                                  sort_order, created_at)
SELECT v.id::uuid, v.routine::uuid, v.ex::uuid, v.wd, v.at::time, v.sr_en, v.sr_ar, v.ord,
       ((SELECT starts_on FROM _ctx) - 7)::timestamp AT TIME ZONE (SELECT tz FROM _ctx)
FROM (VALUES
  -- Desk Day: every workday
  ('00000000-0000-0000-0022-000000000001', '00000000-0000-0000-0021-000000000001', '00000000-0000-0000-0020-000000000012', NULL::smallint, '09:30', NULL, NULL, 1),
  ('00000000-0000-0000-0022-000000000002', '00000000-0000-0000-0021-000000000001', '00000000-0000-0000-0020-000000000001', NULL, '10:30', NULL, NULL, 2),
  ('00000000-0000-0000-0022-000000000003', '00000000-0000-0000-0021-000000000001', '00000000-0000-0000-0020-000000000002', NULL, '11:30', NULL, NULL, 3),
  ('00000000-0000-0000-0022-000000000004', '00000000-0000-0000-0021-000000000001', '00000000-0000-0000-0020-000000000004', NULL, '12:30', NULL, NULL, 4),
  ('00000000-0000-0000-0022-000000000005', '00000000-0000-0000-0021-000000000001', '00000000-0000-0000-0020-000000000005', NULL, '13:30', NULL, NULL, 5),
  ('00000000-0000-0000-0022-000000000006', '00000000-0000-0000-0021-000000000001', '00000000-0000-0000-0020-000000000011', NULL, '14:30', NULL, NULL, 6),
  ('00000000-0000-0000-0022-000000000007', '00000000-0000-0000-0021-000000000001', '00000000-0000-0000-0020-000000000006', NULL, '15:30', NULL, NULL, 7),
  ('00000000-0000-0000-0022-000000000008', '00000000-0000-0000-0021-000000000001', '00000000-0000-0000-0020-000000000003', NULL, '17:00', NULL, NULL, 8),
  -- Weekly split: one focus per weekday, any time
  ('00000000-0000-0000-0022-000000000011', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000009', 0, NULL, '3 × 10', '٣ × ١٠', 1),
  ('00000000-0000-0000-0022-000000000012', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000007', 0, NULL, NULL, NULL, 2),
  ('00000000-0000-0000-0022-000000000013', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000002', 0, NULL, '3 × 10', '٣ × ١٠', 3),
  ('00000000-0000-0000-0022-000000000021', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000010', 1, NULL, '3 × 12', '٣ × ١٢', 1),
  ('00000000-0000-0000-0022-000000000022', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000005', 1, NULL, '3 × 15', '٣ × ١٥', 2),
  ('00000000-0000-0000-0022-000000000023', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000008', 1, NULL, NULL, NULL, 3),
  ('00000000-0000-0000-0022-000000000031', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000001', 2, NULL, NULL, NULL, 1),
  ('00000000-0000-0000-0022-000000000032', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000006', 2, NULL, NULL, NULL, 2),
  ('00000000-0000-0000-0022-000000000033', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000004', 2, NULL, NULL, NULL, 3),
  ('00000000-0000-0000-0022-000000000041', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000014', 3, NULL, NULL, NULL, 1),
  ('00000000-0000-0000-0022-000000000042', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000013', 3, NULL, NULL, NULL, 2),
  ('00000000-0000-0000-0022-000000000043', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000006', 3, NULL, NULL, NULL, 3),
  ('00000000-0000-0000-0022-000000000051', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000009', 4, NULL, '2 × 8', '٢ × ٨', 1),
  ('00000000-0000-0000-0022-000000000052', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000010', 4, NULL, '2 × 10', '٢ × ١٠', 2),
  ('00000000-0000-0000-0022-000000000053', '00000000-0000-0000-0021-000000000002', '00000000-0000-0000-0020-000000000012', 4, NULL, NULL, NULL, 3)
) AS v(id, routine, ex, wd, at, sr_en, sr_ar, ord)
ON CONFLICT (id) DO UPDATE SET
  exercise_id = EXCLUDED.exercise_id, weekday = EXCLUDED.weekday, at_time = EXCLUDED.at_time,
  sets_reps = EXCLUDED.sets_reps, sets_reps_ar = EXCLUDED.sets_reps_ar, sort_order = EXCLUDED.sort_order,
  created_at = EXCLUDED.created_at;

INSERT INTO public.routine_assignments (id, routine_id, company_id, team_id, starts_on, active, created_by)
SELECT v.id::uuid, v.routine::uuid, (SELECT co FROM _ctx), NULL, (SELECT starts_on FROM _ctx), true,
       (SELECT hr_user FROM _ctx)
FROM (VALUES
  ('00000000-0000-0000-0023-000000000001', '00000000-0000-0000-0021-000000000001'),
  ('00000000-0000-0000-0023-000000000002', '00000000-0000-0000-0021-000000000002')
) AS v(id, routine)
ON CONFLICT (id) DO UPDATE SET starts_on = EXCLUDED.starts_on, ends_on = NULL, active = true;

-- ── 4. Three weeks of ticks ──────────────────────────────────
-- Each person has a tick rate; some days they skip, some days they do it
-- all. Deterministic (hash of person + item + day), so a re-run adds
-- nothing new except today's items whose time has passed since.
CREATE TEMP TABLE _m ON COMMIT DROP AS
SELECT p.id, p.team_id, p.display_name,
       CASE p.display_name
         WHEN 'Amira Hassan' THEN 90 WHEN 'Nadia Kamel' THEN 85 WHEN 'Lina Farouk' THEN 80
         WHEN 'Yusuf Naguib' THEN 70 WHEN 'Sara Anwar' THEN 55 WHEN 'Omar Sami' THEN 40
         ELSE 35 + abs(hashtext(p.id::text)::bigint) % 50 END AS rate
  FROM public.profiles p
 WHERE p.company_id = (SELECT co FROM _ctx) AND p.deleted_at IS NULL AND p.onboarded;

INSERT INTO public.routine_checks (company_id, user_id, routine_id, item_id, exercise_id, item_title, item_title_ar,
                                   check_date, checked_at)
SELECT x.co, x.user_id, x.routine_id, x.item_id, x.exercise_id, x.name_en, x.name_ar, x.day,
       (x.day + COALESCE(x.at_time, time '12:00') + make_interval(mins => abs(hashtext(x.user_id::text || x.item_id::text || x.day::text)) % 40))
         AT TIME ZONE x.tz
  FROM (
    SELECT c.co, c.tz, c.today, c.local_now, m.id AS user_id, m.rate, d.day,
           i.id AS item_id, i.routine_id, i.exercise_id, i.at_time, e.name_en, e.name_ar,
           abs(hashtext(m.id::text || d.day::text)) % 100 AS day_roll,
           abs(hashtext(m.id::text || i.id::text || d.day::text)) % 100 AS item_roll,
           m.display_name
      FROM _ctx c
      CROSS JOIN _m m
      CROSS JOIN LATERAL (SELECT g::date AS day FROM generate_series(c.starts_on, c.today, interval '1 day') g) d
      CROSS JOIN LATERAL public.routine_due_items(c.co, m.team_id, d.day) di
      JOIN public.routine_items i ON i.id = di.item_id
      LEFT JOIN public.exercises e ON e.id = i.exercise_id
     WHERE i.routine_id IN ('00000000-0000-0000-0021-000000000001', '00000000-0000-0000-0021-000000000002')
  ) x
 WHERE x.day_roll >= 10                                         -- ~1 day in 10: off / busy
   AND (x.day_roll < x.rate / 3 + 10 OR x.item_roll < x.rate)  -- "all in" days, else per item
   AND (x.day < x.today
        OR (x.display_name <> 'Amira Hassan'
            AND COALESCE(x.at_time, time '12:00') <= x.local_now::time))
ON CONFLICT (user_id, item_id, check_date) DO NOTHING;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT c.user_id, c.check_date FROM public.routine_checks c
            WHERE c.company_id = (SELECT co FROM _ctx)
              AND c.routine_id IN ('00000000-0000-0000-0021-000000000001', '00000000-0000-0000-0021-000000000002')
  LOOP
    PERFORM public.refresh_routine_day(r.user_id, r.check_date);
  END LOOP;
END $$;

-- ── 5. Opt-ins ───────────────────────────────────────────────
INSERT INTO public.profile_prefs (user_id, routine_reminders, recognition_opt_in, recognition_opt_in_at,
                                  share_with_hr, share_with_hr_at)
SELECT m.id,
       m.display_name = 'Amira Hassan',
       m.display_name IN ('Amira Hassan', 'Lina Farouk', 'Nadia Kamel'),
       CASE WHEN m.display_name IN ('Amira Hassan', 'Lina Farouk', 'Nadia Kamel') THEN now() - interval '10 days' END,
       m.display_name IN ('Amira Hassan', 'Yusuf Naguib'),
       CASE WHEN m.display_name IN ('Amira Hassan', 'Yusuf Naguib') THEN now() - interval '10 days' END
  FROM _m m
 WHERE m.display_name IN ('Amira Hassan', 'Lina Farouk', 'Nadia Kamel', 'Yusuf Naguib')
ON CONFLICT (user_id) DO UPDATE SET
  routine_reminders = EXCLUDED.routine_reminders,
  recognition_opt_in = EXCLUDED.recognition_opt_in,
  recognition_opt_in_at = COALESCE(profile_prefs.recognition_opt_in_at, EXCLUDED.recognition_opt_in_at),
  share_with_hr = EXCLUDED.share_with_hr,
  share_with_hr_at = COALESCE(profile_prefs.share_with_hr_at, EXCLUDED.share_with_hr_at),
  updated_at = now();

UPDATE public.profiles SET consent_version = 'v2'
 WHERE id IN (SELECT id FROM _m WHERE display_name IN ('Amira Hassan', 'Lina Farouk', 'Nadia Kamel', 'Yusuf Naguib'));

-- ── 6. HR's own article and facts ────────────────────────────
INSERT INTO public.content_items (id, slug, kind, title_en, title_ar, description_en, description_ar,
                                  body_en, body_ar, duration_mins, category, published, status, sort_order,
                                  featured, locale, company_id, created_by)
SELECT v.id::uuid, v.slug, v.kind, v.t_en, v.t_ar, v.d_en, v.d_ar, v.b_en, v.b_ar, v.mins, 'movement',
       true, 'published', v.ord, false, 'global', (SELECT co FROM _ctx), (SELECT hr_user FROM _ctx)
FROM (VALUES
  ('00000000-0000-0000-0024-000000000001', 'co-wellhouse-desk-day-why', 'article',
   'Why we move every hour', 'ليه بنتحرك كل ساعة',
   'The thinking behind our Desk Day routine.', 'الفكرة ورا روتين يوم المكتب.',
   E'Sitting still for hours is hard on the neck, back and wrists, and it drains energy by mid-afternoon.\n\nOur coach built Desk Day so you never sit more than an hour without a short move. Each one takes about two minutes and needs no change of clothes.\n\nYou don''t have to do them all. Start with the ones that feel good and tick them in Today.',
   E'القعدة ساعات من غير حركة بتتعب الرقبة والضهر والرسغ، وبتسحب الطاقة بعد الضهر.\n\nالكوتش بتاعنا عمل روتين يوم المكتب علشان ما تقعدش أكتر من ساعة من غير حركة صغيرة. كل حركة حوالي دقيقتين ومش محتاجة تغيّر هدومك.\n\nمش لازم تعملهم كلهم. ابدأ باللي مريّحك وعلّم عليهم في «النهارده».',
   3, 1),
  ('00000000-0000-0000-0024-000000000002', 'co-wellhouse-fact-sitting', 'fact',
   'One hour, one move', 'ساعة، حركة',
   NULL, NULL,
   'Standing up for two minutes every hour does more for your back than one long gym session a week.',
   'إنك تقوم دقيقتين كل ساعة بيفيد ضهرك أكتر من تمرين طويل مرة في الأسبوع.',
   NULL, 2),
  ('00000000-0000-0000-0024-000000000003', 'co-wellhouse-fact-blink', 'fact',
   'Blink more', 'رمّش أكتر',
   NULL, NULL,
   'We blink far less while looking at screens. The 20-20-20 break gives your eyes the rest they miss.',
   'إحنا بنرمّش أقل بكتير قدام الشاشات. استراحة ٢٠-٢٠-٢٠ بتدي عينك الراحة اللي ناقصاها.',
   NULL, 3)
) AS v(id, slug, kind, t_en, t_ar, d_en, d_ar, b_en, b_ar, mins, ord)
ON CONFLICT (id) DO UPDATE SET
  kind = EXCLUDED.kind, title_en = EXCLUDED.title_en, title_ar = EXCLUDED.title_ar,
  description_en = EXCLUDED.description_en, description_ar = EXCLUDED.description_ar,
  body_en = EXCLUDED.body_en, body_ar = EXCLUDED.body_ar, duration_mins = EXCLUDED.duration_mins,
  published = true, status = 'published', company_id = EXCLUDED.company_id, updated_at = now();

-- ── 7. HR's own 2-week challenge ─────────────────────────────
INSERT INTO public.challenge_templates (id, slug, title_en, title_ar, kind, default_window_days, target, metric,
                                        payload, company_id, created_by)
SELECT '00000000-0000-0000-0025-000000000001', 'co-wellhouse-water-8-glasses',
       'Water, 8 glasses', 'مية، ٨ كوبايات', 'habit', 10, 8, 'habit',
       '{"category": "hydration",
         "action_en": "Drink 8 glasses of water across the workday.",
         "action_ar": "اشرب ٨ كوبايات مية على مدار يوم الشغل.",
         "why_en": "Mild thirst feels like tiredness or a headache. Spreading water across the day keeps focus steady.",
         "why_ar": "العطش الخفيف بيبان كإنه تعب أو صداع. المية على مدار اليوم بتخلي التركيز ثابت.",
         "tip_en": "One glass with each Desk Day move is most of the way there.",
         "tip_ar": "كوباية مع كل حركة من يوم المكتب توصّلك لمعظمهم.",
         "check_mode": "same_day", "weeks": 2, "success_days": 8,
         "badge_icon": "drop", "badge_color": "#6FB7D9", "company_template": true}'::jsonb,
       (SELECT co FROM _ctx), (SELECT hr_user FROM _ctx)
ON CONFLICT (id) DO UPDATE SET
  title_en = EXCLUDED.title_en, title_ar = EXCLUDED.title_ar, default_window_days = EXCLUDED.default_window_days,
  target = EXCLUDED.target, payload = EXCLUDED.payload, company_id = EXCLUDED.company_id,
  archived_at = NULL, updated_at = now();

-- Book it from next Sunday for two weeks, if free (an untouched default
-- week gives way, like hr_schedule_habit_challenge does).
CREATE TEMP TABLE _wk ON COMMIT DROP AS
SELECT (c.today - EXTRACT(DOW FROM c.today)::int + 7)::date AS ws FROM _ctx c;

DELETE FROM public.challenges d
 WHERE d.company_id = (SELECT co FROM _ctx) AND d.kind = 'habit' AND d.payload ->> 'auto' = 'true'
   AND d.start_date <= (SELECT ws + 11 FROM _wk) AND d.end_date >= (SELECT ws FROM _wk)
   AND NOT EXISTS (SELECT 1 FROM public.habit_logs l WHERE l.challenge_id = d.id)
   AND NOT EXISTS (SELECT 1 FROM public.challenges x WHERE x.id = '00000000-0000-0000-0026-000000000001');

INSERT INTO public.challenges (id, company_id, title_en, title_ar, description_en, description_ar,
                               metric, goal_value, start_date, end_date, duration_days,
                               badge_icon, badge_color, active, kind, template_id, team_id, payload)
SELECT '00000000-0000-0000-0026-000000000001', (SELECT co FROM _ctx), t.title_en, t.title_ar,
       t.payload ->> 'action_en', t.payload ->> 'action_ar', 'habit', 8, w.ws, w.ws + 11, 10,
       'drop', '#6FB7D9', true, 'habit', t.id, NULL, t.payload
  FROM public.challenge_templates t, _wk w
 WHERE t.id = '00000000-0000-0000-0025-000000000001'
   AND NOT EXISTS (SELECT 1 FROM public.challenges c
                    WHERE c.company_id = (SELECT co FROM _ctx) AND c.kind = 'habit' AND c.active
                      AND c.start_date <= w.ws + 11 AND c.end_date >= w.ws)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Quick look:
--   SELECT count(*) FROM public.routine_checks WHERE company_id = '00000000-0000-0000-0000-000000000001';
--   SELECT day, count(*) FILTER (WHERE all_done) AS full, count(*) FROM public.routine_days
--    WHERE company_id = '00000000-0000-0000-0000-000000000001' GROUP BY day ORDER BY day;
