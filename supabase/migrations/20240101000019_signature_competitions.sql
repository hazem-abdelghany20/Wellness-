-- Wellness+ v2 signature competitions — Sprint 3.
-- Sabr (21-day path · Islamic patience + DBT distress tolerance)
-- Niyyah (7-day intention sprint · Islamic intention + IF-THEN planning)
-- Both reuse the existing challenges table with two new columns.

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS theme            TEXT,
  ADD COLUMN IF NOT EXISTS cultural_context TEXT,
  ADD COLUMN IF NOT EXISTS duration_days    INT;

-- One row per day per signature competition (the practice content).
CREATE TABLE public.competition_practice_days (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  day_number    INT NOT NULL CHECK (day_number >= 1),
  title_en      TEXT NOT NULL,
  title_ar      TEXT,
  body_en       TEXT NOT NULL,
  body_ar       TEXT,
  prompt_en     TEXT,
  prompt_ar     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, day_number)
);

CREATE INDEX idx_cpd_challenge ON public.competition_practice_days(challenge_id, day_number);

-- User completions of each day. Optional reflection text.
CREATE TABLE public.practice_completions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id   UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_number     INT NOT NULL CHECK (day_number >= 1),
  completed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reflection     TEXT,
  UNIQUE (challenge_id, user_id, day_number)
);

CREATE INDEX idx_pc_user_challenge ON public.practice_completions(user_id, challenge_id);

-- RLS
ALTER TABLE public.competition_practice_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_completions      ENABLE ROW LEVEL SECURITY;

-- Practice days: visible to anyone who can read the parent challenge.
CREATE POLICY "cpd_company_read" ON public.competition_practice_days
  FOR SELECT USING (
    challenge_id IN (
      SELECT id FROM public.challenges
      WHERE company_id IS NULL
         OR company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
    )
  );

CREATE POLICY "service_role_cpd" ON public.competition_practice_days
  USING (auth.role() = 'service_role');

-- Completions: user reads + writes their own.
CREATE POLICY "pc_own_select" ON public.practice_completions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "pc_own_insert" ON public.practice_completions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "pc_own_update" ON public.practice_completions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "service_role_pc" ON public.practice_completions
  USING (auth.role() = 'service_role');

-- ── Seed Sabr (21-day) and Niyyah (7-day) signature competitions ──────

DO $$
DECLARE
  v_sabr_id   UUID;
  v_niyyah_id UUID;
BEGIN
  INSERT INTO public.challenges (
    company_id, title_en, title_ar, description_en, description_ar,
    metric, goal_value, start_date, end_date,
    theme, cultural_context, duration_days, badge_icon, badge_color, active
  )
  VALUES (
    NULL,
    'Sabr — 21 Days of Patience',
    'صبر — ٢١ يوماً من الصبر',
    'A 21-day path weaving Islamic sabr with DBT distress tolerance. One small practice each day.',
    'مسار من ٢١ يوماً يجمع بين الصبر الإسلامي وتحمل الضيق من DBT. ممارسة صغيرة كل يوم.',
    'checkins', 21,
    CURRENT_DATE, CURRENT_DATE + INTERVAL '21 days',
    'sabr', 'islamic_dbt', 21, 'leaf', '#1F5A4E', true
  )
  RETURNING id INTO v_sabr_id;

  INSERT INTO public.competition_practice_days (challenge_id, day_number, title_en, title_ar, body_en, body_ar, prompt_en, prompt_ar) VALUES
  (v_sabr_id, 1,  'Notice', 'الملاحظة', 'Name a difficult feeling without judgment. Just label it.', 'سمِّ شعوراً صعباً دون حكم. فقط ضع له اسماً.', 'What feeling did you notice today?', 'ما الشعور الذي لاحظته اليوم؟'),
  (v_sabr_id, 2,  'Observe', 'المراقبة', 'Watch the feeling for 60 seconds without acting on it.', 'راقب الشعور لمدة ٦٠ ثانية دون التصرّف بناءً عليه.', 'What changed when you just observed?', 'ما الذي تغيّر عندما اكتفيت بالمراقبة؟'),
  (v_sabr_id, 3,  'Body', 'الجسد', 'Where in your body does this difficulty live? Place a hand there.', 'أين تسكن هذه الصعوبة في جسدك؟ ضع يدك عليها.', 'Describe the physical sensation.', 'صف الإحساس الجسدي.'),
  (v_sabr_id, 4,  'Breath', 'النَفَس', 'Box breathing — 4 in, 4 hold, 4 out, 4 hold. Three rounds.', 'تنفس مربع — ٤ شهيق، ٤ احتباس، ٤ زفير، ٤ احتباس. ثلاث دورات.', 'How did your body shift?', 'كيف تحوّل جسدك؟'),
  (v_sabr_id, 5,  'Pause', 'التوقف', 'Insert a 5-second pause before any reactive response today.', 'أدخل وقفة من ٥ ثوانٍ قبل أي ردّ فعل اليوم.', 'When did the pause matter most?', 'متى كانت الوقفة الأهم؟'),
  (v_sabr_id, 6,  'Words', 'الكلمات', 'Say "this is hard" out loud, gently, to yourself.', 'قل "هذا صعب" بصوت عالٍ ولطفٍ تجاه نفسك.', 'What did saying it aloud unlock?', 'ماذا فتح قول ذلك بصوت عالٍ؟'),
  (v_sabr_id, 7,  'Companion', 'الرفيق', 'How would you sit with a friend going through this exact thing?', 'كيف ستجلس مع صديق يمرّ بنفس هذا؟', 'Now, can you sit with yourself that way?', 'الآن، أيمكنك الجلوس مع نفسك بنفس الطريقة؟'),
  (v_sabr_id, 8,  'Permission', 'الإذن', 'Allow the discomfort without trying to fix it. Just for today.', 'اسمح للضيق دون محاولة إصلاحه. فقط لهذا اليوم.', 'What does allowing feel like?', 'ما شعور الإذن؟'),
  (v_sabr_id, 9,  'Time', 'الزمن', 'Remember: this feeling is temporary, not who you are.', 'تذكر: هذا الشعور عابر، وليس هويتك.', 'Recall a feeling that has already passed.', 'استدعِ شعوراً قد مضى.'),
  (v_sabr_id, 10, 'Acceptance', 'القبول', 'Soften your jaw, your shoulders, your story about this.', 'ليّن فكّك، كتفيك، روايتك عن هذا.', 'What softened first?', 'ما الذي ليّن أولاً؟'),
  (v_sabr_id, 11, 'Story', 'الرواية', 'Notice the second arrow — the suffering you add on top of the pain.', 'لاحظ السهم الثاني — المعاناة التي تضيفها فوق الألم.', 'What is your second arrow?', 'ما سهمك الثاني؟'),
  (v_sabr_id, 12, 'Reframe', 'إعادة التأطير', 'What is this difficulty teaching you about your edges?', 'ماذا تعلّمك هذه الصعوبة عن حدودك؟', 'Write one lesson, however small.', 'اكتب درساً واحداً، مهما صغر.'),
  (v_sabr_id, 13, 'Wisdom', 'الحكمة', 'Pull from a memory of a hard time you survived.', 'استدعِ ذاكرة وقت صعب نجوت منه.', 'What got you through then?', 'ما الذي أعانك حينها؟'),
  (v_sabr_id, 14, 'Tawakkul', 'التوكّل', 'Hand the outcome over. Do your part. Trust the rest.', 'سلّم النتيجة. افعل دورك. وثق بالباقي.', 'What can you release today?', 'ماذا يمكنك أن تطلق اليوم؟'),
  (v_sabr_id, 15, 'Patience', 'الصبر', 'Choose patience for one specific moment today.', 'اختر الصبر في لحظة محدّدة اليوم.', 'Which moment did you choose?', 'أيّ لحظة اخترت؟'),
  (v_sabr_id, 16, 'Prayer', 'الصلاة', 'Pray two raka''at naming this difficulty before Allah.', 'صلِّ ركعتين تذكر فيهما هذه الصعوبة بين يدي الله.', 'What did you ask for?', 'ماذا سألت؟'),
  (v_sabr_id, 17, 'Charity', 'الصدقة', 'Do one small kind act despite the difficulty.', 'افعل عملاً لطيفاً صغيراً رغم الصعوبة.', 'How did giving feel?', 'ما شعور العطاء؟'),
  (v_sabr_id, 18, 'Gratitude', 'الشكر', 'Find one thing to thank Allah for inside this difficulty.', 'اعثر على شيء تشكر الله عليه داخل هذه الصعوبة.', 'Name it.', 'سمّه.'),
  (v_sabr_id, 19, 'Connection', 'التواصل', 'Tell someone you trust how you''re really doing.', 'أخبر شخصاً تثق به كيف حالك حقاً.', 'What did you say?', 'ماذا قلت؟'),
  (v_sabr_id, 20, 'Integration', 'التكامل', 'Sit in silence for 10 minutes. Let the lesson settle.', 'اجلس في صمت لمدة ١٠ دقائق. دع الدرس يستقرّ.', 'What rose to the surface?', 'ما الذي طفا إلى السطح؟'),
  (v_sabr_id, 21, 'Witness', 'الشهادة', 'Reflect on who you are now versus 21 days ago.', 'تأمّل من أنت الآن مقارنةً بمن كنت قبل ٢١ يوماً.', 'What shifted?', 'ما الذي تحوّل؟');

  INSERT INTO public.challenges (
    company_id, title_en, title_ar, description_en, description_ar,
    metric, goal_value, start_date, end_date,
    theme, cultural_context, duration_days, badge_icon, badge_color, active
  )
  VALUES (
    NULL,
    'Niyyah — 7 Days of Intention',
    'نيّة — ٧ أيام من النيّة',
    'A 7-day sprint pairing Islamic niyyah with implementation-intention research. Set, plan, renew.',
    'سباق من ٧ أيام يجمع النيّة الإسلامية مع أبحاث نيّات التنفيذ. حدّد، خطّط، جدّد.',
    'checkins', 7,
    CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days',
    'niyyah', 'islamic_implementation_intention', 7, 'target', '#C27A38', true
  )
  RETURNING id INTO v_niyyah_id;

  INSERT INTO public.competition_practice_days (challenge_id, day_number, title_en, title_ar, body_en, body_ar, prompt_en, prompt_ar) VALUES
  (v_niyyah_id, 1, 'Foundation', 'الأساس', 'Write your highest intention for these 7 days. Be specific.', 'اكتب أسمى نيّة لهذه السبعة أيام. كن محدّداً.', 'My intention is…', 'نيّتي هي…'),
  (v_niyyah_id, 2, 'Obstacle', 'العائق', 'Name the most likely obstacle to your intention.', 'سمّ أكثر العوائق ترجيحاً أمام نيّتك.', 'My biggest obstacle is…', 'أكبر عائق هو…'),
  (v_niyyah_id, 3, 'If-Then', 'إذا-عندئذٍ', 'Write 3 if-then plans: "If [obstacle], then [action]."', 'اكتب ٣ خطط إذا-عندئذٍ: "إذا حدث [عائق]، عندئذٍ [فعل]."', 'List your three if-thens.', 'اذكر ثلاث خطط.'),
  (v_niyyah_id, 4, 'Renewal', 'التجديد', 'Restate your intention before fajr today. Out loud.', 'أعد ذكر نيّتك قبل الفجر اليوم. بصوت مسموع.', 'How did fajr feel?', 'كيف كان الفجر؟'),
  (v_niyyah_id, 5, 'Audit', 'المراجعة', 'What did you actually do? What did intention look like in practice?', 'ماذا فعلت فعلاً؟ كيف بدت النيّة في الممارسة؟', 'Honest audit:', 'مراجعة صادقة:'),
  (v_niyyah_id, 6, 'Recommit', 'إعادة الالتزام', 'Adjust if needed. Recommit before maghrib.', 'عدّل إن لزم. أعد الالتزام قبل المغرب.', 'What needs adjusting?', 'ما الذي يحتاج تعديلاً؟'),
  (v_niyyah_id, 7, 'Reflect', 'التأمل', 'What did you learn about your niyyah this week?', 'ماذا تعلّمت عن نيّتك هذا الأسبوع؟', 'One sentence summary:', 'ملخّص بجملة واحدة:');
END $$;
