# End-to-end tests

`e2e/wellness.e2e.js` runs the app's **real client libraries** (`src/lib/supabase*.ts`) against a **real local Supabase stack** — migrations, seed, RLS, realtime and the 12 edge functions. No mocks. It is separate from `npm test` (unit tests) and never runs against a hosted project.

```bash
supabase start                 # Docker / Colima running
supabase functions serve       # second terminal
npm run test:e2e               # db reset → demo password + demo data → warm functions → vitest
```

`npm run test:e2e` **resets the local database** every run (the suite mutates rewards, check-ins, flags). It uses the service-role key from `supabase status`, which only ever points at localhost.

## What it covers (44 checks)

| Area | Checks |
|---|---|
| Stack | auth up, all 12 edge functions boot |
| Employee | demo sign-in, company-code gate, check-in (rounding, one row per day, streak), wallet (ready → choose → claim, double-claim and stealing blocked), content progress, Sabr / Niyyah, notifications, profile edit |
| HR | privacy floor (nothing < 5 stored, 5+ group published, DB constraint), dashboard RPC, roster scope, gift catalog → employee picker, tier config, mark-fulfilled, live wallet + broadcast (realtime), challenge scheduling, report export, settings |
| Isolation | new Nile user sees none of Wellhouse; cannot rewrite own `company_id` / `role`; cannot write across tenants; anonymous reads nothing; delete-my-account |
| Admin | tenants overview, flag toggle is audited, roles, localisation, global content, templates reach HR, platform export, non-admins locked out |
| Security review | tenant/role scoping of integrations, broadcasts, audit log, flags; raw check-in access; allow-listed super-admin email; shared-content writes |

Not covered: Admin console in a browser, Arabic/RTL rendering, offline shell / service worker, Storage uploads, push notifications. UI was spot-checked by hand on 2026-10-04: employee sign-in → wallet claim, HR sign-in → dashboard → Gifts → Mark fulfilled, and the employee-in-HR-portal "No access" gate.

## Result on 2026-10-04: 40 pass, 4 open

The four open checks are three findings, not flaky tests (the content finding fails two checks). They fail on purpose until the decision beside each is made.

1. **HR can read every employee's raw check-ins** (`checkins_admin_company_read`, also granted to `manager`). The dashboard promises aggregates only with a 5-person floor; this policy lets HR (and managers) read individual mood / stress / notes. Decide: drop the policy (and serve the Safety page from a definer RPC) or accept it and stop calling the data anonymous.
2. **HR can not unpublish content, and can overwrite content every tenant sees** *(two checks)*. `content_items` has no `company_id`. `content_items_hr_write` lets any tenant's HR admin `UPDATE` global rows (title, `asset_url`) for all tenants, yet unpublishing fails with an RLS error because HR can no longer `SELECT` the row once it is a draft. Needs a per-tenant visibility table (e.g. `company_content_overrides`) instead of editing the global row.
3. **Super-admin allow-list + open sign-up.** `is_superadmin()` / `src/lib/superadmin.ts` trust an email address, and sign-up needs no email confirmation. On any project where those accounts do not yet exist, whoever registers `hazemabdelghany@gmail.com` first reads every tenant. Safe on the hosted project only while both accounts exist. Prefer a role set by the service role in `app_metadata`, and turn on email confirmation.

## Fixed alongside the suite

- `20261004000001_consolidate_manual_prod_scripts.sql` — a database rebuilt from `migrations/` was unusable: `is_superadmin()` was only defined in the hand-run `hr_unblock.sql`, so every RLS check raised 42883. Also fixes: sign-up crashed (`compute_initials('')` returned NULL), the HR overview RPC nested aggregates (dashboard KPIs errored), and `awarded_rewards` was never added to the realtime publication (live wallet could not work).
- `20261004000002_harden_profiles_and_tenant_reads.sql` — any signed-in user could set their own `role = 'hr_admin'` or `company_id = <another tenant>` (and rewrite their streak, which drives reward tiers); employees could read their company's integrations and unsent broadcasts; HR could read other tenants' audit log and flags. Review this one before applying to the hosted project.
- Wallet / profile bottom sheets: the Claim button sat under the tab bar (`elementFromPoint` returned the "Progress" tab), so a reward could not be claimed from the UI.

**Neither migration has been applied to the hosted project.** Both are idempotent.

## Environment notes

- Colima mounts only `$HOME` into its VM. If the repo (or a scratch copy) lives outside it, `supabase functions serve` fails with "failed to determine entrypoint".
- All 12 functions import supabase-js from `https://esm.sh/@supabase/supabase-js@2`; cold starts occasionally 503 when the container cannot reach npm. The runner warms every function first.
- `supabase/config.toml` does not enable the custom-access-token hook that the hosted project uses, so local JWTs have no `company_id` / `role` claims; the profile fallbacks cover it.
- `supabase/demo_seed.sql` has one statement that cannot run on a fresh database (`feature_flags … ON CONFLICT (key, scope, target_id)`; the table has partial unique indexes). It backfills check-ins out of order, which leaves demo streaks at 1.
- No migration or seed sets the demo password the client uses, so rebuilt databases need the `update auth.users …` line in the runner.
