-- Wellness+ Seed Data
-- Demo companies, teams, content library, active challenge

-- ── Companies ────────────────────────────────────────────────
INSERT INTO public.companies (id, name, slug, code, plan, settings) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Wellhouse Group',
    'wellhouse',
    'WH-4782',
    'enterprise',
    '{"locale":"en","timezone":"Asia/Dubai"}'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'مجموعة النيل',
    'nile-group',
    'NG-9130',
    'growth',
    '{"locale":"ar","timezone":"Africa/Cairo"}'
  )
ON CONFLICT (id) DO NOTHING;

-- ── Teams ────────────────────────────────────────────────────
INSERT INTO public.teams (id, company_id, name, department) VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'Engineering',  'Technology'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'Finance',       'Finance'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', 'People & Ops',  'HR'),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000002', 'المالية',        'Finance'),
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000002', 'التقنية',        'Technology')
ON CONFLICT (id) DO NOTHING;

-- ── Content Library ──────────────────────────────────────────
INSERT INTO public.content_items (id, slug, kind, title_en, title_ar, description_en, description_ar, duration_mins, category, featured, sort_order) VALUES
  (
    '00000000-0000-0000-0002-000000000001',
    'sleep-onset',
    'audio',
    'Sleep onset — a cue for tonight',
    'بداية النوم — إشارة لهذه الليلة',
    'A guided audio session to help you fall asleep faster.',
    'جلسة صوتية موجهة لمساعدتك على النوم بشكل أسرع.',
    6, 'sleep', true, 10
  ),
  (
    '00000000-0000-0000-0002-000000000002',
    'box-breath',
    'audio',
    'Box breathing, guided',
    'تنفس مربع، موجَّه',
    '4-4-4-4 box breathing to calm your nervous system.',
    'تنفس مربع 4-4-4-4 لتهدئة جهازك العصبي.',
    2, 'stress', true, 20
  ),
  (
    '00000000-0000-0000-0002-000000000003',
    'desk-mob',
    'video',
    'Desk mobility flow',
    'حركات مكتبية',
    'A 4-minute movement routine for desk workers.',
    'روتين حركة 4 دقائق لموظفي المكاتب.',
    4, 'movement', false, 30
  ),
  (
    '00000000-0000-0000-0002-000000000004',
    'reset',
    'audio',
    'A 3-minute reset between meetings',
    'استراحة 3 دقائق بين الاجتماعات',
    'Quick mindfulness reset to clear mental fog.',
    'إعادة تركيز سريعة لتصفية ضباب العقل.',
    3, 'mindfulness', false, 40
  ),
  (
    '00000000-0000-0000-0002-000000000005',
    'wind-down',
    'article',
    'Build an evening wind-down',
    'بناء روتين استرخاء مسائي',
    'Science-backed tips for a calming bedtime routine.',
    'نصائح مدعومة علمياً لروتين نوم مريح.',
    5, 'sleep', true, 50
  ),
  (
    '00000000-0000-0000-0002-000000000006',
    'caffeine',
    'article',
    'Caffeine cut-off, in plain terms',
    'الكافيين بلغة واضحة',
    'When to stop caffeine for better sleep quality.',
    'متى تتوقف عن الكافيين لجودة نوم أفضل.',
    4, 'sleep', false, 60
  )
ON CONFLICT (id) DO NOTHING;

-- ── Active Challenge ─────────────────────────────────────────
INSERT INTO public.challenges (
  id, company_id, title_en, title_ar, description_en, description_ar,
  metric, goal_value, start_date, end_date, badge_icon, badge_color, active
) VALUES (
  '00000000-0000-0000-0003-000000000001',
  NULL,  -- global challenge, visible to all companies
  '21-Day Sleep Sprint',
  'تحدي النوم 21 يوماً',
  'Log your sleep score every day for 21 days and hit an average of 7+.',
  'سجِّل درجة نومك كل يوم لمدة 21 يوماً وحقق متوسط 7+.',
  'sleep',
  7.0,
  current_date,
  current_date + INTERVAL '21 days',
  'moon',
  '#F5B544',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ── v2 Gift Engine Demo Data ─────────────────────────────────
-- Catalog: 6 WH Services + 2 Custom items. Global (company_id NULL)
-- so every demo tenant sees them. HR can deactivate items they don't
-- offer or override per-company by creating company-scoped copies.

INSERT INTO public.gift_catalog_items (
  id, company_id, name_en, name_ar, description_en, description_ar,
  category, value_minor, currency, active
) VALUES
  ('00000000-0000-0000-0010-000000000001', NULL,
   'Sakoon — 4-week program', 'ساكون — برنامج ٤ أسابيع',
   'Group coaching for stress and burnout recovery.',
   'تدريب جماعي لإدارة الضغط والاحتراق الوظيفي.',
   'wh_service', 50000, 'EGP', true),
  ('00000000-0000-0000-0010-000000000002', NULL,
   'Sleep Reset — 1:1 sessions', 'إعادة ضبط النوم — جلسات فردية',
   '3 individual coaching sessions for sleep.',
   '٣ جلسات تدريب فردية للنوم.',
   'wh_service', 65000, 'EGP', true),
  ('00000000-0000-0000-0010-000000000003', NULL,
   'Stress Less — workshop',  'تقليل الضغط — ورشة',
   'Half-day workshop with breath, journal, and CBT tools.',
   'ورشة نصف يوم بأدوات تنفّس ويوميات و CBT.',
   'wh_service', 35000, 'EGP', true),
  ('00000000-0000-0000-0010-000000000004', NULL,
   'Empath — therapy voucher',  'إمباث — قسيمة علاج',
   '4 sessions with a licensed therapist.',
   '٤ جلسات مع معالج مرخّص.',
   'wh_service', 80000, 'EGP', true),
  ('00000000-0000-0000-0010-000000000005', NULL,
   'Catalyst — leadership 1:1', 'كاتاليست — تدريب قيادة',
   '2 leadership coaching sessions.',
   'جلستا تدريب على القيادة.',
   'wh_service', 45000, 'EGP', true),
  ('00000000-0000-0000-0010-000000000006', NULL,
   'Wellbeing Index — quarterly review',
   'مؤشر الرفاهية — مراجعة فصلية',
   'Personalized data-led wellbeing review.',
   'مراجعة شخصية للرفاهية مبنية على بياناتك.',
   'wh_service', 25000, 'EGP', true),
  ('00000000-0000-0000-0010-000000000010', NULL,
   'Day off — recharge', 'يوم إجازة — لإعادة الشحن',
   'A flexible day off, redeemable within 90 days.',
   'يوم إجازة مرن، يمكن استخدامه خلال ٩٠ يوماً.',
   'custom', 0, 'EGP', true),
  ('00000000-0000-0000-0010-000000000011', NULL,
   'Coffee with the CEO', 'قهوة مع الرئيس التنفيذي',
   '30-minute one-on-one mentorship coffee.',
   'لقاء قهوة لمدة ٣٠ دقيقة وحدك مع الرئيس التنفيذي.',
   'custom', 0, 'EGP', true)
ON CONFLICT (id) DO NOTHING;

-- A demo gift pool for the global Sleep Sprint challenge.
INSERT INTO public.gift_pools (
  id, company_id, name, description, budget_minor, currency, competition_id, active
) VALUES (
  '00000000-0000-0000-0011-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Q2 Sleep Sprint pool',
  'Awards for the 21-Day Sleep Sprint top performers.',
  500000, 'EGP',
  '00000000-0000-0000-0003-000000000001',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Tier configuration for the Sleep Sprint:
-- Bronze: Wellbeing Index review (single fixed reward)
-- Silver: choose between Stress Less workshop OR Catalyst session
-- Gold: choose between Sakoon, Sleep Reset, or Empath voucher
INSERT INTO public.tier_configurations (
  id, company_id, competition_id, tier,
  gift_catalog_item_id, allow_employee_choice, choice_options
) VALUES
  ('00000000-0000-0000-0012-000000000001',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0003-000000000001',
   'bronze',
   '00000000-0000-0000-0010-000000000006',
   false,
   '{}'),
  ('00000000-0000-0000-0012-000000000002',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0003-000000000001',
   'silver',
   NULL,
   true,
   ARRAY['00000000-0000-0000-0010-000000000003'::UUID, '00000000-0000-0000-0010-000000000005'::UUID]),
  ('00000000-0000-0000-0012-000000000003',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0003-000000000001',
   'gold',
   NULL,
   true,
   ARRAY['00000000-0000-0000-0010-000000000001'::UUID, '00000000-0000-0000-0010-000000000002'::UUID, '00000000-0000-0000-0010-000000000004'::UUID])
ON CONFLICT (competition_id, tier) DO NOTHING;
