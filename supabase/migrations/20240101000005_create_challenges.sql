-- Challenges and leaderboards
CREATE TABLE public.challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,  -- NULL = global
  title_en        TEXT NOT NULL,
  title_ar        TEXT,
  description_en  TEXT,
  description_ar  TEXT,
  metric          TEXT NOT NULL CHECK (metric IN ('sleep','stress','energy','mood','checkins','content')),
  goal_value      NUMERIC NOT NULL DEFAULT 7.0,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  participant_cap INT,
  badge_icon      TEXT DEFAULT 'trophy',
  badge_color     TEXT DEFAULT '#F5B544',
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_challenges_company ON public.challenges(company_id);
CREATE INDEX idx_challenges_active  ON public.challenges(active, start_date, end_date);

-- Participation
CREATE TABLE public.challenge_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES public.companies(id),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  score           NUMERIC NOT NULL DEFAULT 0,
  rank            INT,
  completed       BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX idx_cp_challenge ON public.challenge_participants(challenge_id);
CREATE INDEX idx_cp_user      ON public.challenge_participants(user_id);

-- Pre-anonymized leaderboard cache — the ONLY cross-user readable table
CREATE TABLE public.challenge_leaderboard_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES public.companies(id),
  rank          INT NOT NULL,
  display_name  TEXT NOT NULL,   -- "You" for self, "Anonymous #N" for others
  avatar_kind   TEXT NOT NULL DEFAULT 'monogram',
  initials      TEXT NOT NULL DEFAULT '?',
  score         NUMERIC NOT NULL,
  is_self       BOOLEAN NOT NULL DEFAULT false,  -- set per-user in Edge Function
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, rank)
);

CREATE INDEX idx_lb_challenge ON public.challenge_leaderboard_cache(challenge_id, rank);

-- RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_leaderboard_cache ENABLE ROW LEVEL SECURITY;

-- Challenges: readable by company members
CREATE POLICY "challenges_company_read" ON public.challenges
  FOR SELECT USING (
    company_id IS NULL OR
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
  );

CREATE POLICY "service_role_challenges" ON public.challenges
  USING (auth.role() = 'service_role');

-- Participants: own rows only (protect who joined)
CREATE POLICY "cp_own_select" ON public.challenge_participants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "cp_own_insert" ON public.challenge_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_role_cp" ON public.challenge_participants
  USING (auth.role() = 'service_role');

-- Leaderboard cache: readable by all company members (pre-anonymized)
CREATE POLICY "lb_company_read" ON public.challenge_leaderboard_cache
  FOR SELECT USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID
  );

CREATE POLICY "service_role_lb" ON public.challenge_leaderboard_cache
  USING (auth.role() = 'service_role');

-- Notify when leaderboard becomes stale
CREATE OR REPLACE FUNCTION notify_leaderboard_stale()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('leaderboard_stale', NEW.challenge_id::TEXT);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lb_stale
  AFTER INSERT OR UPDATE ON public.challenge_participants
  FOR EACH ROW EXECUTE FUNCTION notify_leaderboard_stale();
