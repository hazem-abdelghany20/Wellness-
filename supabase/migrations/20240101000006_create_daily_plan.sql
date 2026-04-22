-- Daily plans and action completions
CREATE TABLE public.daily_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id),
  plan_date   DATE NOT NULL DEFAULT current_date,
  actions     JSONB NOT NULL DEFAULT '[]',  -- [{id, type, title_en, title_ar, content_id?, duration_mins}]
  generated   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_date)
);

CREATE INDEX idx_plan_user_date ON public.daily_plans(user_id, plan_date DESC);

-- Action completions (individual taps within a daily plan)
CREATE TABLE public.daily_plan_completions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES public.daily_plans(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id),
  action_id   TEXT NOT NULL,  -- matches actions[].id in daily_plans
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, action_id)
);

CREATE INDEX idx_dpc_user ON public.daily_plan_completions(user_id, completed_at DESC);

-- Enable Realtime on completions for live home screen updates
ALTER TABLE public.daily_plan_completions REPLICA IDENTITY FULL;

-- RLS
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_plan_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_own" ON public.daily_plans
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "completions_own" ON public.daily_plan_completions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "service_role_plans" ON public.daily_plans
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_completions" ON public.daily_plan_completions
  USING (auth.role() = 'service_role');
