# Wellness+ Employee App — Design Spec

**Date:** 2026-04-30
**Status:** Draft pending review
**Sub-project:** 1 of 3 (Employee · HR · Admin)

## Context

Three Wellness+ surfaces shipped to `main` as visual mockups: the Employee App
(`index.html`), HR Portal (`hr.html`), and Admin Console (`admin.html`). All three
are pure mockups — they render hardcoded values and do not import the Supabase
client.

The repository already contains substantial backend scaffolding that has never
been deployed anywhere:

- 14 SQL migrations under `supabase/migrations/` covering companies, profiles,
  check-ins, content, challenges, daily plan, notifications, HR aggregates,
  pending associations, insights, storage, auth hooks, realtime, and helper
  functions.
- 8 edge functions under `supabase/functions/` covering company-code verify,
  daily-plan generation, insights, leaderboard refresh, push notifications,
  challenge updates, HR aggregates, and account deletion.
- A typed client wrapper `src/lib/supabase.ts` with Employee-app helpers.
- Seed data in `supabase/seed.sql` with two demo companies (`WH-4782`,
  `NG-9130`).

This spec covers sub-project 1: stand the backend up on Supabase Cloud, refactor
the bundled Employee app into per-screen modules, and wire the screens to the
backend through the existing client lib. HR and Admin wiring are separate specs.

## Goals

1. A working Employee App on Supabase Cloud, callable end-to-end from sign-in
   through every primary screen.
2. Frontend code organised as a per-screen module tree replacing the 2,957-line
   `src/main-employee.jsx` bundle.
3. All data access goes through Row Level Security; no service-role calls on
   the client.
4. Bilingual (EN/AR + RTL flip) preserved.
5. iOS-frame chrome preserved.
6. Visual parity with the current bundle after the refactor — the refactor is a
   structural extraction, not a redesign.

## Non-Goals

- HR Portal data wiring — separate spec.
- Admin Console data wiring — separate spec.
- Native iOS/Android shells.
- Real push notification delivery (APNs/FCM). The `send-push-notifications`
  edge function will exist but actual delivery is deferred until a native
  shell is in scope.
- Offline-first sync. Network-required for now; failures degrade to clear
  error states.
- New design work beyond what the handoff already contains.
- A new state-management library. We stay on `useState` + `useEffect` +
  Context.

## Architecture

### Frontend file layout

```
src/
  main-employee.jsx                 # entry: imports App, mounts root
  employee/
    App.jsx                         # routing/state shell
    design-system.jsx               # THEMES, typeStyles, Icon
    i18n.jsx                        # STRINGS, useT
    ios-frame.jsx                   # IOSDevice, IOSStatusBar, etc.
    confetti.jsx                    # Confetti effect
    tweaks-panel.jsx                # dev-only theme/variant tweaker
    state/
      auth-context.jsx              # session, profile, company
      app-config-context.jsx        # theme, lang, density (persisted)
    hooks/
      use-checkin.js                # submit + history
      use-daily-plan.js             # today's plan + completions
      use-content.js                # library, featured, progress
      use-challenges.js             # active challenges + leaderboard
      use-progress.js               # 30-day stats + insights
      use-notifications.js          # list + realtime + mark-read
    screens/
      onboarding.jsx                # Join, OTP, Consent, Name, Baseline,
                                    #   Goals, Welcome
      home.jsx                      # ScreenHome (today's plan)
      checkin.jsx                   # ScreenCheckIn
      breathe.jsx                   # ScreenBreathe
      challenges.jsx                # ScreenChallenges (list + detail)
      progress.jsx                  # ScreenProgress
      profile.jsx                   # ScreenProfile
      content.jsx                   # ScreenLibrary, ScreenPlayer
      notifications.jsx             # ScreenNotifs
```

The HR and Admin bundles stay untouched — they remain as `src/main-hr.jsx` and
`src/main-admin.jsx` until their own specs are executed.

### State and data flow

- **AuthContext** holds `session`, `profile`, `company`. Exposes
  `signInWithCode(companyCode, email)`, `verifyOtp(token)`, `signOut()`,
  `refreshProfile()`. Persists session via Supabase auth.
- **AppConfigContext** holds `theme`, `lang`, `density`, plus the variant
  toggles the design system supports. Persists in `localStorage` under
  `wellness:app-config`.
- **Data hooks** are thin wrappers over `src/lib/supabase.ts` helpers. Each
  returns `{ data, loading, error, refetch }`. No external state library.
- **Realtime** subscriptions live inside the relevant hooks
  (`use-notifications`, `use-challenges` leaderboard). Each cleans up its
  channel on unmount.
- **Routing** is an in-memory state machine inside `App.jsx` — same pattern as
  the current bundle. No `react-router`.

### Auth flow

1. Splash → Join screen: enter company code + email.
2. Code verified via the `verify-company-code` edge function (no JWT — runs
   pre-auth). Response includes `company_id` and `company_name`. Stored in
   `pending_associations` server-side.
3. Email OTP via `signInWithOtp({ email })`.
4. Verify OTP via `verifyOtp({ email, token, type: 'email' })` → session.
5. The auth hook (migration 12) attaches `company_id` to `app_metadata` on
   first session by joining `pending_associations` on email.
6. First-run path: Consent → Name → Baseline → Goals → Welcome → Home.
   Onboarding state is persisted on `profiles` (`onboarded_at`,
   `display_name`, `baseline_*`, `goals`).
7. Returning user: skip straight to Home.

### Backend bring-up (Phase 0 of execution)

This phase runs once before any frontend wiring lands.

1. Create a Supabase Cloud project (region per user choice; default
   `eu-central-1`).
2. `supabase link --project-ref <ref>`.
3. `supabase db push` — apply all 14 migrations to the cloud database.
4. `supabase functions deploy verify-company-code --no-verify-jwt` (runs
   pre-auth).
5. `supabase functions deploy` for the remaining 7 functions (default JWT
   verification).
6. Apply `supabase/seed.sql` against the cloud DB — loads demo companies,
   teams, content library, and the active challenge.
7. In the Supabase dashboard:
   - Enable Email auth → "Email OTP" mode.
   - Set Site URL to deployment origin.
   - Add the dev origin (`http://localhost:5173`) to redirect allowlist.
8. Capture `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` into
   `.env.local`.
9. Smoke-test sign-in flow against the cloud project.

### Backend gaps to verify or close (Employee scope only)

- Confirm `get_my_checkin_history(p_days int)` and `get_my_progress_stats()`
  RPCs exist in `20240101000014_create_functions.sql`. Add them if missing.
- Confirm the auth hook in `20240101000012_create_auth_hooks.sql` resolves
  `pending_associations` by email and writes `company_id` into `app_metadata`.
- Confirm storage policies in `20240101000011_create_storage_policies.sql`
  allow authenticated reads on `content-assets`.
- Add an idempotency guard to `submitCheckin`: composite unique on
  `(user_id, checked_at)` — confirm migration 3 enforces this.
- The `pending_associations` flow currently blocks unknown emails; spec keeps
  this blocking behaviour. Document it.

These are *verifications*, not new features — they should be no-ops if the
existing migrations are correct, but the spec calls them out so the
implementation plan checks them explicitly.

### Refactor approach

- Extract files verbatim from `src/main-employee.jsx` in dependency order
  (ios-frame → design-system → i18n → confetti → screens-* → app).
- Add minimum imports/exports — no rewrites of component bodies.
- Add `import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'`
  at the top of every module that needs hooks (the bundle currently uses bare
  `React.useState`; the new modules use named hook imports for clarity).
- Verify `npm run build` after each extraction and `npm run dev` smoke before
  moving on.
- Once the structural extract lands cleanly, a second pass replaces hardcoded
  data with hook calls.

### Tweaks panel handling

The Tweaks panel is a designer affordance for switching theme/lang/density and
component variants. It will be preserved but only mounted when:

- `import.meta.env.DEV` is true, **or**
- The URL contains `?tweaks=1`.

This keeps the dev experience while hiding the panel from real users in
production.

## Verification

End-to-end manual run-through on the live cloud project, all from
`http://localhost:5173/`:

1. **Sign-up:** Enter `WH-4782` + a test email → receive 6-digit OTP →
   verify → land on Consent.
2. **Onboarding:** Walk Consent → Name → Baseline → Goals → Welcome → Home.
   Reload — Home loads directly (onboarding skipped).
3. **Check-in:** Submit today's check-in → reload → entry visible in
   Progress. Resubmit → upsert overrides today's row.
4. **Daily plan:** Open Home → mark an action complete → reload → action
   stays complete.
5. **Content:** Open Library → play an audio item → close → reopen →
   progress restored.
6. **Challenge:** Join the seeded challenge → leaderboard renders → insert
   a row in another user's `challenge_activities` via SQL → leaderboard
   updates without reload (realtime).
7. **Notifications:** Insert a notification row via SQL for the test user →
   bell badge increments without reload (realtime).
8. **i18n:** Switch language to AR via Tweaks → entire app flips RTL,
   strings switch, font swaps to IBM Plex Sans Arabic.
9. **Sign-out:** Sign out → land back on Splash. Sign in again → no
   re-onboarding.
10. **RLS check:** With user-A's anon JWT, attempt to select user-B's
    check-ins via the dashboard SQL editor — returns empty rows.
11. **Build health:** `npm run build` produces three HTML entries with no
    transform errors. Dev server has no React console warnings or errors
    during the run-through.

## Risks and mitigations

- **OTP email delivery in dev.** Mitigation: rely on Supabase's built-in
  email provider for sign-up; fall back to magic-link mode if OTP delivery
  is rate-limited.
- **Visual regression during refactor.** Mitigation: do the extract as a
  pure structural move first (no behavior changes), commit, run dev, do a
  side-by-side visual check against `main` before the data-wiring pass.
- **Hook import gotcha.** The bundle uses `React.useState`. After splitting,
  modules using JSX with the automatic runtime do *not* get React in scope
  for hooks. Every module must `import React, { useState, ... } from 'react'`.
  The plan must call this out as a per-file checklist item.
- **Auth hook silently failing.** If the migration-12 hook does not actually
  set `company_id` on first session, every subsequent insert with
  `company_id: user.app_metadata.company_id` writes `null` and RLS blocks
  the row. Verification step 1 catches this — Plan must include logging
  `app_metadata` after first sign-in.
- **Edge function deploy ordering.** `verify-company-code` must deploy with
  `--no-verify-jwt` because it runs pre-auth. The plan must call this out
  explicitly; the default `supabase functions deploy` will require JWT.

## Open questions for follow-up specs

- HR aggregate refresh cadence (cron vs on-demand) — settled in HR spec.
- Admin tenant provisioning — settled in Admin spec.
- Push delivery story (FCM/APNs) — deferred until native shells are scoped.
