-- Pending company code associations (pre-auth validation)
CREATE TABLE public.pending_company_associations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL,
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  verified        BOOLEAN NOT NULL DEFAULT false,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_email ON public.pending_company_associations(email);

-- Auto-expire old records
CREATE OR REPLACE FUNCTION cleanup_expired_pending()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM public.pending_company_associations
  WHERE expires_at < now();
$$;

-- RLS: service_role only (Edge Functions manage this table)
ALTER TABLE public.pending_company_associations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_pending" ON public.pending_company_associations
  USING (auth.role() = 'service_role');
