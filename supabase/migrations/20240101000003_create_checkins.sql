-- Daily check-ins — the core privacy-sensitive table
CREATE TABLE public.checkins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id),
  checked_at  DATE NOT NULL DEFAULT current_date,
  -- Scores (1-10)
  sleep       SMALLINT NOT NULL CHECK (sleep BETWEEN 1 AND 10),
  stress      SMALLINT NOT NULL CHECK (stress BETWEEN 1 AND 10),
  energy      SMALLINT NOT NULL CHECK (energy BETWEEN 1 AND 10),
  mood        SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 10),
  note        TEXT,
  variant     TEXT DEFAULT 'sliders' CHECK (variant IN ('sliders','emoji','cards')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, checked_at)
);

CREATE INDEX idx_checkins_user_date  ON public.checkins(user_id, checked_at DESC);
CREATE INDEX idx_checkins_company    ON public.checkins(company_id, checked_at DESC);

-- RLS — strict: users only see their own checkins
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins_own_select" ON public.checkins
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "checkins_own_insert" ON public.checkins
  FOR INSERT WITH CHECK (user_id = auth.uid() AND company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID);

CREATE POLICY "checkins_own_update" ON public.checkins
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "checkins_own_delete" ON public.checkins
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "service_role_checkins" ON public.checkins
  USING (auth.role() = 'service_role');

-- Streak update trigger
CREATE OR REPLACE FUNCTION update_streak()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prev_date DATE;
  v_streak    INT;
  v_best      INT;
BEGIN
  -- Get the most recent previous check-in date
  SELECT checked_at INTO v_prev_date
  FROM public.checkins
  WHERE user_id = NEW.user_id AND checked_at < NEW.checked_at
  ORDER BY checked_at DESC
  LIMIT 1;

  -- Calculate new streak
  IF v_prev_date = NEW.checked_at - INTERVAL '1 day' THEN
    SELECT streak_current + 1 INTO v_streak
    FROM public.profiles
    WHERE id = NEW.user_id;
  ELSE
    v_streak := 1;
  END IF;

  -- Update profile
  UPDATE public.profiles
  SET
    streak_current = v_streak,
    streak_best    = GREATEST(streak_best, v_streak),
    checkins_total = checkins_total + 1
  WHERE id = NEW.user_id
  RETURNING streak_best INTO v_best;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_checkin_streak
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION update_streak();
