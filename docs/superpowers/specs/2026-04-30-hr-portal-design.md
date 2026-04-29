# Wellness+ HR Portal — Design Spec

**Date:** 2026-04-30
**Status:** Draft pending review
**Sub-project:** 2 of 3 (Employee · HR · Admin)
**Depends on:** Employee App spec — backend bring-up phase, RLS shape,
auth-hook behaviour are settled there.

## Context

`hr.html` ships as a 2,080-line bundled mockup at
`src/main-hr.jsx`. It renders a multi-page HR dashboard (Overview, Teams,
People, Safety, Content, Challenges, Broadcasts, Reports, Settings) with
hardcoded data. The Employee spec stands the Supabase project up and wires the
employee-facing surfaces. This spec wires the HR Portal to the same project,
restricted to one company at a time.

## Goals

1. A working HR Portal scoped to a single company, gated by the
   `hr_admin` or `company_admin` role.
2. Frontend code organised as a per-section module tree replacing the bundled
   handoff.
3. All data access through RLS — no service-role on the client.
4. Aggregates only: HR users see team-level rollups, never individual
   employee responses (privacy floor: 5 respondents per team).
5. Bilingual (EN/AR) preserved.
6. Visual parity with the bundle.

## Non-Goals

- Admin Console wiring — separate spec.
- Multi-company switching — `hr_admin` is scoped to one company; users with
  rights to several companies sign in separately.
- Real broadcast delivery (push or email send) — UI surfaces the queue but
  the actual send pipeline is deferred.
- Building the HR aggregate cron — the `compute-hr-aggregates` edge function
  exists; this spec invokes it on demand and on a daily Supabase schedule.

## Architecture

### Frontend file layout

```
src/
  main-hr.jsx                     # entry
  hr/
    App.jsx                       # shell + routing + Tweaks
    tokens.jsx                    # HR_THEMES, DENSITY, HR_STRINGS
    components.jsx                # HRIcon, HRButton, Panel, Badge,
                                  #   Spark, TrendChart, Bullet, etc.
    sections.jsx                  # Sidebar, TopBar, KpiStrip,
                                  #   TenantsTable bits used by HR
    state/
      auth-context.jsx
      app-config-context.jsx
    hooks/
      use-overview.js             # KPIs, headline trend
      use-teams.js                # team aggregates + drilldown
      use-people.js               # roster (no individual signals)
      use-safety.js               # safety nets, risk flags
      use-content.js              # company content library + assignments
      use-challenges.js           # challenge templates + active state
      use-broadcasts.js           # queue, scheduled, sent
      use-reports.js              # CSV export jobs
      use-settings.js             # company config
    views/
      overview.jsx
      teams.jsx
      teams-drawer.jsx
      people.jsx
      safety.jsx
      content.jsx
      challenges.jsx
      broadcasts.jsx
      reports.jsx
      settings.jsx
```

The Employee app refactor (sub-project 1) keeps `src/employee/`. HR uses the
`src/hr/` namespace to avoid coupling. The two share Supabase client config
via `src/lib/supabase.ts` only.

### State and data flow

Same shape as Employee: AuthContext + AppConfigContext + per-view hooks. No
new state library.

### HR client wrapper

Add `src/lib/supabase-hr.ts` exporting helpers used by the views:

- `getCompanyOverview(range)` → headline KPIs + trend, scoped to the user's
  `company_id`.
- `getTeamAggregates(weekStart)` → rows from `hr_weekly_aggregates` for the
  current company.
- `getTeamDrilldown(teamId, range)` → time-series for one team.
- `getRoster()` → `profiles` joined with `teams`, returning *only*
  display-name and role columns — never check-in fields.
- `getContentLibrary()` and `assignContent(contentId, scope)` for the Content
  view.
- `listChallengeTemplates()`, `scheduleChallenge(template, window, scope)`,
  `getChallengeStatus(challengeId)`.
- `listBroadcasts()`, `scheduleBroadcast(payload)`, `cancelBroadcast(id)`.
- `requestReportExport(kind, range)` → returns a job id.
- `getCompanySettings()`, `updateCompanySettings(patch)`.

All helpers respect RLS — they pass JWTs via the standard supabase-js client.

### Auth and access control

- HR users sign in with the same email-OTP flow as Employees but their
  `app_metadata.role` is `hr_admin` or `company_admin` (set out-of-band by
  Admin Console; for now, by SQL).
- The HR shell guards every route with a role check. If the role is wrong,
  show a "no access" screen with a sign-out link.
- The auth hook in migration 12 carries `company_id` into `app_metadata` —
  HR queries always filter `WHERE company_id = auth.jwt() ->> company_id`.
- A separate `hr.html` entry exists; it is *not* a sub-route of the Employee
  app. Same-origin sessions are shared, but views are physically separate.

### Aggregation and privacy

- HR never reads `checkins`, `daily_plan_completions`, `content_progress`, or
  `challenge_activities` rows directly. RLS enforces this — no select policy
  exists for `hr_admin` on those tables.
- HR reads from `hr_weekly_aggregates` (migration 8) and a new
  `hr_team_overview` view that wraps it.
- Aggregates suppress any team with fewer than 5 respondents in the window
  (the privacy floor). Suppression happens inside the view; HR never sees
  the underlying counts of small teams.

### Backend additions / verifications

These are Phase 0 of the HR plan, after Employee Phase 0 has produced a
running cloud project.

- **Verify** migration 8 enforces the `respondent_count >= 5` floor in the
  view, and that the policy `hr_agg_admin_read` is correct.
- **Add** SQL view `hr_team_overview` if not already present, keyed on
  `(company_id, team_id, week_start)`, that joins
  `hr_weekly_aggregates` with `teams` for display.
- **Add** RPCs:
  - `hr_company_overview(p_range text)` returns aggregate KPIs for the
    caller's company.
  - `hr_team_drilldown(p_team_id uuid, p_range text)` returns one team's
    time-series.
- **Add** edge function `hr-schedule-broadcast` to enqueue a broadcast row
  with company-scoped checks.
- **Add** edge function `hr-export-report` to build CSV/JSON, write to
  `company-assets` storage, and return a signed URL.
- **Schedule** `compute-hr-aggregates` as a daily cron via Supabase
  Scheduled Functions.
- **Seed** add `hr_admin` user(s) into `auth.users` and bind them to
  `Wellhouse Group` and `Nile Group` for development.

### Refactor approach

Same pattern as Employee:

1. Extract files verbatim from the bundle into `src/hr/`.
2. Add named React imports.
3. Confirm `npm run build` / dev render parity.
4. Wire data hooks in a second pass.
5. Keep the Tweaks panel behind `?tweaks=1` / `import.meta.env.DEV`.

## Verification

End-to-end manual run-through against the cloud project:

1. **Access:** Sign in as a `hr_admin` user for `Wellhouse Group` →
   land on Overview. Sign in as a regular employee → Overview returns the
   "no access" screen.
2. **Overview:** KPIs and headline trend render with seeded values; range
   switcher (7d / 30d / 90d) re-fetches.
3. **Teams:** Table shows seeded teams; clicking a team opens the drawer
   with the time-series. A team with <5 respondents shows the suppression
   placeholder, not a number.
4. **People:** Roster lists seeded employees with display names and team
   names only. Network tab confirms no `checkins` rows are fetched.
5. **Content:** Library lists seeded content; "assign" creates an
   assignment row scoped to the current company.
6. **Challenges:** Schedule a challenge; appears in the active list with
   the right window.
7. **Broadcasts:** Schedule a broadcast → appears in queue. Cancel →
   moves to cancelled state.
8. **Reports:** Request an export → job appears, completes, signed URL
   downloads a CSV.
9. **Settings:** Edit company name → reload → persisted.
10. **i18n:** AR flips RTL; numbers display in Western digits.
11. **RLS check:** With one company's HR JWT, attempting to read another
    company's `hr_weekly_aggregates` returns empty.
12. **Build health:** `npm run build` succeeds; HR bundle <120 kB gzip;
    no console errors.

## Risks and mitigations

- **Privacy floor leak.** If the view forgets to suppress small teams, HR
  could infer individual responses. Verification step 3 must include a
  team seeded with 4 respondents.
- **Cross-company data leak via RPC.** RPCs must use
  `SECURITY DEFINER` only when filtering on the caller's `company_id`
  inside the function body. The plan must require `EXPLAIN` on each RPC
  query to confirm the filter is applied.
- **Role bootstrap.** The first `hr_admin` user has to be promoted via
  SQL because the Admin Console isn't built yet. The plan documents the
  exact SQL.
- **Cron cost.** Running `compute-hr-aggregates` daily at company scale
  is fine for two demo companies but warrants a real cost check before
  any tenant past ~5,000 employees.

## Open questions for follow-up specs

- Admin Console role assignment UX — settled in Admin spec.
- Bulk roster import (CSV upload, SFTP) — not in scope; defer to a later
  spec if needed.
