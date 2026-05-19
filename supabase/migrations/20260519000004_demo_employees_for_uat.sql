-- Demo employees (profiles + check-ins) for HR / Admin portals.
-- Idempotent. auth.users rows already exist remotely from the original
-- supabase/seed.sql ingestion; this migration only fills/refreshes the
-- public.profiles + public.checkins rows so the HR pages render real
-- signal instead of empty states.

INSERT INTO public.profiles (
  id, company_id, team_id, display_name, role,
  baseline_sleep, baseline_stress, baseline_energy, baseline_mood,
  streak_current, streak_best, checkins_total, onboarded, consented_at
)
SELECT u.id, '00000000-0000-0000-0000-000000000001'::uuid, x.team_id,
       x.display_name, x.role,
       x.baseline_sleep, x.baseline_stress, x.baseline_energy, x.baseline_mood,
       x.streak_current, x.streak_best, x.checkins_total, true, now() - INTERVAL '60 days'
FROM (VALUES
  ('amira.hassan@demo.wellhouse.test', '00000000-0000-0000-0001-000000000001'::uuid, 'Amira Hassan',  'employee', 6, 5, 6, 7, 12, 18, 47),
  ('yusuf.naguib@demo.wellhouse.test', '00000000-0000-0000-0001-000000000001'::uuid, 'Yusuf Naguib',  'employee', 7, 4, 7, 7,  5,  9, 22),
  ('lina.farouk@demo.wellhouse.test',  '00000000-0000-0000-0001-000000000002'::uuid, 'Lina Farouk',   'employee', 5, 6, 5, 6,  8, 14, 31),
  ('omar.sami@demo.wellhouse.test',    '00000000-0000-0000-0001-000000000002'::uuid, 'Omar Sami',     'employee', 6, 5, 6, 7,  3,  6, 14),
  ('nadia.kamel@demo.wellhouse.test',  '00000000-0000-0000-0001-000000000003'::uuid, 'Nadia Kamel',   'manager',  7, 4, 8, 8, 21, 21, 63),
  ('sara.hr@demo.wellhouse.test',      '00000000-0000-0000-0001-000000000003'::uuid, 'Sara Anwar',    'hr_admin', 7, 5, 7, 7,  6, 11, 28)
) AS x(email, team_id, display_name, role,
       baseline_sleep, baseline_stress, baseline_energy, baseline_mood,
       streak_current, streak_best, checkins_total)
JOIN auth.users u ON u.email = x.email
ON CONFLICT (id) DO UPDATE SET
  company_id     = EXCLUDED.company_id,
  team_id        = EXCLUDED.team_id,
  display_name   = EXCLUDED.display_name,
  role           = EXCLUDED.role,
  baseline_sleep = EXCLUDED.baseline_sleep,
  baseline_stress= EXCLUDED.baseline_stress,
  baseline_energy= EXCLUDED.baseline_energy,
  baseline_mood  = EXCLUDED.baseline_mood,
  streak_current = EXCLUDED.streak_current,
  streak_best    = EXCLUDED.streak_best,
  checkins_total = EXCLUDED.checkins_total,
  onboarded      = true;

-- 90 days of check-ins per employee with light per-person bias so the
-- team aggregates show different stress / sleep / mood signals.
INSERT INTO public.checkins (user_id, company_id, checked_at, sleep, stress, energy, mood)
SELECT
  p.id, p.company_id, d.d,
  GREATEST(1, LEAST(10, 6 + e.bias + (random() * 2 - 1)::int))::smallint,
  GREATEST(1, LEAST(10, 5 - e.bias + (random() * 2 - 1)::int))::smallint,
  GREATEST(1, LEAST(10, 5 + e.bias + (random() * 2 - 1)::int))::smallint,
  GREATEST(1, LEAST(10, 6 + e.bias + (random() * 2 - 1)::int))::smallint
FROM public.profiles p
JOIN (VALUES
  ('Amira Hassan', 0), ('Yusuf Naguib', 1), ('Lina Farouk', 2),
  ('Omar Sami', -1), ('Nadia Kamel', 2), ('Sara Anwar', 1)
) AS e(display_name, bias) ON e.display_name = p.display_name
CROSS JOIN (SELECT (current_date - i)::date AS d FROM generate_series(0, 89) AS i) d
WHERE p.company_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (user_id, checked_at) DO NOTHING;
