-- Push notifications and in-app notifications
CREATE TABLE public.push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_user ON public.push_tokens(user_id) WHERE active = true;

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id),
  kind        TEXT NOT NULL CHECK (kind IN ('checkin_reminder','challenge_update','insight','streak','system')),
  title_en    TEXT NOT NULL,
  title_ar    TEXT,
  body_en     TEXT,
  body_ar     TEXT,
  deep_link   TEXT,
  read        BOOLEAN NOT NULL DEFAULT false,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifs_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifs_unread ON public.notifications(user_id) WHERE read = false;

-- Enable Realtime for live notification badge
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tokens_own" ON public.push_tokens
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "notifs_own_select" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifs_own_update" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "service_role_tokens" ON public.push_tokens
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_notifs" ON public.notifications
  USING (auth.role() = 'service_role');
