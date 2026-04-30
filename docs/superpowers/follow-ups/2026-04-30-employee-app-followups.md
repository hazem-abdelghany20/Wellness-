# Wellness+ Employee App — Implementation Follow-ups

**Date:** 2026-04-30
**Sub-project:** Employee App (1 of 3)
**Implementation branch:** `claude/employee-app-impl`
**Plan:** [docs/superpowers/plans/2026-04-30-employee-app-implementation.md](../plans/2026-04-30-employee-app-implementation.md)
**Spec:** [docs/superpowers/specs/2026-04-30-employee-app-design.md](../specs/2026-04-30-employee-app-design.md)

## Status

Phases 1–6 are complete (33 commits). Phase 7 verification is partial:

| Phase | Status |
|---|---|
| 0 — Backend bring-up on Supabase Cloud | **Pending — requires user dashboard access** |
| 1 — Vitest scaffold | ✅ Done |
| 2 — Verbatim extraction of bundle into per-screen modules | ✅ Done |
| 3 — App.jsx + Tweaks panel + DEV/`?tweaks=1` gate | ✅ Done |
| 4 — Auth + AppConfig contexts | ✅ Done |
| 5 — Data hooks with TDD (8 hooks, 14 passing tests) | ✅ Done |
| 6 — Wire 9 screens to hooks | ✅ Done |
| 7.1 — Run the 11 spec verification steps | **Partial — needs Phase 0** |
| 7.2 — This follow-ups note | ✅ Done |

## What works without the backend

- `npm run build` — clean. Three HTML entries (`index.html`, `hr.html`, `admin.html`) + `main`/`hr`/`admin` chunks.
- `npm run dev` — three entries serve at HTTP 200.
- `npm test` — 14 tests passing across 7 test files.
- File structure matches the plan exactly: `src/employee/{App,design-system,i18n,ios-frame,confetti,tweaks-panel}.jsx` + `src/employee/{state,hooks,hooks/__tests__,screens}/`.
- Tweaks panel hidden in production builds, visible in `npm run dev` and via `?tweaks=1` in preview/prod.
- All 9 screens have data hooks wired, replacing mock data. Loading states render.
- AuthContext + AppConfigContext are mounted; localStorage persists app config.

## What still needs Phase 0 to verify

These are the 11 verification steps from the spec that require a live Supabase
project (the user's responsibility — see Phase 0 of the plan, Tasks 0.1
through 0.10):

1. **Sign-up:** Enter `WH-4782` + a test email → receive 6-digit OTP →
   verify → land on Consent.
2. **Onboarding:** Walk Consent → Name → Baseline → Goals → Welcome → Home.
   Reload — Home loads directly.
3. **Check-in:** Submit → reload → entry visible in Progress. Resubmit →
   upserts.
4. **Daily plan:** Mark an action complete → reload → stays complete.
5. **Content:** Play an audio item → close → reopen → progress restored.
6. **Challenge:** Join the seeded challenge → leaderboard renders. Insert
   another row server-side → leaderboard updates without reload (realtime).
7. **Notifications:** Insert a server-side notification → bell badge
   increments without reload (realtime).
8. **i18n:** Switch to AR via Tweaks → entire app flips RTL.
9. **Sign-out → sign-in** does not re-onboard.
10. **RLS smoke:** With user A's anon JWT, querying user B's check-ins via
    SQL editor returns empty.
11. **Build health (already verified):** clean build, no console warnings
    during the run-through.

To execute these, the user needs to:

- Complete Phase 0 (Tasks 0.1–0.10) — create the cloud project, push the
  migrations, deploy edge functions, configure email OTP, enable the
  custom access token hook, set `.env.local`.
- Run `npm run dev` and walk the 11 steps in order.

## Code-quality follow-ups (Minor, non-blocking)

These were flagged during code reviews but explicitly deferred per the plan:

1. **`Object.assign(window, ...)` global-export pattern.** Eleven occurrences
   across `src/employee/{ios-frame,design-system,i18n,confetti}.jsx` and
   the screens that were extracted. They were preserved verbatim because
   the bundle pattern relied on them at the time of extraction. Now that
   every consumer uses ES module imports, all 11 calls can be removed in
   a single sweep commit (`chore(employee): remove legacy window globals`).

2. **Unused imports in `src/main-employee.jsx`.** The implementer flagged
   leftover imports (e.g., `STRINGS`, `Confetti`, several IOS components
   beyond `IOSDevice`) when 2.12 landed. Phase 3.2 then cleared them by
   trimming `main-employee.jsx` to its 5-line entry-only form, so this
   may already be resolved — but worth a final `eslint --rule
   no-unused-vars` pass if a linter ever lands.

3. **`matchMedia` shim is incomplete.** `test/setup.js` provides
   `addListener`/`removeListener` but not `addEventListener`/
   `removeEventListener`/`dispatchEvent`/`media`/`onchange`. Modern
   libraries (Radix, Framer) use the modern listener API. No current
   test calls `matchMedia`, but a follow-up should expand the shim
   before the first component test that touches it.

4. **Vitest 4 deviation in `test/setup.js`.** The plan specified a direct
   `import.meta.env.X = …` assignment; we used `vi.stubEnv(…)` because
   Vitest 4 makes `import.meta.env` non-assignable. A short comment in
   the file (`// Vitest 4: import.meta.env is non-assignable; use
   stubEnv`) would prevent a future maintainer from "fixing" it back to
   the plan's pattern.

5. **`globals: true` vs explicit imports.** Vitest config enables
   globals, but every test file still imports `describe`/`it`/`expect`
   explicitly. Pick one convention before the first hook test in the HR
   sub-project lands so the codebase doesn't end up mixed.

## Schema gaps (informational — for backend follow-up)

While wiring screens, the implementer noted columns that do not exist in
the current `profiles` migration but were referenced by the Profile
screen's preference toggles:

- `digest_opt_in` (notifications digest opt-in)
- `anon` (anonymity preference for HR aggregates)
- `share_aggregate` (whether to include user in aggregate analytics)

These toggles are wired to local state only and **do not persist**. If
the product spec considers them load-bearing, a follow-up migration
should add the columns to `profiles` and the Profile screen should
update via `useProfile().update()`. Currently they reset on every reload.

## Tactical observations from data wiring

These are not blockers but may affect the verification walk-through:

1. **Player saves progress only for UUID item IDs.** Seeded content rows
   have UUIDs. Any legacy slug-keyed item (e.g., `sleep-onset`) would
   400 against the `content_progress` table — the implementer added a
   guard so progress writes are skipped for non-UUID IDs. Real seeded
   content from `supabase/seed.sql` uses UUIDs, so this should be fine.

2. **Bell badge overlay is positioned absolute over the home-screen
   bell.** Implemented in `App.jsx` because `home.jsx` was outside the
   Task 6.8 allowed-files list. If a future redesign moves the bell out
   of the home screen, the overlay positioning needs to follow.

3. **Onboarding screens persist incrementally.** Each step
   (Consent / Name / Baseline / Goals / Welcome) calls `update(...)` on
   the profile before advancing. If the user closes the tab mid-flow,
   their partial state is on the server and they re-enter onboarding at
   Consent on next sign-in (because `onboarded_at` is set only at
   Welcome).

4. **Email OTP delivery in dev** uses Supabase's hosted email provider.
   Rate limits are tight (3 OTPs / hour / email). For repeated dev
   testing, either rotate test emails or use the Inbucket capture in a
   local `supabase start` instance.

## Open questions to address before Phase 7 closes

- Are the Profile preference toggles (`digest_opt_in`, `anon`,
  `share_aggregate`) intended to persist? If yes, schedule a migration.
- Is the Privacy Policy / Terms link in onboarding (`ScreenConsent`)
  pointing somewhere real? Currently a `#` placeholder.
- The Tweaks panel writes to localStorage under `wellness:app-config`.
  If users on the previous (pre-refactor) bundle had prefs at the old
  key (`wellness-plus-cfg`), they're reset on first load — acceptable
  since defaults match the previous defaults. Confirm with user before
  shipping if any persistent dev state matters.

## Next sub-project (HR Portal)

When ready, follow the brainstorming → writing-plans → subagent-driven
workflow on
[docs/superpowers/specs/2026-04-30-hr-portal-design.md](../specs/2026-04-30-hr-portal-design.md).
The Employee app's settled patterns (per-screen modules, hooks under
`src/employee/hooks/`, contexts under `src/employee/state/`) carry over
directly to `src/hr/`.
