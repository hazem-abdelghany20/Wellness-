-- admin_invite_company_admin uses ON CONFLICT (email) but the original
-- pending_company_associations table only had a plain index on email,
-- not a UNIQUE constraint. The RPC therefore failed with SQLSTATE 42P10
-- ("there is no unique or exclusion constraint matching the ON CONFLICT
-- specification") every time an admin invited a teammate from the
-- admin portal. Add the constraint.
--
-- Before constraining, dedupe any existing rows by email — keep the
-- most recent verified row so we don't lose verification state.

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY lower(trim(email))
           ORDER BY verified DESC, created_at DESC, id
         ) AS rn
  FROM public.pending_company_associations
)
DELETE FROM public.pending_company_associations p
USING ranked
WHERE p.id = ranked.id AND ranked.rn > 1;

-- Drop the plain index — the unique constraint creates its own index.
DROP INDEX IF EXISTS public.idx_pending_email;

ALTER TABLE public.pending_company_associations
  ADD CONSTRAINT pending_company_associations_email_key UNIQUE (email);
