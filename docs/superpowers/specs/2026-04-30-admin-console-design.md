# Wellness+ Admin Console — Design Spec

**Date:** 2026-04-30
**Status:** Draft pending review
**Sub-project:** 3 of 3 (Employee · HR · Admin)
**Depends on:** Employee App spec and HR Portal spec — backend bring-up,
RLS shape, and HR aggregate plumbing are settled there.

## Context

`admin.html` ships as a 1,974-line bundled mockup at
`src/main-admin.jsx`. It renders an internal multi-tenant operations console
(Overview, Tenants, Content, Integrations, Flags, Audit, Roles,
Localization, Challenge Templates, Tenant Detail, Billing) with hardcoded
data. This sub-project wires the Admin Console to Supabase as an
internal-only surface for Wellness+ staff — not exposed to tenants.

## Goals

1. A working Admin Console limited to users with the `wellness_admin`
   role.
2. Frontend code organised as a per-section module tree replacing the
   bundled handoff.
3. Cross-tenant read access for ops; cross-tenant writes only via
   audit-logged actions.
4. Tenant provisioning end-to-end: create company, generate code, mint
   first `company_admin` invite.
5. Visual parity with the bundle.

## Non-Goals

- Real billing integration with Stripe/Paddle. The Billing view reads
  stored invoice/state rows; integration with a payment provider is a
  follow-up.
- Multi-region orchestration.
- Customer-facing self-service portal (this is internal).
- Replacing HR or Employee surfaces.

## Architecture

### Frontend file layout

```
src/
  main-admin.jsx                  # entry
  admin/
    App.jsx                       # shell + routing
    sections.jsx                  # AdminSidebar, AdminTopBar,
                                  #   AdminKpiStrip, TenantsTable
    views/
      overview.jsx
      tenants.jsx
      tenant-detail.jsx
      billing.jsx
      content.jsx
      integrations.jsx
      flags.jsx
      audit.jsx
      roles.jsx
      localization.jsx
      challenge-templates.jsx
    state/
      auth-context.jsx
      app-config-context.jsx
    hooks/
      use-platform-overview.js
      use-tenants.js
      use-tenant.js
      use-billing.js
      use-content.js              # global content library
      use-integrations.js
      use-flags.js
      use-audit.js
      use-roles.js
      use-localization.js
      use-challenge-templates.js
```

Admin imports HR's `tokens.jsx` and shared chart components. To avoid a
circular dep, those components move into `src/shared/` during this spec's
execution:

```
src/shared/
  tokens.jsx                      # was hr/tokens.jsx
  components.jsx                  # was hr/components.jsx
```

HR is updated to import from `src/shared/` in the same change.

### Auth and access control

- Admin sign-in is the same email OTP flow.
- The shell requires `app_metadata.role === 'wellness_admin'`. Any other
  role lands on a "no access" screen.
- Admin role assignment is bootstrapped via SQL once; the Roles view
  manages it after.
- The Admin Console is hosted at `admin.html` on the same origin. In
  production, this entry should live behind a separate hostname or an
  IP-allowlisted route — captured in the deployment plan as a hardening
  item, not built into the app.

### Cross-tenant queries

Admin RPCs pass an explicit `p_company_id` argument and check the caller's
role inside `SECURITY DEFINER`:

```sql
CREATE FUNCTION admin_company_overview(p_company_id uuid)
  RETURNS ... SECURITY DEFINER ...
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') != 'wellness_admin'
  THEN RAISE EXCEPTION 'forbidden';
  END IF;
  -- query body
END
```

Every cross-tenant write is wrapped in a function that writes to
`audit_log` (see below) before returning.

### Backend additions

These land as part of the Admin sub-project:

- **Migration:** add `audit_log` table:
  - `id, occurred_at, actor_id, actor_email, action, target_kind,
    target_id, payload jsonb, ip, user_agent`
  - RLS: only `wellness_admin` may select; service-role only on insert
    via the SECURITY DEFINER functions.
- **Migration:** add `feature_flags` table:
  - `id, key, scope text check (scope in ('global','company','user')),
    target_id uuid null, enabled bool, payload jsonb, updated_at,
    updated_by`.
- **Migration:** add `integrations` table:
  - one row per (`company_id`, `kind`); `kind` in
    (`slack`, `teams`, `sso_okta`, `sso_azure`, `hris_workday`,
    `hris_bamboo`).
- **Migration:** add `billing_state` table:
  - `company_id (PK), plan, mrr_cents, seats, status, period_end,
    next_invoice_at, payment_provider, provider_customer_id`.
- **Migration:** add `invoices` table:
  - `id, company_id, period_start, period_end, amount_cents, status,
    paid_at, pdf_url`.
- **Migration:** add `challenge_templates` table:
  - `id, slug, title_en, title_ar, kind, default_window_days, target,
    metric, payload jsonb, active bool`.
- **RPCs (all SECURITY DEFINER, all role-checked):**
  - `admin_create_tenant(p_name text, p_locale text, p_timezone text,
    p_plan text)` → returns inserted `company` row plus generated code.
  - `admin_invite_company_admin(p_company_id uuid, p_email text)` →
    inserts a `pending_associations` row + sends OTP.
  - `admin_set_role(p_user_id uuid, p_role text)` → updates
    `auth.users.raw_app_meta_data` and writes audit log.
  - `admin_set_flag(p_key text, p_scope text, p_target_id uuid,
    p_enabled bool, p_payload jsonb)` → upserts into `feature_flags` +
    audit.
  - `admin_set_billing(p_company_id uuid, p_patch jsonb)` →
    updates `billing_state` + audit.
- **Edge functions:**
  - `admin-export-platform-report` → CSV / JSON of platform-wide
    aggregates, written to a private bucket, signed URL returned.
  - `admin-impersonate` → returns a short-lived service-role-signed JWT
    for a target user (read-only). Audited. **Off** by default —
    requires `IMPERSONATION_ENABLED=true` in function secrets.
- **Seed:** add a `wellness_admin` user for development bootstrap.

### Refactor approach

Same pattern as previous specs:

1. Move shared components from `src/hr/` to `src/shared/`. Update HR
   imports in the same commit.
2. Extract files verbatim from the bundle into `src/admin/`.
3. Add named React imports.
4. Confirm `npm run build` / dev render parity.
5. Wire data hooks in a second pass.
6. Tweaks panel stays behind `?tweaks=1` / DEV.

## Verification

End-to-end manual run-through against the cloud project:

1. **Access:** Sign in as `wellness_admin` → land on Overview. Sign in
   as `hr_admin` → "no access" screen.
2. **Overview:** Platform KPIs render with seeded values; range
   switcher works.
3. **Tenants:** Seeded `Wellhouse` and `Nile Group` listed. Click a
   tenant → Tenant Detail loads with KPIs scoped to that company.
4. **Tenant create:** Use the Tenants → New form → tenant created with
   a generated code; an audit row exists.
5. **Roles:** Promote a test user to `hr_admin` for the new tenant →
   verify they can sign into HR scoped to that tenant; an audit row
   exists.
6. **Flags:** Toggle a feature flag globally → flag visible via
   `feature_flags`; audit row exists.
7. **Billing:** Open a tenant's billing detail → invoice list and
   billing state render. Edit MRR → persists with audit row.
8. **Audit:** Audit view shows the rows produced by steps 4-7 in
   chronological order.
9. **Content:** Edit a global content item title → reflected in the
   employee app for both seeded tenants.
10. **Integrations:** Mark Slack as configured for a tenant → row
    appears in `integrations`.
11. **Localization:** Add a missing AR translation key → it persists
    and renders.
12. **Challenge Templates:** Create a template → HR Portal
    (`Schedule a challenge` flow) sees it.
13. **RLS check:** With an `hr_admin` JWT, querying the audit log
    returns no rows.
14. **Build health:** `npm run build` produces three HTML entries; no
    console errors.

## Risks and mitigations

- **Privilege escalation via SECURITY DEFINER.** Every admin RPC must
  start with the role check. Plan must include a checklist enforcing
  this and a unit test asserting non-admin callers get
  `forbidden`.
- **Audit completeness.** Every cross-tenant write must call the audit
  insert before returning. Plan must include a code-review checklist.
- **Impersonation surface.** Disabled by default; only the function
  secret can flip it on. Plan must document that the secret should not
  be set in prod absent an explicit ticket.
- **Origin separation.** Hosting Admin on the same origin as the
  customer apps means a stolen Admin session has cross-app reach. Plan
  notes the production hardening (separate hostname, IP allowlist,
  optional client cert).
- **Backfill of role data.** Promoting a user via
  `admin_set_role` must invalidate cached JWTs (force re-sign-in) or
  RLS keeps using the old role until next refresh. Plan documents the
  workaround (sign-out forced after role change).

## Open questions

- Real billing integration (Stripe vs Paddle vs internal): pick when
  the first paying tenant is committed. Current spec ships
  finance-state plumbing only.
- Whether Audit view needs streaming search or static pagination is
  fine: defer until volume justifies streaming.
- Whether to add a `super_admin` tier above `wellness_admin` for
  destructive ops (delete tenant, hard delete user): defer until we
  have at least three Wellness+ admin users.
