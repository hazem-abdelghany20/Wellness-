-- Profile preference columns referenced by the employee Profile screen
-- but missing from the original schema. The screen previously held these
-- in local React state only, so toggling reset on every reload.
--
-- Defaults match the screen's prior local-state defaults so existing
-- profiles see no behavior change.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS anon            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS share_aggregate BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_opt_in   BOOLEAN NOT NULL DEFAULT true;
