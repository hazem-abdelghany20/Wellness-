-- Live test-data cleanup, 9 Nov 2026. NOT a migration.
-- Run in the SQL editor of the live project. One transaction: it first
-- lists what it will delete (and what it keeps), then deletes exactly that.
-- To only look, change the COMMIT at the end to ROLLBACK.
--
-- Deletes ONLY:
--   1. pending (not accepted) invites for
--        karim.adel@demo.wellhouse.test, mona.fathy@demo.wellhouse.test,
--        youssef.nabil@demo.wellhouse.test, wellness.test.employee@example.com
--   2. the auth user (and with it the profile and everything that cascades
--      from it: check-ins, ticks, prefs, push devices, notifications) with
--      email wellness.test.employee@example.com, if Hazem signed up with it
--   3. the ARCHIVED challenge template titled "QA test – Neck stretch break"
--      (en dash or hyphen), only if no challenge was ever booked from it —
--      otherwise it stays archived — plus its hide/pin rows.

BEGIN;

CREATE TEMP TABLE _invite_emails (email TEXT PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _invite_emails VALUES
  ('karim.adel@demo.wellhouse.test'), ('mona.fathy@demo.wellhouse.test'),
  ('youssef.nabil@demo.wellhouse.test'), ('wellness.test.employee@example.com');

-- ── 1. What will be deleted / kept ───────────────────────────
SELECT 'DELETE pending invite' AS action, i.email, i.role, i.created_at, c.name AS company
  FROM public.pending_company_associations i
  LEFT JOIN public.companies c ON c.id = i.company_id
 WHERE lower(i.email) IN (SELECT email FROM _invite_emails) AND i.accepted_at IS NULL
UNION ALL
SELECT 'KEEP accepted invite', i.email, i.role, i.created_at, c.name
  FROM public.pending_company_associations i
  LEFT JOIN public.companies c ON c.id = i.company_id
 WHERE lower(i.email) IN (SELECT email FROM _invite_emails) AND i.accepted_at IS NOT NULL
UNION ALL
SELECT 'DELETE user + profile', u.email, p.role, u.created_at, c.name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.companies c ON c.id = p.company_id
 WHERE lower(u.email) = 'wellness.test.employee@example.com'
UNION ALL
SELECT CASE WHEN t.archived_at IS NULL THEN 'KEEP template (not archived)'
            WHEN EXISTS (SELECT 1 FROM public.challenges ch WHERE ch.template_id = t.id)
              THEN 'KEEP template (a challenge used it; stays archived)'
            ELSE 'DELETE archived template' END,
       t.title_en, t.slug, t.created_at, c.name
  FROM public.challenge_templates t
  LEFT JOIN public.companies c ON c.id = t.company_id
 WHERE t.title_en IN ('QA test – Neck stretch break', 'QA test - Neck stretch break')
ORDER BY 1, 2;

-- ── 2. Delete ────────────────────────────────────────────────
WITH d AS (
  DELETE FROM public.pending_company_associations i
   WHERE lower(i.email) IN (SELECT email FROM _invite_emails) AND i.accepted_at IS NULL
  RETURNING i.email)
SELECT 'deleted pending invites' AS done, count(*) AS n FROM d;

WITH d AS (
  DELETE FROM auth.users u
   WHERE lower(u.email) = 'wellness.test.employee@example.com'
  RETURNING u.id)
SELECT 'deleted auth users (profile cascades)' AS done, count(*) AS n FROM d;

WITH t AS (
  SELECT id FROM public.challenge_templates t
   WHERE t.title_en IN ('QA test – Neck stretch break', 'QA test - Neck stretch break')
     AND t.archived_at IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.challenges ch WHERE ch.template_id = t.id)
), p AS (
  DELETE FROM public.company_library_prefs lp
   WHERE lp.item_type = 'challenge_template' AND lp.item_id IN (SELECT id FROM t)
  RETURNING lp.item_id
), d AS (
  DELETE FROM public.challenge_templates ct WHERE ct.id IN (SELECT id FROM t)
  RETURNING ct.id)
SELECT 'deleted archived QA template' AS done, (SELECT count(*) FROM d) AS n,
       (SELECT count(*) FROM p) AS prefs_rows;

-- ── 3. Nothing of it left ────────────────────────────────────
SELECT
  (SELECT count(*) FROM public.pending_company_associations
    WHERE lower(email) IN (SELECT email FROM _invite_emails) AND accepted_at IS NULL) AS pending_left,
  (SELECT count(*) FROM auth.users WHERE lower(email) = 'wellness.test.employee@example.com') AS users_left,
  (SELECT count(*) FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE lower(u.email) = 'wellness.test.employee@example.com') AS profiles_left;
--   → 0 | 0 | 0

COMMIT;
