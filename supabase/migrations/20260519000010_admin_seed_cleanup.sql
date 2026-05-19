-- Admin-portal sweep, Phase A.3
--
-- Cleanup of stale/contradictory seed data that surfaces in the admin
-- portal:
--
--  1. Two duplicate copies of `arabic.rtl` global flag (seeded once by
--     the admin migration, once by another migration). Already
--     collapsed by the deduplication in 20260519000008 — re-run
--     deterministically here in case it slips back in.
--  2. Audit-log noise from my exploratory probes (`audit.probe.dryrun`,
--     `audit-probe-…`, manual probe writes left behind).
--  3. An orphan supabase integration row with company_id
--     `00000000-0000-0000-0000-000000000002` that doesn't match any row
--     in `companies` and renders the bare UUID in the UI.
--  4. The `Engineering` / `Finance` / `People & Ops` placeholder teams
--     seeded for Wellhouse that don't match the HR-seed teams. Remove
--     them so the tenant detail page shows the real seeded teams.
--  5. Two seed invoices for Wellhouse so the per-tenant Billing view
--     renders a real history. Idempotent on (company_id, period_end).

-- 1. Make sure feature_flags is duplicate-free (idempotent).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY key, scope,
                        COALESCE(target_id::TEXT, '__null__')
           ORDER BY updated_at DESC, id
         ) AS rn
  FROM public.feature_flags
)
DELETE FROM public.feature_flags
USING ranked
WHERE public.feature_flags.id = ranked.id
  AND ranked.rn > 1;

-- 2. Strip audit-probe rows + matching audit_log noise.
DELETE FROM public.feature_flags WHERE key LIKE 'audit.probe%';
DELETE FROM public.challenge_templates WHERE slug LIKE 'audit-probe-%';
DELETE FROM public.localization_strings WHERE key LIKE 'audit.probe%';

-- 3. Orphan integration rows — any row whose company_id doesn't match
--    a real row in companies.
DELETE FROM public.integrations i
WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = i.company_id);

-- 4. Wellhouse teams (Engineering / Finance / People & Ops) are the
--    real HR-seed teams, not placeholders — leave them alone. Earlier
--    audit assumed they were placeholder data; that was wrong.

-- 5. Seed two illustrative invoices for Wellhouse so the per-tenant
--    Billing view has real rows. Idempotent on (company_id, period_end).
DO $$
DECLARE
  v_company UUID;
  v_existing INT;
BEGIN
  SELECT id INTO v_company FROM public.companies WHERE slug = 'wellhouse' LIMIT 1;
  IF v_company IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_existing FROM public.invoices WHERE company_id = v_company;
  IF v_existing > 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.invoices (company_id, period_start, period_end, amount_cents, currency, status)
  VALUES
    (v_company, date '2026-04-01', date '2026-04-30', 1250000, 'USD', 'paid'),
    (v_company, date '2026-05-01', date '2026-05-31', 1250000, 'USD', 'open');
END $$;

-- 6. Make sure billing_state for Wellhouse reflects the seed numbers
--    referenced everywhere else (250 seats, $12,500 MRR).
UPDATE public.billing_state
SET seats = 250, mrr_cents = 1250000, plan = 'enterprise', status = 'active', updated_at = now()
WHERE company_id = (SELECT id FROM public.companies WHERE slug = 'wellhouse' LIMIT 1);
