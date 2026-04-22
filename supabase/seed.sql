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
