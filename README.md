# Wellness+

Employee-wellbeing platform for companies — a daily check-in and content companion for employees, an anonymised wellbeing dashboard for HR, and a platform console for the Wellness House team. Web / PWA only in v1 (installable, offline shell). Bilingual EN / AR with full RTL.

Part of the Wellness House digital side.

## Three apps, one database

One Vite build, three entry points, one shared Supabase project.

| App | Entry | Path | For |
|---|---|---|---|
| Employee | `index.html` → `src/main-employee.jsx` | `/` | Check-in, daily plan, library, challenges (incl. Sabr / Niyyah / Ramadan Mode), rewards wallet, profile |
| HR portal | `hr.html` → `src/main-hr.jsx` | `/hr.html` | Wellbeing index, people & teams, gifts / tier rewards, challenges, content, broadcasts, safety flags, reports |
| Admin console | `admin.html` → `src/main-admin.jsx` | `/admin.html` | Platform overview, tenants, challenge templates, content upload, roles, billing, integrations, localization, flags, audit log |

Live (AWS Amplify, branch `main`): <https://main.d1c79md4n000h6.amplifyapp.com/>

## Stack

React 18 · Vite 6 · Supabase (Auth, Postgres + RLS, Realtime, Storage, Edge Functions) · vitest + Testing Library · PWA (`public/sw.js`, `manifest.webmanifest`, `offline.html`).

```
src/
  employee/   employee app (screens, hooks, state)
  hr/         HR portal
  admin/      admin console
  shared/     design tokens + components used by all three
  lib/        Supabase client + typed helpers (supabase.ts, supabase-hr.ts, …)
supabase/
  migrations/ 47 migrations (schema, RLS, seeds)
  functions/  12 edge functions
  seed.sql    demo tenants, users, rewards
```

## Run it

```bash
npm ci
cp .env.local.example .env.local   # fill in your Supabase URL + anon key
npm run dev                        # http://localhost:5173
npm test                           # unit tests (vitest)
npm run test:e2e                   # end-to-end against a local Supabase stack — see docs/e2e.md
npm run build                      # → dist/ (all three apps)
```

Backend: apply `supabase/migrations/` (47) to a Supabase project, deploy `supabase/functions/`, then run `supabase/seed.sql` for the demo tenants. In Supabase Auth, **disable "Confirm email"** — sign-up signs the user straight in.

Amplify build spec: `amplify.yml`. It needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set as app environment variables; in production the app refuses to start without them.

## Status

v1 pilot build, feature-complete for the scope in `BUILD_PLAN.md`; the pilot-readiness fixes of 2026-05-20 are in (`docs/superpowers/plans/`). Unit tests: 96 / 96 passing. End-to-end: 40 / 44 (the 4 open checks are documented findings — `docs/e2e.md`). Walkthrough for testers: `CLIENT_TEST_FLOW.md` (smoke pass ≈ 25 min). Acceptance script: `UAT.md`.

Deliberately **not** in v1:

- Tremendous gift-card API — claims are fulfilled manually (HR marks "Fulfilled")
- HR Settings sub-tabs marked `soon` (Notifications, Roles & permissions, Integrations, Localization, Billing, Audit log) and Gifts → Pools
- Admin tenant Suspend / Reactivate (tenant detail is read-only)
- Native iOS / Android wrap (Capacitor) and store submission

## Before a real customer goes live

- Demo accounts (`*@demo.wellhouse.test`) sign in with a fixed password compiled into the client in `src/lib/supabase.ts`, and `src/lib/superadmin.ts` holds a superadmin email allowlist. Both are fine for a demo build; remove them (and the demo seed) for a production tenant.
- Sign-in creates an account for any unknown email (`signInOrUpWithPassword`); the company-code check lives in the employee app and an edge function, not in Supabase Auth itself. Confirm RLS leaves a self-registered stranger with no tenant data, or switch Supabase Auth to invite-only, before onboarding a real company.
- Keep this repository private once it carries real tenant configuration.
