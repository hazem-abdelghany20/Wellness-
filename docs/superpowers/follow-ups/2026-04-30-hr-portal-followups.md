# Wellness+ HR Portal — Implementation Follow-ups

**Date:** 2026-04-30
**Sub-project:** HR Portal (2 of 3)
**Plan:** [docs/superpowers/plans/2026-04-30-hr-portal-implementation.md](../plans/2026-04-30-hr-portal-implementation.md)
**Spec:** [docs/superpowers/specs/2026-04-30-hr-portal-design.md](../specs/2026-04-30-hr-portal-design.md)

## Status

Phases 1–5 are complete (29 frontend commits on `main`). Phase 0 (backend
additions) and Phase 6 (end-to-end verification) require the live cloud
project from the Employee sub-project's Phase 0.

| Phase | Status |
|---|---|
| 0 — HR backend additions (`hr_team_overview`, RPCs, edge functions, cron, seed) | **Pending — needs cloud project + dashboard access** |
| 1 — Verbatim extraction of `src/main-hr.jsx` (2,080 → 5 lines) | ✅ Done (7 commits) |
| 2 — `src/lib/supabase-hr.ts` client wrapper | ✅ Done |
| 3 — `HRAuthContext` + `HRAppConfigContext` + sign-in + access-denied | ✅ Done (3 commits) |
| 4 — 9 data hooks with TDD (17 new tests) | ✅ Done (9 commits) |
| 5 — Wire all 9 views to hooks | ✅ Done (9 commits) |
| 6 — End-to-end spec verification | **Pending — needs Phase 0 + dashboard SQL access** |

## What works without the backend

- `npm run build` — clean. HR bundle is 108.76 kB / 28.11 kB gzipped.
- `npm run dev` — `hr.html` serves at HTTP 200.
- `npm test` — 31 tests passing across 16 test files (14 employee + 17 HR).
- File structure under `src/hr/` matches the plan exactly:
  - `App.jsx`, `tokens.jsx`, `components.jsx`, `sections.jsx`, `tweaks-panel.jsx`
  - `state/{auth,app-config}-context.jsx`
  - `hooks/use-{overview,teams,people,safety,content,challenges,broadcasts,reports,settings}.js`
  - `views/{teams,teams-drawer,people,safety,content,challenges,broadcasts,reports,settings,_header,sign-in,access-denied}.jsx`
- Tweaks panel hidden in production builds, visible in `npm run dev` and via `?tweaks=1`.
- Sign-in screen + role gate (`hr_admin` / `company_admin`) wired.

## Phase 0 — what the user must do before Phase 6 verification can run

These tasks were detailed in the plan and require the live cloud project
from the Employee sub-project's Phase 0:

### 0.1 Verify the privacy floor
SQL audit of `hr_weekly_aggregates` columns and `hr_agg_admin_read` policy.

### 0.2 Apply migration 0015 — `hr_team_overview` view + RPCs
The migration file is described in
[the plan](../plans/2026-04-30-hr-portal-implementation.md#task-02-new-migration--hr_team_overview-view--hr-rpcs):

- View `hr_team_overview` with the 5-respondent floor enforced inline
  (NULL-out values when below)
- RPC `hr_company_overview(p_range)` — SECURITY DEFINER, role-checked
- RPC `hr_team_drilldown(p_team_id, p_range)` — SECURITY DEFINER,
  role-checked, additionally validates the team belongs to the caller's
  company

`supabase db push` to apply.

### 0.3 Add the `broadcasts` table + `hr-schedule-broadcast` edge function
Per the plan's Task 0.3. Migration `20240101000017_create_broadcasts.sql`
plus `supabase/functions/hr-schedule-broadcast/index.ts`. The edge
function deploys with default JWT verification.

### 0.4 Add the `hr-export-report` edge function
Per the plan's Task 0.4. Writes CSV to `company-assets` storage bucket,
returns a 10-minute signed URL.

### 0.5 Schedule `compute-hr-aggregates` daily cron
Dashboard → Database → Cron / Scheduled Functions. Schedule `15 1 * * *`.

### 0.6 Promote test users to `hr_admin`
Dashboard → Authentication → Users → Add user, then SQL:

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'role',       'hr_admin',
  'company_id', '00000000-0000-0000-0000-000000000001'
)
WHERE email = '<EMAIL>';
```

User signs out and back in to refresh the JWT.

## Phase 6 — what still needs to verify

The 12 spec verification steps from
[hr-portal-design.md](../specs/2026-04-30-hr-portal-design.md#verification):

1. Sign in as `hr_admin` for Wellhouse Group → land on Overview. Sign
   in as a regular employee → "no access" screen.
2. Overview KPIs and headline trend render with seeded values.
3. Teams table → click team → drawer with time-series. A team with <5
   respondents shows the suppression placeholder, not numbers.
4. People roster lists employees with name + team only. Network tab
   confirms no `checkins` queries fire.
5. Content → Assign creates a `content_assignments` row scoped to the
   current company.
6. Schedule a challenge → appears active.
7. Schedule a broadcast → appears in queue. Cancel → cancelled state.
8. Request export → signed URL downloads CSV.
9. Edit company name → reload → persisted.
10. AR flips RTL.
11. Cross-company RLS check returns empty.
12. Build clean, no console errors during walk-through.

## Code-quality follow-ups (Minor, non-blocking)

1. **`Object.assign(window, ...)` legacy globals.** Same situation as the
   Employee app — preserved verbatim during extraction, can be removed
   once a sweep commit lands across both apps.

2. **`HR_DATA` cross-reference.** During Phase 1.4 the implementer
   discovered `HR_DATA` (defined in `sections.jsx`) is referenced by the
   view files. Solution: `HR_DATA` is now exported from
   `src/hr/sections.jsx`. Once the views fully consume hook data
   (Phase 5 is done — verify on the live backend), `HR_DATA` and its
   export can be deleted.

3. **Cron auth header.** Task 0.5 schedules `compute-hr-aggregates` with
   the service-role key in the `Authorization` header. The function's
   `requireAuth` accepts user JWTs by design; for the cron path, a
   `cron_secret` header would be cleaner. Tracked as a follow-up but not
   blocking.

4. **`content_assignments` table.** The HR client helper `assignContent`
   writes to this table. Confirm it exists in the migrations
   (`grep -l content_assignments supabase/migrations/`); if not, add a
   migration before Phase 6 step 5 of the spec verification.

5. **No realtime in HR yet.** The Employee app has realtime for
   notifications and leaderboard. HR Portal has no realtime
   subscriptions. The spec's verification step 7 (broadcast cancel
   reflects without reload) implicitly assumes realtime, but the current
   implementation re-fetches via the hook after `cancel(id)`. Sufficient
   for single-user UX; consider realtime if multiple HR users view the
   same data simultaneously.

## Schema considerations

While wiring views, these tables are referenced — verify they exist in
migrations before running Phase 6:

- `broadcasts` — added in Phase 0 Task 0.3.
- `content_assignments` — referenced by `assignContent`. Existence not
  verified. Add a migration if needed.
- `challenge_leaderboard_cache` — already exists per Employee Phase 0.

## Tactical observations

1. **Loading states are minimal.** Each view shows a centered "Loading…"
   placeholder. Acceptable for v1 — match the Employee app polish later
   if the design team wants real skeletons.

2. **Sign-in flow is OTP-only with no company-code.** HR users are
   pre-provisioned by an admin (Task 0.6) and do not enter a company
   code on sign-in (the company is stamped via `app_metadata`). This
   differs from the Employee flow.

3. **Tweaks panel writes to `wellness:hr-app-config`** — separate
   localStorage namespace from the Employee app's
   `wellness:app-config`. Both apps can run on the same origin without
   colliding.

4. **`HR_DATA` constant left exported.** It's still in `sections.jsx`
   for any Phase 5 view that doesn't yet have a fully wired data path.
   After Phase 6 verifies all views work end-to-end, schedule a sweep
   to remove it.

## Open questions

- Should `useTeams()` realtime-subscribe to changes in
  `hr_weekly_aggregates`? The cron updates the table daily; realtime is
  not needed unless HR runs the cron on demand.
- Should `useBroadcasts()` realtime-subscribe to status changes? When
  the send pipeline is built, broadcasts move scheduled → sending →
  sent. Realtime would surface that without reload.
- Should the HR Reports view show a history of past exports? Currently
  it only surfaces the latest URL via the hook's `lastUrl`. A
  `report_jobs` table would track history if useful.

## Next sub-project (Admin Console)

When ready, follow the same pattern on
[docs/superpowers/specs/2026-04-30-admin-console-design.md](../specs/2026-04-30-admin-console-design.md).
The settled patterns from Employee and HR (per-section modules, hooks
under `src/<app>/hooks/`, contexts under `src/<app>/state/`) carry over
directly to `src/admin/`.
