-- Wellness+ Demo Seed (supplementary)
-- Idempotent — safe to paste into Supabase Dashboard → SQL Editor → Run.
-- Adds realistic rows for the sections that were previously rendering
-- from hardcoded HR_DATA / ADMIN_DATA fallbacks in the frontend.
--
-- Depends on the base seed having already created:
--   companies (WH-4782 = '00000000-0000-0000-0000-000000000001')
--   teams (5 rows)
--   profiles (6 demo employees in slot '00000000-0000-0000-1000-000000000001..6')
--   challenges (1 row '00000000-0000-0000-0003-000000000001')

-- ── Check-in history (90 days, all 6 demo employees) ─────────
-- Generates one daily checkin per employee. Slight per-employee bias
-- keeps the at-risk / safe split believable.
WITH days AS (
  SELECT (current_date - i)::date AS d FROM generate_series(0, 89) AS i
),
emps AS (
  SELECT
    id,
    company_id,
    -- bias: lower numbers = struggling team
    CASE
      WHEN display_name = 'Amira Hassan'  THEN 0
      WHEN display_name = 'Yusuf Naguib'  THEN 1
      WHEN display_name = 'Lina Farouk'   THEN 2
      WHEN display_name = 'Omar Sami'     THEN 3
      WHEN display_name = 'Nadia Kamel'   THEN 4
      WHEN display_name = 'Sara Anwar'    THEN 5
    END AS bias
  FROM public.profiles
  WHERE company_id = '00000000-0000-0000-0000-000000000001'
    AND display_name IN ('Amira Hassan','Yusuf Naguib','Lina Farouk','Omar Sami','Nadia Kamel','Sara Anwar')
)
INSERT INTO public.checkins (user_id, company_id, checked_at, sleep, stress, energy, mood)
SELECT
  e.id, e.company_id, d.d,
  GREATEST(1, LEAST(10, 6 + e.bias + (random() * 2 - 1)::int))::smallint,
  GREATEST(1, LEAST(10, 5 - e.bias + (random() * 2 - 1)::int))::smallint,
  GREATEST(1, LEAST(10, 5 + e.bias + (random() * 2 - 1)::int))::smallint,
  GREATEST(1, LEAST(10, 6 + e.bias + (random() * 2 - 1)::int))::smallint
FROM emps e CROSS JOIN days d
ON CONFLICT (user_id, checked_at) DO NOTHING;

-- ── Challenge participants for the seeded Sleep Sprint ───────
INSERT INTO public.challenge_participants (challenge_id, user_id, company_id, score)
SELECT
  '00000000-0000-0000-0003-000000000001',
  p.id,
  p.company_id,
  (40 + random() * 60)::numeric(5,1)
FROM public.profiles p
WHERE p.company_id = '00000000-0000-0000-0000-000000000001'
  AND p.display_name IN ('Amira Hassan','Yusuf Naguib','Lina Farouk','Omar Sami','Nadia Kamel','Sara Anwar')
ON CONFLICT (challenge_id, user_id) DO NOTHING;

-- ── Broadcasts (3 sent, 1 scheduled, 1 cancelled) ────────────
INSERT INTO public.broadcasts (id, company_id, title_en, title_ar, body_en, body_ar, scope, status, scheduled_at, sent_at, created_by) VALUES
  ('00000000-0000-0000-3000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Welcome to Wellness+', 'مرحبًا بكم في Wellness+',
   'Your daily wellbeing companion is now live. Take 90 seconds for your first check-in.',
   'رفيقك اليومي للعافية متاح الآن. خصص 90 ثانية لأول تسجيل.',
   'all', 'sent',  now() - INTERVAL '30 days', now() - INTERVAL '30 days',
   '00000000-0000-0000-1000-000000000006'),
  ('00000000-0000-0000-3000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Sleep Sprint kicks off Monday', 'تحدي النوم يبدأ الإثنين',
   'Three weeks. One habit. Earn badges as you go.',
   'ثلاثة أسابيع. عادة واحدة. اكسب الشارات في طريقك.',
   'all', 'sent',  now() - INTERVAL '14 days', now() - INTERVAL '14 days',
   '00000000-0000-0000-1000-000000000006'),
  ('00000000-0000-0000-3000-000000000003', '00000000-0000-0000-0000-000000000001',
   'Mid-month check-in reminder', 'تذكير منتصف الشهر',
   'A 60-second pulse check helps us tailor your next week.',
   'فحص سريع لمدة 60 ثانية يساعدنا على تخصيص أسبوعك.',
   'all', 'sent',  now() - INTERVAL '5 days', now() - INTERVAL '5 days',
   '00000000-0000-0000-1000-000000000006'),
  ('00000000-0000-0000-3000-000000000004', '00000000-0000-0000-0000-000000000001',
   'Monthly leaderboard celebration', 'الاحتفال بمتصدري الشهر',
   'Friday at 3pm — gold / silver / bronze winners take the stage.',
   'الجمعة 3م — متصدرو الذهب / الفضة / البرونز على المنصة.',
   'all', 'scheduled', now() + INTERVAL '4 days', NULL,
   '00000000-0000-0000-1000-000000000006'),
  ('00000000-0000-0000-3000-000000000005', '00000000-0000-0000-0000-000000000001',
   'Town hall postponed', 'تأجيل اللقاء العام',
   'Pushed by a week — new invite incoming.',
   'تم التأجيل أسبوعًا — دعوة جديدة قادمة.',
   'all', 'cancelled', now() - INTERVAL '2 days', NULL,
   '00000000-0000-0000-1000-000000000006')
ON CONFLICT (id) DO NOTHING;

-- ── Integrations (4: 3 healthy, 1 pending) ───────────────────
INSERT INTO public.integrations (id, company_id, kind, status, config, configured_at) VALUES
  ('00000000-0000-0000-4000-000000000001', '00000000-0000-0000-0000-000000000001',
   'slack', 'ok', '{"workspace":"wellhouse"}'::jsonb, now() - INTERVAL '45 days'),
  ('00000000-0000-0000-4000-000000000002', '00000000-0000-0000-0000-000000000001',
   'google-workspace', 'ok', '{"domain":"wellhouse.com"}'::jsonb, now() - INTERVAL '45 days'),
  ('00000000-0000-0000-4000-000000000003', '00000000-0000-0000-0000-000000000001',
   'okta', 'ok', '{"org":"wellhouse"}'::jsonb, now() - INTERVAL '30 days'),
  ('00000000-0000-0000-4000-000000000004', '00000000-0000-0000-0000-000000000001',
   'jira', 'pending', '{}'::jsonb, NULL)
ON CONFLICT (company_id, kind) DO NOTHING;

-- ── Feature flags (5 global + 1 company-scoped) ──────────────
INSERT INTO public.feature_flags (id, key, scope, target_id, enabled, payload) VALUES
  ('00000000-0000-0000-5000-000000000001', 'gift_engine_v0',         'global',  NULL, true,  '{}'),
  ('00000000-0000-0000-5000-000000000002', 'signature_competitions', 'global',  NULL, true,  '{}'),
  ('00000000-0000-0000-5000-000000000003', 'arabic_voice_coach',     'global',  NULL, false, '{"rollout":0.15}'),
  ('00000000-0000-0000-5000-000000000004', 'team_drilldown',         'global',  NULL, true,  '{}'),
  ('00000000-0000-0000-5000-000000000005', 'wallet_v2',              'global',  NULL, true,  '{}'),
  ('00000000-0000-0000-5000-000000000006', 'beta_breathing_packs',   'company', '00000000-0000-0000-0000-000000000001', true, '{"packs":3}')
ON CONFLICT (key, scope, target_id) DO NOTHING;

-- ── Audit log (8 recent entries spanning platform actions) ───
INSERT INTO public.audit_log (id, occurred_at, actor_id, actor_email, action, target, target_id, severity, details) VALUES
  ('00000000-0000-0000-6000-000000000001', now() - INTERVAL '6 hours',
   '00000000-0000-0000-1000-000000000006', 'sara.hr@demo.wellhouse.test',
   'broadcast.scheduled', 'Wellhouse Group · Monthly leaderboard celebration',
   '00000000-0000-0000-3000-000000000004', 'info', '{}'::jsonb),
  ('00000000-0000-0000-6000-000000000002', now() - INTERVAL '1 day',
   NULL, 'system', 'leaderboard.refresh', 'Sleep Sprint',
   '00000000-0000-0000-0003-000000000001', 'info', '{}'::jsonb),
  ('00000000-0000-0000-6000-000000000003', now() - INTERVAL '2 days',
   '00000000-0000-0000-1000-000000000006', 'sara.hr@demo.wellhouse.test',
   'gift.fulfilled', 'Amira Hassan · bronze',
   '00000000-0000-0000-2000-000000000003', 'info', '{}'::jsonb),
  ('00000000-0000-0000-6000-000000000004', now() - INTERVAL '3 days',
   NULL, 'system', 'integration.sync', 'Google Workspace',
   '00000000-0000-0000-4000-000000000002', 'info', '{}'::jsonb),
  ('00000000-0000-0000-6000-000000000005', now() - INTERVAL '5 days',
   NULL, 'system', 'flag.toggled', 'wallet_v2',
   '00000000-0000-0000-5000-000000000005', 'warn', '{"from":false,"to":true}'::jsonb),
  ('00000000-0000-0000-6000-000000000006', now() - INTERVAL '7 days',
   '00000000-0000-0000-1000-000000000006', 'sara.hr@demo.wellhouse.test',
   'broadcast.sent', 'Wellhouse Group · Mid-month check-in reminder',
   '00000000-0000-0000-3000-000000000003', 'info', '{}'::jsonb),
  ('00000000-0000-0000-6000-000000000007', now() - INTERVAL '14 days',
   NULL, 'system', 'challenge.started', 'Sleep Sprint',
   '00000000-0000-0000-0003-000000000001', 'info', '{}'::jsonb),
  ('00000000-0000-0000-6000-000000000008', now() - INTERVAL '30 days',
   '00000000-0000-0000-1000-000000000006', 'sara.hr@demo.wellhouse.test',
   'broadcast.sent', 'Wellhouse Group · Welcome to Wellness+',
   '00000000-0000-0000-3000-000000000001', 'info', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── Challenge templates (catalogue HR can pick from) ─────────
INSERT INTO public.challenge_templates (id, slug, title_en, title_ar, kind, default_window_days, target, metric, payload) VALUES
  ('00000000-0000-0000-7000-000000000001', 'sleep-sprint-21',
   '21-Day Sleep Sprint',         'تحدي النوم 21 يوماً',
   'team',       21,  7, 'sleep',    '{"badge_icon":"moon","badge_color":"#F5B544","description_en":"Average 7+ on sleep for 21 days.","description_ar":"تحقيق متوسط نوم 7+ لمدة 21 يومًا."}'::jsonb),
  ('00000000-0000-0000-7000-000000000002', 'stress-less-14',
   '14-Day Stress Less',          'تحدي خفض التوتر 14 يوماً',
   'team',       14,  4, 'stress',   '{"badge_icon":"leaf","badge_color":"#7BC4A4","description_en":"Drop your average stress by 1 point.","description_ar":"خفض متوسط التوتر بنقطة كاملة."}'::jsonb),
  ('00000000-0000-0000-7000-000000000003', 'energy-boost-10',
   '10-Day Energy Boost',         'تحدي الطاقة 10 أيام',
   'team',       10,  7, 'energy',   '{"badge_icon":"bolt","badge_color":"#E48460","description_en":"Average 7+ on energy for 10 days.","description_ar":"تحقيق متوسط طاقة 7+ لمدة 10 أيام."}'::jsonb),
  ('00000000-0000-0000-7000-000000000004', 'mood-lift-7',
   '7-Day Mood Lift',             'تحدي تحسين المزاج 7 أيام',
   'team',        7,  7, 'mood',     '{"badge_icon":"sun","badge_color":"#F5B544","description_en":"Average 7+ on mood for a week.","description_ar":"تحقيق متوسط مزاج 7+ لأسبوع."}'::jsonb),
  ('00000000-0000-0000-7000-000000000005', 'streak-30',
   '30-Day Check-in Streak',      'تحدي المواظبة 30 يومًا',
   'individual', 30, 30, 'checkins', '{"badge_icon":"trophy","badge_color":"#9B7BD4","description_en":"Check in every day for 30 days.","description_ar":"سجّل دخولك كل يوم لمدة 30 يومًا."}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
