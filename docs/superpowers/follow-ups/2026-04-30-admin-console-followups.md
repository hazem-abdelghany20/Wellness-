# Wellness+ Admin Console — Implementation Follow-ups

**Date:** 2026-04-30
**Sub-project:** Admin Console (3 of 3 — final)
**Plan:** [docs/superpowers/plans/2026-04-30-admin-console-implementation.md](../plans/2026-04-30-admin-console-implementation.md)
**Spec:** [docs/superpowers/specs/2026-04-30-admin-console-design.md](../specs/2026-04-30-admin-console-design.md)

## Status

Phases 1–6 are complete (35 frontend commits on `main`). Phase 0
(backend additions) and Phase 7 verification require the live cloud
project from Employee Phase 0.

| Phase | Status |
|---|---|
| 0 — Admin backend additions (tables, RPCs, edge functions, seed) | **Pending — needs cloud project + dashboard access** |
| 1 — Move HR tokens/components to `src/shared/` (cross-app reuse) | ✅ Done (1 commit) |
| 2 — Verbatim extraction of `src/main-admin.jsx` (1,974 → 5 lines) | ✅ Done (7 commits) |
| 3 — `src/lib/supabase-admin.ts` client wrapper | ✅ Done (1 commit) |
| 4 — `AdminAuthContext` + `AdminAppConfigContext` + sign-in + access-denied | ✅ Done (3 commits) |
| 5 — 11 data hooks with TDD (20 new tests) | ✅ Done (11 commits) |
| 6 — Wire all 11 views to hooks | ✅ Done (11 commits) |
| 7 — End-to-end spec verification | **Pending — needs Phase 0 + dashboard SQL access** |

## What works without the backend

- `npm run build` — clean. Admin bundle is 92.07 kB / 21.29 kB gzipped.
- `npm run dev` — `admin.html` serves at HTTP 200.
- `npm test` — 51 tests passing across 27 test files (14 employee + 17 HR + 20 admin).
- File structure under `src/admin/` matches the plan exactly.
- Sign-in screen + role gate (`wellness_admin` only) wired.
- `src/shared/{tokens,components}.jsx` are the canonical home for HR + Admin design primitives. The Employee app keeps its own design-system; HR + Admin share.

## Phase 0 — what the user must do before Phase 7 verification can run

These tasks were detailed in the plan and require the live cloud
project from the Employee sub-project's Phase 0.

### 0.1 Apply migration 0018 — admin tables

`audit_log`, `feature_flags`, `integrations`, `billing_state`,
`invoices`, `challenge_templates`. All RLS-locked to `wellness_admin`
role with service-role write policies. Plan has the full SQL.

### 0.2 Apply migration 0019 — admin RPCs

`write_audit_log` helper plus 5 SECURITY DEFINER RPCs:
- `admin_create_tenant`
- `admin_set_role`
- `admin_set_flag`
- `admin_set_billing`
- `admin_invite_company_admin`

Each starts with the role check (`wellness_admin`) and audits before
returning.

### 0.3 Deploy `admin-export-platform-report` edge function

Writes CSV to `company-assets` storage, returns 10-minute signed URL.

### 0.4 Deploy `admin-impersonate` (off by default)

Hard-gated by `IMPERSONATION_ENABLED=true` function secret. Do NOT set
the secret. Verify by hitting the function — it should return 403
`impersonation_disabled`.

### 0.5 Promote a `wellness_admin` user

Dashboard → Authentication → Users → Add user. Then:

```sql
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'wellness_admin')
WHERE email = '<ADMIN_EMAIL>';
```

User signs out + back in to refresh the JWT.

## Phase 7 — what still needs to verify

The 14 spec verification steps from
[admin-console-design.md](../specs/2026-04-30-admin-console-design.md#verification):

1. Sign in as `wellness_admin` → Overview. Sign in as `hr_admin` → "no access".
2. Overview platform KPIs render with seeded values.
3. Tenants → click row → Tenant Detail loads.
4. Tenant create → tenant exists with generated code; audit row exists.
5. Roles → promote test user → audit row exists; user can sign into HR.
6. Flags → toggle global flag → row in `feature_flags`; audit row.
7. Billing → edit MRR → persists with audit row.
8. Audit view shows the rows from steps 4-7 in chronological order.
9. Content edit → reflected in employee app for both seeded tenants.
10. Integrations → mark Slack configured for a tenant → row in `integrations`.
11. Localization → add AR translation → persists.
12. Challenge Templates → create template → HR Portal sees it.
13. With `hr_admin` JWT, `SELECT * FROM audit_log` returns 0 rows.
14. `npm run build` clean; no console errors during walk-through.

## Code-quality follow-ups (Minor, non-blocking)

1. **Legacy `Object.assign(window, ...)` globals.** Same situation as
   Employee + HR. Can be removed in a single sweep across all three
   apps once everything is verified end-to-end.

2. **`ADMIN_DATA` mock data still exported from `src/admin/sections.jsx`.**
   The Phase 6 wiring replaced all consumers with hook data, but
   `ADMIN_DATA` remains exported (and partially referenced by helpers
   like `AdminKpiStrip`, `DauMauChart`, `TenantsTable` which are no
   longer rendered by the views). Schedule a sweep to delete
   `ADMIN_DATA` and the now-orphaned helper components after Phase 7
   verifies the wired views render correctly without them.

3. **`localization_strings` table.** The hook `useLocalization()` and
   client helper `listStrings()` tolerate the table not existing
   (Postgres error `42P01`). If the product team wants real
   localization editing, add a migration:

   ```sql
   CREATE TABLE public.localization_strings (
     key   TEXT NOT NULL,
     lang  TEXT NOT NULL,
     value TEXT NOT NULL,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY (key, lang)
   );
   ```

4. **No `pending_associations` row constraint check.** The
   `admin_invite_company_admin` RPC inserts into `pending_associations`
   on conflict-update by email. If the table doesn't have an index on
   `email`, the upsert is a sequential scan. Confirm `pending_associations`
   has a unique constraint on `email` (Employee Phase 0 set this up;
   the existing migration 0009 is the source of truth).

5. **Origin separation for production.** The Admin Console ships at
   `admin.html` on the same origin as the customer apps. Per the spec's
   risk section, production should host Admin behind a separate hostname
   or IP allowlist. Tracked as a deployment-hardening follow-up — not a
   code change.

6. **No tests for sign-in / access-denied / role gate logic.** These
   are wired through the `useAdminAuth` context which has no test.
   Adding a basic context test would catch regressions if someone
   relaxes the role check. Low priority because the gate is shallow —
   but worth tracking.

## Schema gaps (informational)

While wiring views, these tables are referenced and verified to
exist after Phase 0 lands:

- `audit_log` — Task 0.1
- `feature_flags` — Task 0.1
- `integrations` — Task 0.1
- `billing_state` — Task 0.1
- `invoices` — Task 0.1
- `challenge_templates` — Task 0.1
- `pending_associations` — pre-existing (Employee Phase 0, migration 0009)
- `localization_strings` — does NOT exist; helper tolerates absence

## Tactical observations

1. **Tenant detail's `companyId` plumbing.** Phase 6.4 added a
   `companyId` prop to `<AdminBilling>` so the hook can scope the
   invoice query. The prop is passed from `App.jsx` as `openTenant?.id`.
   When no tenant is selected (initial load), `useBilling(null)` returns
   `{ invoices: [], loading: false }` and the view renders an empty
   prompt. This is the correct degenerate state.

2. **Role refresh.** When `admin_set_role` updates `auth.users.raw_app_meta_data`,
   the affected user's existing JWT still carries the old role until
   they sign out and sign in again. The custom access token hook only
   runs at mint time. The admin UI should surface a hint to the user
   that the promoted person must sign back in. Currently the Roles
   view doesn't communicate this — small UX follow-up.

3. **Impersonation gate.** The edge function's hard gate
   (`IMPERSONATION_ENABLED=true` env var) is the only guard. If a
   future engineer accidentally sets that secret, impersonation is
   live. Consider adding an additional guard, e.g., requiring the
   target user's email to be on an explicit allowlist, before enabling
   in production.

## Open questions

- Should Phase 0.4's `admin-impersonate` actually be deployed if it's
  off by default? Argument for: it's available for engineering escape
  hatches when needed. Argument against: code that exists is code
  that can be activated. Current state: deployed but disabled. Defer
  decision until impersonation is needed.
- The Admin role assignment doesn't currently invalidate the target
  user's existing sessions. Should it call `auth.admin.deleteUser()` +
  re-create? Or is sign-out-on-next-action acceptable? Lean toward
  acceptable — but document.
- Billing integration with Stripe/Paddle: spec defers, plan only ships
  state plumbing. Decide when first paying tenant lands.

## Project total

This concludes the third of three sub-projects. Total work landed on
`main`:

- **3 frontend implementations** — Employee App, HR Portal, Admin Console
- **3 design specs + 3 implementation plans + 3 follow-up notes** under `docs/superpowers/`
- **51 passing unit tests** across 27 test files (Vitest + Testing Library)
- **3 HTML entries** building cleanly: `index.html` (employee), `hr.html`, `admin.html`
- **`src/lib/`** has three client wrappers: `supabase.ts` (Employee), `supabase-hr.ts`, `supabase-admin.ts`
- **`src/shared/`** holds the design tokens + components reused by HR + Admin
- **Backend additions still pending end-to-end** for all three sub-projects:
  - Employee: cloud project bring-up (Tasks 0.1–0.10 in employee plan)
  - HR: 4 backend tasks in HR plan Phase 0
  - Admin: 5 backend tasks in Admin plan Phase 0
