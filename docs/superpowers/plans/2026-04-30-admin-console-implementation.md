# Wellness+ Admin Console — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [docs/superpowers/specs/2026-04-30-admin-console-design.md](../specs/2026-04-30-admin-console-design.md)

**Goal:** Wire `admin.html` to Supabase as an internal-only multi-tenant operations console gated by `wellness_admin` role. Refactor `src/main-admin.jsx` into per-view modules under `src/admin/`, add the admin-specific backend pieces (audit_log + feature_flags + integrations + billing_state + invoices + challenge_templates tables; SECURITY DEFINER RPCs for tenant/role/flag/billing; impersonation off by default).

**Architecture:** Same shape as Employee + HR. Phase 1 moves HR's `tokens` and `components` modules into `src/shared/` (used by HR and Admin). Phases 2-6 follow the established pattern: verbatim extraction → client wrapper → contexts + role gate → data hooks with TDD → wire views → verify. Cross-tenant operations route through SECURITY DEFINER RPCs that role-check on entry and audit before returning.

**Tech Stack:** React 18, Vite 6, Supabase (Postgres + Auth + Edge Functions + Storage), `@supabase/supabase-js` v2, Vitest + @testing-library/react.

**Depends on:** Employee sub-project (cloud project, base migrations, custom_access_token_hook, Vitest harness) + HR sub-project (`src/hr/{tokens,components}.jsx` exists and will be relocated to `src/shared/`).

**Out of scope (per spec):** Real billing integration with Stripe/Paddle (only billing_state plumbing), multi-region orchestration, customer-facing self-service portal.

---

## File Structure

End-state under `src/`:

```
src/
  main-admin.jsx                    # entry — imports App, mounts root (~5 lines)
  lib/
    supabase.ts                     # existing
    supabase-hr.ts                  # existing
    supabase-admin.ts               # new — admin client wrapper
  shared/
    tokens.jsx                      # was src/hr/tokens.jsx
    components.jsx                  # was src/hr/components.jsx
  hr/
    tokens.jsx                      # DELETED — re-export from shared
    components.jsx                  # DELETED — re-export from shared
    # (everything else stays)
  admin/
    App.jsx                         # shell + routing + Tweaks
    sections.jsx                    # AdminSidebar, AdminTopBar,
                                    #   AdminKpiStrip, DauMauChart,
                                    #   TenantsTable, ContentHealth,
                                    #   IntegrationsStatus, AuditLog,
                                    #   FeatureFlags, AdminTeam, ADMIN_DATA
    tweaks-panel.jsx                # dev-only (TweakRow, SegBtn)
    state/
      auth-context.jsx              # session, profile, role
      app-config-context.jsx        # theme, lang, density, chartStyle, layout
    hooks/
      use-platform-overview.js
      use-tenants.js
      use-tenant.js
      use-billing.js
      use-content.js                # global content library
      use-integrations.js
      use-flags.js
      use-audit.js
      use-roles.js
      use-localization.js
      use-challenge-templates.js
      __tests__/
        use-platform-overview.test.js
        use-tenants.test.js
        use-tenant.test.js
        use-billing.test.js
        use-content.test.js
        use-integrations.test.js
        use-flags.test.js
        use-audit.test.js
        use-roles.test.js
        use-localization.test.js
        use-challenge-templates.test.js
    views/
      _header.jsx                   # AdminPageHeader (shared)
      overview.jsx                  # AdminOverview
      tenants.jsx                   # AdminTenantsView
      tenant-detail.jsx             # AdminTenantDetail
      billing.jsx                   # AdminBilling
      content.jsx                   # AdminContentView
      integrations.jsx              # AdminIntegrationsView
      flags.jsx                     # AdminFlagsView
      audit.jsx                     # AdminAuditView
      roles.jsx                     # AdminRolesView
      localization.jsx              # AdminLocalizationView
      challenge-templates.jsx       # AdminChallengeTemplatesView
      sign-in.jsx                   # email OTP, no company code
      access-denied.jsx             # for non-wellness_admin users
```

`src/main-admin.jsx` shrinks from 1,974 lines to ~5 lines.

`supabase/`:
- New migrations:
  - `20240101000018_admin_tables.sql` — `audit_log`, `feature_flags`,
    `integrations`, `billing_state`, `invoices`, `challenge_templates`
  - `20240101000019_admin_rpcs.sql` — SECURITY DEFINER RPCs
- New edge functions:
  - `supabase/functions/admin-export-platform-report/`
  - `supabase/functions/admin-impersonate/` (gated by
    `IMPERSONATION_ENABLED=true` secret; off by default)

---

## Phase 0 — Admin-specific backend additions

This phase assumes Employee Phase 0 + HR Phase 0 are complete (cloud
project linked, base migrations + HR migrations applied,
custom_access_token_hook enabled, email OTP enabled).

### Task 0.1: New migration — admin tables

**Files:**
- Create: `supabase/migrations/20240101000018_admin_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Admin Console schema: audit log, feature flags, integrations,
-- billing state, invoices, challenge templates.
-- All tables RLS-locked to wellness_admin role.

-- ── audit_log ──────────────────────────────────────────────────
CREATE TABLE public.audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id     UUID REFERENCES auth.users(id),
  actor_email  TEXT,
  action       TEXT NOT NULL,
  target_kind  TEXT,
  target_id    TEXT,
  payload      JSONB DEFAULT '{}'::jsonb,
  ip           TEXT,
  user_agent   TEXT
);

CREATE INDEX idx_audit_occurred ON public.audit_log(occurred_at DESC);
CREATE INDEX idx_audit_action   ON public.audit_log(action, occurred_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_read" ON public.audit_log
  FOR SELECT TO authenticated USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'wellness_admin'
  );

CREATE POLICY "audit_service_write" ON public.audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── feature_flags ──────────────────────────────────────────────
CREATE TABLE public.feature_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL,
  scope       TEXT NOT NULL CHECK (scope IN ('global', 'company', 'user')),
  target_id   UUID,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  payload     JSONB DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id),
  UNIQUE (key, scope, target_id)
);

CREATE INDEX idx_flags_key ON public.feature_flags(key, scope);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flags_admin_all" ON public.feature_flags
  FOR ALL TO authenticated USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'wellness_admin'
  ) WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'wellness_admin'
  );

CREATE POLICY "flags_authed_read" ON public.feature_flags
  FOR SELECT TO authenticated USING (
    -- Anyone authenticated can read GLOBAL flags so the apps can gate UI
    scope = 'global' AND enabled = true
  );

CREATE POLICY "flags_service_write" ON public.feature_flags
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── integrations ───────────────────────────────────────────────
CREATE TABLE public.integrations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN (
                 'slack', 'teams', 'sso_okta', 'sso_azure',
                 'hris_workday', 'hris_bamboo'
               )),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'configured', 'error', 'disabled')),
  config       JSONB DEFAULT '{}'::jsonb,
  configured_at TIMESTAMPTZ,
  configured_by UUID REFERENCES auth.users(id),
  UNIQUE (company_id, kind)
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_admin_all" ON public.integrations
  FOR ALL TO authenticated USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'wellness_admin'
  ) WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'wellness_admin'
  );

CREATE POLICY "integrations_service_write" ON public.integrations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── billing_state ──────────────────────────────────────────────
CREATE TABLE public.billing_state (
  company_id           UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  plan                 TEXT NOT NULL DEFAULT 'starter',
  mrr_cents            INTEGER NOT NULL DEFAULT 0,
  seats                INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'past_due', 'cancelled', 'paused')),
  period_end           DATE,
  next_invoice_at      DATE,
  payment_provider     TEXT,
  provider_customer_id TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.billing_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_admin_all" ON public.billing_state
  FOR ALL TO authenticated USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'wellness_admin'
  ) WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'wellness_admin'
  );

CREATE POLICY "billing_service_write" ON public.billing_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── invoices ───────────────────────────────────────────────────
CREATE TABLE public.invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  amount_cents  INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  paid_at       TIMESTAMPTZ,
  pdf_url       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_company ON public.invoices(company_id, period_end DESC);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_admin_read" ON public.invoices
  FOR SELECT TO authenticated USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'wellness_admin'
  );

CREATE POLICY "invoices_service_write" ON public.invoices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── challenge_templates ────────────────────────────────────────
CREATE TABLE public.challenge_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT UNIQUE NOT NULL,
  title_en            TEXT NOT NULL,
  title_ar            TEXT,
  kind                TEXT NOT NULL DEFAULT 'team',
  default_window_days INTEGER NOT NULL DEFAULT 14,
  target              INTEGER NOT NULL DEFAULT 10,
  metric              TEXT NOT NULL DEFAULT 'checkins',
  payload             JSONB DEFAULT '{}'::jsonb,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.challenge_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_admin_all" ON public.challenge_templates
  FOR ALL TO authenticated USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'wellness_admin'
  ) WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'wellness_admin'
  );

CREATE POLICY "templates_authed_read" ON public.challenge_templates
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "templates_service_write" ON public.challenge_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Push the migration**

```bash
supabase db push
```

Expected: 1 new migration applied.

- [ ] **Step 3: Verify**

In dashboard SQL editor:

```sql
SELECT count(*) FROM public.audit_log;
SELECT count(*) FROM public.feature_flags;
SELECT count(*) FROM public.integrations;
SELECT count(*) FROM public.billing_state;
SELECT count(*) FROM public.invoices;
SELECT count(*) FROM public.challenge_templates;
```

All should return 0 rows (tables exist, empty).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20240101000018_admin_tables.sql
git commit -m "feat(supabase): admin tables (audit_log, feature_flags, integrations, billing, invoices, challenge_templates)"
```

### Task 0.2: New migration — admin RPCs

**Files:**
- Create: `supabase/migrations/20240101000019_admin_rpcs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Admin RPCs (SECURITY DEFINER, role-checked on entry).
-- Every cross-tenant write also writes an audit row before returning.

-- ── Helper: write to audit_log ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_action TEXT,
  p_target_kind TEXT,
  p_target_id TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_log (
    actor_id, actor_email, action, target_kind, target_id, payload
  ) VALUES (
    (auth.jwt() ->> 'sub')::uuid,
    auth.jwt() ->> 'email',
    p_action,
    p_target_kind,
    p_target_id,
    p_payload
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.write_audit_log TO authenticated;

-- ── admin_create_tenant ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_tenant(
  p_name TEXT,
  p_locale TEXT DEFAULT 'en',
  p_timezone TEXT DEFAULT 'UTC',
  p_plan TEXT DEFAULT 'starter'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role     TEXT;
  v_company  RECORD;
  v_code     TEXT;
  v_slug     TEXT;
BEGIN
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_role <> 'wellness_admin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_slug := lower(regexp_replace(p_name, '[^a-z0-9]+', '-', 'gi'));
  v_code := upper(substr(md5(random()::text || p_name), 1, 8));

  INSERT INTO public.companies (name, slug, code, plan, settings)
  VALUES (p_name, v_slug, v_code, p_plan,
          jsonb_build_object('locale', p_locale, 'timezone', p_timezone))
  RETURNING id, name, slug, code, plan INTO v_company;

  -- Initialise empty billing state
  INSERT INTO public.billing_state (company_id, plan, status)
  VALUES (v_company.id, p_plan, 'active');

  PERFORM public.write_audit_log(
    'create_tenant', 'company', v_company.id::text,
    jsonb_build_object('name', p_name, 'slug', v_slug, 'code', v_code)
  );

  RETURN jsonb_build_object(
    'id', v_company.id,
    'name', v_company.name,
    'slug', v_company.slug,
    'code', v_company.code,
    'plan', v_company.plan
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_tenant TO authenticated;

-- ── admin_set_role ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_role(
  p_user_id UUID,
  p_role TEXT,
  p_company_id UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_role TEXT;
  v_target_email TEXT;
BEGIN
  v_caller_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_caller_role <> 'wellness_admin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_role NOT IN ('employee', 'hr_admin', 'company_admin', 'wellness_admin') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  SELECT email INTO v_target_email FROM auth.users WHERE id = p_user_id;
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
         'role', p_role,
         'company_id', COALESCE(p_company_id::text, raw_app_meta_data ->> 'company_id')
       )
  WHERE id = p_user_id;

  PERFORM public.write_audit_log(
    'set_role', 'user', p_user_id::text,
    jsonb_build_object('email', v_target_email, 'role', p_role, 'company_id', p_company_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_role TO authenticated;

-- ── admin_set_flag ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_flag(
  p_key TEXT,
  p_scope TEXT,
  p_target_id UUID,
  p_enabled BOOLEAN,
  p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_row  RECORD;
BEGIN
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_role <> 'wellness_admin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_scope NOT IN ('global', 'company', 'user') THEN
    RAISE EXCEPTION 'invalid_scope';
  END IF;

  INSERT INTO public.feature_flags (key, scope, target_id, enabled, payload, updated_by)
  VALUES (p_key, p_scope, p_target_id, p_enabled, p_payload, (auth.jwt() ->> 'sub')::uuid)
  ON CONFLICT (key, scope, target_id) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        payload = EXCLUDED.payload,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
  RETURNING id, key, scope, target_id, enabled, payload INTO v_row;

  PERFORM public.write_audit_log(
    'set_flag', 'flag', v_row.id::text,
    jsonb_build_object('key', p_key, 'scope', p_scope, 'enabled', p_enabled)
  );

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_flag TO authenticated;

-- ── admin_set_billing ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_billing(
  p_company_id UUID,
  p_patch JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_updated RECORD;
BEGIN
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_role <> 'wellness_admin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.billing_state
  SET plan       = COALESCE((p_patch ->> 'plan'), plan),
      mrr_cents  = COALESCE((p_patch ->> 'mrr_cents')::int, mrr_cents),
      seats      = COALESCE((p_patch ->> 'seats')::int, seats),
      status     = COALESCE((p_patch ->> 'status'), status),
      period_end = COALESCE((p_patch ->> 'period_end')::date, period_end),
      next_invoice_at = COALESCE((p_patch ->> 'next_invoice_at')::date, next_invoice_at),
      updated_at = NOW()
  WHERE company_id = p_company_id
  RETURNING * INTO v_updated;

  IF v_updated IS NULL THEN
    RAISE EXCEPTION 'company_not_found';
  END IF;

  PERFORM public.write_audit_log(
    'set_billing', 'billing_state', p_company_id::text, p_patch
  );

  RETURN row_to_json(v_updated)::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_billing TO authenticated;

-- ── admin_invite_company_admin ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_invite_company_admin(
  p_company_id UUID,
  p_email TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_role <> 'wellness_admin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Park the (email, company_id) in pending_associations so the auth
  -- hook attaches the company on first sign-in.
  INSERT INTO public.pending_associations (email, company_id, role)
  VALUES (lower(p_email), p_company_id, 'company_admin')
  ON CONFLICT (email) DO UPDATE
    SET company_id = EXCLUDED.company_id,
        role       = EXCLUDED.role;

  PERFORM public.write_audit_log(
    'invite_company_admin', 'company', p_company_id::text,
    jsonb_build_object('email', p_email)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_invite_company_admin TO authenticated;
```

- [ ] **Step 2: Push**

```bash
supabase db push
```

- [ ] **Step 3: Smoke test the role check**

In dashboard SQL editor (toggle "Run as a specific user" to a non-admin
user):

```sql
SELECT public.admin_create_tenant('Test Co');
```

Expected: `ERROR: forbidden`. Confirms the role check works.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20240101000019_admin_rpcs.sql
git commit -m "feat(supabase): admin SECURITY DEFINER RPCs (create_tenant/set_role/set_flag/set_billing/invite_company_admin)"
```

### Task 0.3: Edge function — `admin-export-platform-report`

**Files:**
- Create: `supabase/functions/admin-export-platform-report/index.ts`

- [ ] **Step 1: Write the function**

```ts
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

interface Payload {
  kind: 'tenants' | 'usage';
  range: '7d' | '30d' | '90d';
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { role } = await requireAuth(req);
    if (role !== 'wellness_admin') {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json() as Payload;
    const supabase = createServiceClient();

    let csv = '';
    if (payload.kind === 'tenants') {
      const { data: rows } = await supabase
        .from('companies')
        .select('id, name, slug, plan, created_at, billing_state(plan, mrr_cents, seats, status)');
      csv = 'id,name,slug,plan,created_at,billing_plan,mrr_cents,seats,status\n' +
        (rows ?? []).map((r: any) =>
          [r.id, csvEscape(r.name), r.slug, r.plan, r.created_at,
           r.billing_state?.plan ?? '', r.billing_state?.mrr_cents ?? 0,
           r.billing_state?.seats ?? 0, r.billing_state?.status ?? ''].join(',')
        ).join('\n');
    } else {
      const days = payload.range === '7d' ? 7 : payload.range === '90d' ? 90 : 30;
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const { data: rows } = await supabase
        .from('checkins')
        .select('company_id, count:id', { count: 'exact' })
        .gte('checked_at', since);
      csv = 'company_id,checkin_count\n' +
        (rows ?? []).map((r: any) => `${r.company_id},${r.count ?? 0}`).join('\n');
    }

    const path = `admin-reports/${payload.kind}-${payload.range}-${Date.now()}.csv`;
    const { error: upErr } = await supabase.storage.from('company-assets').upload(path, csv, {
      contentType: 'text/csv',
      upsert: true,
    });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await supabase.storage.from('company-assets')
      .createSignedUrl(path, 60 * 10);
    if (signErr) throw signErr;

    return new Response(JSON.stringify({ url: signed.signedUrl, path }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function csvEscape(v: string | null): string {
  if (v == null) return '';
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy admin-export-platform-report
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/admin-export-platform-report/
git commit -m "feat(supabase): admin-export-platform-report edge function"
```

### Task 0.4: Edge function — `admin-impersonate` (off by default)

**Files:**
- Create: `supabase/functions/admin-impersonate/index.ts`

- [ ] **Step 1: Write the function**

```ts
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Hard gate — disabled unless this secret is set to the literal "true".
  if (Deno.env.get('IMPERSONATION_ENABLED') !== 'true') {
    return new Response(JSON.stringify({ error: 'impersonation_disabled' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { role } = await requireAuth(req);
    if (role !== 'wellness_admin') {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: 'target_user_id_required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createServiceClient();
    const { data: { session }, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: (await supabase.auth.admin.getUserById(target_user_id))?.data?.user?.email ?? '',
    });
    if (error) throw error;

    // Audit BEFORE returning the link
    await supabase.from('audit_log').insert({
      action: 'impersonate',
      target_kind: 'user',
      target_id: target_user_id,
      payload: { issued_at: new Date().toISOString() },
    });

    return new Response(JSON.stringify({ session }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy admin-impersonate
```

- [ ] **Step 3: Confirm impersonation is OFF**

Do NOT set `IMPERSONATION_ENABLED` in function secrets. Verify by
hitting the function — it should return 403 `impersonation_disabled`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/admin-impersonate/
git commit -m "feat(supabase): admin-impersonate edge function (disabled by default)"
```

### Task 0.5: Promote a `wellness_admin` user

**Files:** none (dashboard + SQL).

- [ ] **Step 1: Create the user via the dashboard**

Dashboard → Authentication → Users → Add user. Use a real email you
control. Auto-confirm. Capture the UUID.

- [ ] **Step 2: Promote via SQL**

In dashboard SQL editor:

```sql
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'wellness_admin')
WHERE email = '<ADMIN_EMAIL>';
```

- [ ] **Step 3: Sign out + sign in to refresh JWT**

The custom access token hook reads `app_metadata` on every mint.

- [ ] **Step 4: Append to dev notes**

```bash
cat >> supabase/dev-notes.md <<'EOF'

# Dev-only seed: wellness_admin user

After creating the admin test user via Auth → Users, run the SQL in
docs/superpowers/plans/2026-04-30-admin-console-implementation.md
Task 0.5 to promote them. This is dev-only and does NOT belong in a
versioned migration.
EOF

git add supabase/dev-notes.md
git commit -m "docs(supabase): note dev-only wellness_admin seed procedure"
```

---

## Phase 1 — Move shared modules to `src/shared/`

The HR app's `tokens.jsx` and `components.jsx` are used by the Admin
Console too (the bundle has identical copies). Move them to
`src/shared/` so both apps consume from one place.

### Task 1.1: Move `tokens.jsx` and `components.jsx` to `src/shared/`, update HR imports

**Files:**
- Move: `src/hr/tokens.jsx` → `src/shared/tokens.jsx`
- Move: `src/hr/components.jsx` → `src/shared/components.jsx`
- Modify: every file in `src/hr/` that imports from `./tokens.jsx` or
  `./components.jsx` (sections, App, tweaks-panel, views, hooks if any
  reference them)

- [ ] **Step 1: Create the shared directory and move files**

```bash
mkdir -p src/shared
git mv src/hr/tokens.jsx     src/shared/tokens.jsx
git mv src/hr/components.jsx src/shared/components.jsx
```

(Use `git mv` so git tracks the move as a rename rather than a
delete+add.)

- [ ] **Step 2: Update every HR import**

Find every reference:

```bash
grep -rln "from './tokens.jsx'"      src/hr/
grep -rln "from '../tokens.jsx'"     src/hr/
grep -rln "from './components.jsx'"  src/hr/
grep -rln "from '../components.jsx'" src/hr/
```

For each match, change the path:

- Files in `src/hr/` (depth 0): `'./tokens.jsx'` → `'../shared/tokens.jsx'`
- Files in `src/hr/views/` (depth 1): `'../tokens.jsx'` → `'../../shared/tokens.jsx'`

Same pattern for `components.jsx`.

The Employee app does NOT use these files — leave it alone.

- [ ] **Step 3: Build clean**

```bash
npm run build
```

If imports are broken, the build fails with module-not-found errors —
fix them.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all 31 tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ src/hr/
git commit -m "refactor(shared): move HR tokens/components to src/shared/ for cross-app reuse"
```

---

## Phase 2 — Verbatim Admin frontend extraction

Move every block out of `src/main-admin.jsx` (1,974 lines) into target
modules under `src/admin/`. Same pattern as Employee Phase 2 + HR
Phase 1. Each task ends with `npm run build` clean + commit.

### Task 2.1: Create directory tree

**Files:** none (empty dirs don't commit).

- [ ] **Step 1**: 

```bash
mkdir -p src/admin/state src/admin/hooks/__tests__ src/admin/views
```

### Task 2.2: Drop the duplicate `hr-tokens` and `hr-components` blocks from the admin bundle

The admin bundle currently begins with verbatim copies of the HR
tokens and components blocks (lines ~3-485). Now that `src/shared/`
exists, the admin bundle imports from there instead.

**Files:**
- Modify: `src/main-admin.jsx`

- [ ] **Step 1**: At the top of `src/main-admin.jsx`, after the existing
React/ReactDOM imports, add:

```jsx
import { HR_THEMES, DENSITY, HR_STRINGS } from './shared/tokens.jsx';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from './shared/components.jsx';
```

Then DELETE the entire `// --- hr-tokens.jsx ---` block AND the entire
`// --- hr-components.jsx ---` block from the bundle. The first
remaining section comment should be `// --- admin-sections.jsx ---`.

- [ ] **Step 2**: Build clean

```bash
npm run build
```

- [ ] **Step 3**: Commit

```bash
git add src/main-admin.jsx
git commit -m "refactor(admin): consume shared tokens/components instead of duplicating"
```

### Task 2.3: Extract `sections.jsx`

**Files:**
- Create: `src/admin/sections.jsx`
- Modify: `src/main-admin.jsx`

Block: `// --- admin-sections.jsx ---` through line before
`// --- admin-views.jsx ---`. Contains: `ADMIN_DATA` (a top-level const),
`AdminSidebar`, `AdminTopBar`, `AdminKpiStrip`, `DauMauChart`,
`TenantsTable`, `ContentHealth`, `IntegrationsStatus`, `AuditLog`,
`FeatureFlags`, `AdminTeam`, plus an `Object.assign(window, ...)` line.

- [ ] **Step 1**: Create the file

```jsx
import React from 'react';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from '../shared/components.jsx';

// (paste the verbatim block, including ADMIN_DATA and Object.assign)

export {
  ADMIN_DATA, AdminSidebar, AdminTopBar, AdminKpiStrip, DauMauChart,
  TenantsTable, ContentHealth, IntegrationsStatus, AuditLog,
  FeatureFlags, AdminTeam,
};
```

- [ ] **Step 2**: Update `main-admin.jsx`

```jsx
import {
  ADMIN_DATA, AdminSidebar, AdminTopBar, AdminKpiStrip, DauMauChart,
  TenantsTable, ContentHealth, IntegrationsStatus, AuditLog,
  FeatureFlags, AdminTeam,
} from './admin/sections.jsx';
```

Delete the moved block.

- [ ] **Step 3**: Build clean, commit

```bash
npm run build
git add src/admin/sections.jsx src/main-admin.jsx
git commit -m "refactor(admin): extract sections.jsx from bundle"
```

### Task 2.4: Extract per-view files (excluding tenant-detail and billing)

**Files:**
- Create: `src/admin/views/_header.jsx` (`AdminPageHeader`)
- Create: `src/admin/views/overview.jsx` (`AdminOverview`)
- Create: `src/admin/views/tenants.jsx` (`AdminTenantsView`)
- Create: `src/admin/views/content.jsx` (`AdminContentView`)
- Create: `src/admin/views/integrations.jsx` (`AdminIntegrationsView`)
- Create: `src/admin/views/flags.jsx` (`AdminFlagsView`)
- Create: `src/admin/views/audit.jsx` (`AdminAuditView`)
- Create: `src/admin/views/roles.jsx` (`AdminRolesView`)
- Create: `src/admin/views/localization.jsx` (`AdminLocalizationView`)
- Create: `src/admin/views/challenge-templates.jsx` (`AdminChallengeTemplatesView`)
- Modify: `src/main-admin.jsx`

Block: `// --- admin-views.jsx ---` through line before
`// --- admin-tenant-billing.jsx ---`.

Each view file follows the same structure:

```jsx
import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from '../../shared/components.jsx';
// add admin/sections imports if the view consumes ADMIN_DATA, etc.

// (paste the verbatim block for this view)

export { /* the page function */ };
```

`AdminPageHeader` goes in `_header.jsx`. Each other view function goes
in its own file. If a view references `ADMIN_DATA` (or any other symbol
from `admin/sections.jsx`), import it from `'../sections.jsx'`.

- [ ] **Step 1-10**: Create the 10 view files (one per page function +
`_header.jsx`). Read each function's body to identify the imports it
needs (don't blindly import everything).

- [ ] **Step 11**: Update `main-admin.jsx`

```jsx
import { AdminPageHeader }                 from './admin/views/_header.jsx';
import { AdminOverview }                   from './admin/views/overview.jsx';
import { AdminTenantsView }                from './admin/views/tenants.jsx';
import { AdminContentView }                from './admin/views/content.jsx';
import { AdminIntegrationsView }           from './admin/views/integrations.jsx';
import { AdminFlagsView }                  from './admin/views/flags.jsx';
import { AdminAuditView }                  from './admin/views/audit.jsx';
import { AdminRolesView }                  from './admin/views/roles.jsx';
import { AdminLocalizationView }           from './admin/views/localization.jsx';
import { AdminChallengeTemplatesView }     from './admin/views/challenge-templates.jsx';
```

Delete the entire `// --- admin-views.jsx ---` block.

- [ ] **Step 12**: Build clean, commit

```bash
npm run build
git add src/admin/views/ src/main-admin.jsx
git commit -m "refactor(admin): extract per-view files (overview/tenants/content/integrations/flags/audit/roles/localization/challenge-templates)"
```

### Task 2.5: Extract `tenant-detail.jsx` and `billing.jsx`

**Files:**
- Create: `src/admin/views/tenant-detail.jsx` (`AdminTenantDetail`)
- Create: `src/admin/views/billing.jsx` (`AdminBilling`)
- Modify: `src/main-admin.jsx`

Block: `// --- admin-tenant-billing.jsx ---` through line before
`// --- admin-app.jsx ---`.

- [ ] **Step 1**: Create `tenant-detail.jsx`:

```jsx
import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from '../../shared/components.jsx';
// import ADMIN_DATA or other admin/sections symbols if referenced

// (paste AdminTenantDetail verbatim)

export { AdminTenantDetail };
```

- [ ] **Step 2**: Create `billing.jsx`:

```jsx
import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from '../../shared/components.jsx';

// (paste AdminBilling verbatim)

export { AdminBilling };
```

- [ ] **Step 3**: Update `main-admin.jsx`

```jsx
import { AdminTenantDetail } from './admin/views/tenant-detail.jsx';
import { AdminBilling }      from './admin/views/billing.jsx';
```

Delete the moved block.

- [ ] **Step 4**: Build clean, commit

```bash
npm run build
git add src/admin/views/tenant-detail.jsx src/admin/views/billing.jsx src/main-admin.jsx
git commit -m "refactor(admin): extract tenant-detail and billing views"
```

### Task 2.6: Extract `tweaks-panel.jsx`

**Files:**
- Create: `src/admin/tweaks-panel.jsx`
- Modify: `src/main-admin.jsx`

The remaining `// --- admin-app.jsx ---` block contains: `ADMIN_DEFAULTS`,
`AdminApp`, `TweakRow`, `SegBtn`, plus the `ReactDOM.createRoot(...)`
call.

`TweakRow` and `SegBtn` are private helpers used inside the Tweaks
panel (which is rendered inline inside `AdminApp`). The HR pattern was
to extract them all into a separate `tweaks-panel.jsx`.

For the admin bundle, the Tweaks panel is rendered as JSX directly
inside `AdminApp` (not a named function). Extract the JSX into a
`<TweaksPanel/>` component:

- [ ] **Step 1**: Read the bundle and find the inline Tweaks JSX
inside `AdminApp` (the section that renders when `tweaksOpen` is true,
containing `TweakRow` and `SegBtn`).

- [ ] **Step 2**: Create `src/admin/tweaks-panel.jsx`:

```jsx
import React from 'react';
import { HRIcon } from '../shared/components.jsx';

function TweakRow({ label, children }) { /* ... paste verbatim ... */ }
function SegBtn({ theme, active, onClick, children }) { /* ... paste verbatim ... */ }

export function TweaksPanel({ theme, lang, density, chartStyle, layout, themeKey, setT, setLang, setDensity, setChartStyle, setLayout, setThemeKey, onClose }) {
  // Paste the JSX that was inside AdminApp's tweaksOpen branch.
  // The original referenced setT('lang', setLang) etc. — preserve those calls;
  // the parent passes setT through props.
}
```

(If the original Tweaks panel uses helpers `setT`, `s`, etc. that are
defined inside `AdminApp`, accept them as props — don't duplicate the
logic.)

- [ ] **Step 3**: In `src/main-admin.jsx`, delete `TweakRow` and `SegBtn`,
delete the inline Tweaks JSX inside `AdminApp`, and replace it with
`<TweaksPanel ... />`.

Add the import:

```jsx
import { TweaksPanel } from './admin/tweaks-panel.jsx';
```

- [ ] **Step 4**: Build clean, commit

```bash
npm run build
git add src/admin/tweaks-panel.jsx src/main-admin.jsx
git commit -m "refactor(admin): extract tweaks-panel"
```

### Task 2.7: Extract `App.jsx`

**Files:**
- Create: `src/admin/App.jsx`
- Modify: `src/main-admin.jsx`

The remaining content of `main-admin.jsx` is: imports, `ADMIN_DEFAULTS`,
`AdminApp`, the `ReactDOM.createRoot(...)` call.

- [ ] **Step 1**: Create `src/admin/App.jsx`

Move the imports + `ADMIN_DEFAULTS` + `AdminApp` into the new file.
Update import paths (one directory up):

- `'./shared/tokens.jsx'`     → `'../shared/tokens.jsx'`
- `'./shared/components.jsx'` → `'../shared/components.jsx'`
- `'./admin/sections.jsx'`    → `'./sections.jsx'`
- `'./admin/tweaks-panel.jsx'` → `'./tweaks-panel.jsx'`
- `'./admin/views/...'`        → `'./views/...'`

Add at the bottom:

```jsx
export default AdminApp;
```

- [ ] **Step 2**: Replace `src/main-admin.jsx` with entry-only content

```jsx
import React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './admin/App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

- [ ] **Step 3**: Build + dev smoke

```bash
npm run build
npm run dev &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/admin.html
pkill -f vite 2>/dev/null
```

Expected: 200.

- [ ] **Step 4**: Commit

```bash
git add src/admin/App.jsx src/main-admin.jsx
git commit -m "refactor(admin): extract App.jsx; main-admin is entry only"
```

### Task 2.8: Gate Tweaks panel behind `?tweaks=1` / DEV

**Files:**
- Modify: `src/admin/App.jsx`

Same pattern as Employee + HR. Inside `AdminApp`:

```jsx
const tweaksAvailable = import.meta.env.DEV ||
  new URLSearchParams(window.location.search).get('tweaks') === '1';
```

Wrap the `<TweaksPanel ... />` render and any visible toggle button
(`onTweaks` prop on TopBar). Also gate the `__activate_edit_mode`
postMessage listener early-return.

- [ ] **Step 1**: Add the gate

- [ ] **Step 2**: Build + preview smoke

```bash
npm run build
npm run preview &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/admin.html
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:4173/admin.html?tweaks=1"
pkill -f "vite preview" 2>/dev/null
```

Both 200.

- [ ] **Step 3**: Commit

```bash
git add src/admin/App.jsx
git commit -m "feat(admin): gate Tweaks panel behind ?tweaks=1 in prod"
```

---

## Phase 3 — Admin client wrapper

### Task 3.1: Create `src/lib/supabase-admin.ts`

**Files:**
- Create: `src/lib/supabase-admin.ts`

Admin-specific helpers wrapping the SECURITY DEFINER RPCs and the new
admin tables.

- [ ] **Step 1**: Write the file

```ts
import { supabase } from './supabase';

// ── Platform overview ──────────────────────────────────────────

export async function getPlatformOverview() {
  // Aggregate across companies — admin-only.
  const { data: companies, error: e1 } = await supabase
    .from('companies')
    .select('id, name, slug, plan, created_at, billing_state(plan, mrr_cents, seats, status)');
  if (e1) throw e1;

  const totals = (companies ?? []).reduce((acc, c: any) => {
    acc.tenants  += 1;
    acc.seats    += c.billing_state?.seats ?? 0;
    acc.mrr_cents += c.billing_state?.mrr_cents ?? 0;
    return acc;
  }, { tenants: 0, seats: 0, mrr_cents: 0 });

  return { companies: companies ?? [], totals };
}

// ── Tenants ────────────────────────────────────────────────────

export async function listTenants() {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, slug, code, plan, created_at, settings, billing_state(plan, mrr_cents, seats, status)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTenant(companyId: string) {
  const { data, error } = await supabase
    .from('companies')
    .select('*, billing_state(*), invoices(*), integrations(*), teams(*)')
    .eq('id', companyId)
    .single();
  if (error) throw error;
  return data;
}

export async function createTenant(payload: { name: string; locale?: string; timezone?: string; plan?: string }) {
  const { data, error } = await supabase.rpc('admin_create_tenant', {
    p_name:     payload.name,
    p_locale:   payload.locale   ?? 'en',
    p_timezone: payload.timezone ?? 'UTC',
    p_plan:     payload.plan     ?? 'starter',
  });
  if (error) throw error;
  return data;
}

export async function inviteCompanyAdmin(companyId: string, email: string) {
  const { error } = await supabase.rpc('admin_invite_company_admin', {
    p_company_id: companyId, p_email: email,
  });
  if (error) throw error;
}

// ── Billing ────────────────────────────────────────────────────

export async function listInvoices(companyId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('company_id', companyId)
    .order('period_end', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function setBilling(companyId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('admin_set_billing', {
    p_company_id: companyId, p_patch: patch,
  });
  if (error) throw error;
  return data;
}

// ── Content (global) ───────────────────────────────────────────

export async function listGlobalContent() {
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function updateContent(id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('content_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Integrations ───────────────────────────────────────────────

export async function listIntegrations() {
  const { data, error } = await supabase
    .from('integrations')
    .select('*, companies(name, slug)')
    .order('configured_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function setIntegration(companyId: string, kind: string, status: string, config?: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('integrations')
    .upsert({ company_id: companyId, kind, status, config: config ?? {}, configured_at: new Date().toISOString() }, { onConflict: 'company_id,kind' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Feature flags ──────────────────────────────────────────────

export async function listFlags() {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function setFlag(payload: { key: string; scope: 'global' | 'company' | 'user'; target_id?: string; enabled: boolean; payload?: Record<string, unknown> }) {
  const { data, error } = await supabase.rpc('admin_set_flag', {
    p_key:       payload.key,
    p_scope:     payload.scope,
    p_target_id: payload.target_id ?? null,
    p_enabled:   payload.enabled,
    p_payload:   payload.payload ?? {},
  });
  if (error) throw error;
  return data;
}

// ── Audit ──────────────────────────────────────────────────────

export async function listAudit(limit = 100) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ── Roles ──────────────────────────────────────────────────────

export async function listAdmins() {
  // Users with an admin-like role
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, role, company_id, companies(name, slug)')
    .in('role', ['hr_admin', 'company_admin', 'wellness_admin']);
  if (error) throw error;
  return data ?? [];
}

export async function setRole(userId: string, role: string, companyId?: string) {
  const { error } = await supabase.rpc('admin_set_role', {
    p_user_id:    userId,
    p_role:       role,
    p_company_id: companyId ?? null,
  });
  if (error) throw error;
}

// ── Localization ───────────────────────────────────────────────

export async function listStrings() {
  const { data, error } = await supabase
    .from('localization_strings')
    .select('*')
    .order('key');
  if (error) {
    // Table may not exist yet — return [] so the view renders an empty state.
    if (String(error?.code) === '42P01') return [];
    throw error;
  }
  return data ?? [];
}

export async function setString(key: string, lang: string, value: string) {
  const { data, error } = await supabase
    .from('localization_strings')
    .upsert({ key, lang, value }, { onConflict: 'key,lang' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Challenge templates ────────────────────────────────────────

export async function listChallengeTemplates() {
  const { data, error } = await supabase
    .from('challenge_templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createChallengeTemplate(payload: {
  slug: string; title_en: string; title_ar?: string;
  kind?: string; default_window_days?: number;
  target?: number; metric?: string; payload?: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from('challenge_templates')
    .insert({ ...payload })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Reports ────────────────────────────────────────────────────

export async function exportPlatformReport(kind: 'tenants' | 'usage', range: '7d' | '30d' | '90d') {
  const { data, error } = await supabase.functions.invoke('admin-export-platform-report', {
    body: { kind, range },
  });
  if (error) throw error;
  return data as { url: string; path: string };
}
```

- [ ] **Step 2**: Build (TypeScript compile)

```bash
npm run build
```

Expected: clean.

- [ ] **Step 3**: Commit

```bash
git add src/lib/supabase-admin.ts
git commit -m "feat(admin): add Admin client wrapper (supabase-admin.ts)"
```

---

## Phase 4 — Auth + AppConfig contexts (Admin variants)

### Task 4.1: Admin `AppConfigContext`

**Files:**
- Create: `src/admin/state/app-config-context.jsx`
- Modify: `src/admin/App.jsx`

The bundle's `ADMIN_DEFAULTS` includes `themeKey, lang, density,
chartStyle, layout`. Mirror those keys.

- [ ] **Step 1**: Create the context

```jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'wellness:admin-app-config';

const DEFAULTS = {
  themeKey:   'dark',
  lang:       'en',
  density:    'comfortable',
  chartStyle: 'area',
  layout:     'default',
};

const AdminAppConfigContext = createContext(null);

export function AdminAppConfigProvider({ children }) {
  const [cfg, setCfg] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch { return DEFAULTS; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
  }, [cfg]);

  const value = { cfg, setCfg, patch: (p) => setCfg(c => ({ ...c, ...p })) };
  return <AdminAppConfigContext.Provider value={value}>{children}</AdminAppConfigContext.Provider>;
}

export function useAdminAppConfig() {
  const ctx = useContext(AdminAppConfigContext);
  if (!ctx) throw new Error('useAdminAppConfig must be used inside AdminAppConfigProvider');
  return ctx;
}
```

- [ ] **Step 2**: Wrap `AdminApp` with the provider in `src/admin/App.jsx`

Refactor:

```jsx
import { AdminAppConfigProvider, useAdminAppConfig } from './state/app-config-context.jsx';

function AppInner() {
  const { cfg, setCfg } = useAdminAppConfig();
  // ... existing AdminApp body, with the local cfg useState removed
}

export default function App() {
  return (
    <AdminAppConfigProvider>
      <AppInner />
    </AdminAppConfigProvider>
  );
}
```

- [ ] **Step 3**: Build + commit

```bash
npm run build
git add src/admin/state/app-config-context.jsx src/admin/App.jsx
git commit -m "feat(admin): AdminAppConfigContext with localStorage persistence"
```

### Task 4.2: Admin `AuthContext`

**Files:**
- Create: `src/admin/state/auth-context.jsx`
- Modify: `src/admin/App.jsx`

Same shape as the HR context, exposing `role` from
`session.user.app_metadata.role`. Sign-in is plain email OTP — no
company-code step.

- [ ] **Step 1**: Create the context

```jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  supabase, signInWithOtp, verifyOtp as verifyOtpRaw,
  signOut as signOutRaw, getMyProfile,
} from '../../lib/supabase';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingEmail, setPendingEmail] = useState(null);

  const role = session?.user?.app_metadata?.role || null;

  const refreshProfile = useCallback(async () => {
    if (!session) { setProfile(null); return; }
    try { setProfile(await getMyProfile()); }
    catch (e) { console.warn('[admin-auth] refreshProfile failed', e); }
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  const signIn = useCallback(async (email) => {
    await signInWithOtp(email);
    setPendingEmail(email);
  }, []);

  const verifyOtp = useCallback(async (token) => {
    if (!pendingEmail) throw new Error('No pending email');
    const { data, error } = await verifyOtpRaw(pendingEmail, token);
    if (error) throw error;
    setPendingEmail(null);
    return data;
  }, [pendingEmail]);

  const signOut = useCallback(async () => {
    await signOutRaw();
    setProfile(null); setPendingEmail(null);
  }, []);

  const value = { session, profile, role, loading, pendingEmail, signIn, verifyOtp, signOut, refreshProfile };
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
```

- [ ] **Step 2**: Wrap with `AdminAuthProvider` in `App.jsx`

```jsx
import { AdminAuthProvider } from './state/auth-context.jsx';

export default function App() {
  return (
    <AdminAppConfigProvider>
      <AdminAuthProvider>
        <AppInner />
      </AdminAuthProvider>
    </AdminAppConfigProvider>
  );
}
```

- [ ] **Step 3**: Build + commit

```bash
npm run build
git add src/admin/state/auth-context.jsx src/admin/App.jsx
git commit -m "feat(admin): AdminAuthContext with role exposure"
```

### Task 4.3: Sign-in + access-denied + role gate

**Files:**
- Create: `src/admin/views/sign-in.jsx`
- Create: `src/admin/views/access-denied.jsx`
- Modify: `src/admin/App.jsx`

- [ ] **Step 1**: Create `sign-in.jsx`

```jsx
import React, { useState } from 'react';
import { useAdminAuth } from '../state/auth-context.jsx';
import { HRButton } from '../../shared/components.jsx';

export function SignIn({ theme, dir }) {
  const { signIn, verifyOtp, pendingEmail } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState(null);

  const handleSendCode = async () => {
    setErr(null); setBusy(true);
    try { await signIn(email); }
    catch (e) { setErr(e?.message || 'Failed to send code'); }
    finally { setBusy(false); }
  };

  const handleVerify = async () => {
    setErr(null); setBusy(true);
    try { await verifyOtp(token); }
    catch (e) { setErr(e?.message || 'Invalid code'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg, color: theme.text }} dir={dir}>
      <div style={{ width: 360, padding: 32, background: theme.panel, borderRadius: 16, border: `1px solid ${theme.border}` }}>
        <h1 className="display" style={{ fontSize: 24, marginBottom: 16, marginTop: 0 }}>Admin Console</h1>
        {!pendingEmail ? (
          <>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@wellness.plus" style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, background: theme.panelSunk, border: `1px solid ${theme.border}`, color: theme.text, marginBottom: 12, boxSizing: 'border-box' }} />
            <HRButton theme={theme} onClick={handleSendCode} disabled={busy || !email}>{busy ? 'Sending…' : 'Send code'}</HRButton>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 12 }}>Code sent to {pendingEmail}</div>
            <input value={token} onChange={e => setToken(e.target.value)} placeholder="6-digit code" style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, background: theme.panelSunk, border: `1px solid ${theme.border}`, color: theme.text, marginBottom: 12, boxSizing: 'border-box' }} />
            <HRButton theme={theme} onClick={handleVerify} disabled={busy || token.length < 6}>{busy ? 'Verifying…' : 'Verify'}</HRButton>
          </>
        )}
        {err && <div style={{ fontSize: 12, color: theme.danger || '#ff6b6b', marginTop: 12 }}>{err}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2**: Create `access-denied.jsx`

```jsx
import React from 'react';
import { useAdminAuth } from '../state/auth-context.jsx';
import { HRButton } from '../../shared/components.jsx';

export function AccessDenied({ theme, dir }) {
  const { signOut } = useAdminAuth();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg, color: theme.text }} dir={dir}>
      <div style={{ width: 360, padding: 32, background: theme.panel, borderRadius: 16, border: `1px solid ${theme.border}`, textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 24, marginBottom: 12, marginTop: 0 }}>No access</h1>
        <p style={{ fontSize: 14, color: theme.textMuted, marginBottom: 16 }}>
          The Admin Console is restricted to Wellness+ staff. If you believe you should have access, contact the engineering team.
        </p>
        <HRButton theme={theme} variant="secondary" onClick={signOut}>Sign out</HRButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 3**: Insert the gate in `App.jsx` `AppInner`

```jsx
import { useAdminAuth } from './state/auth-context.jsx';
import { SignIn } from './views/sign-in.jsx';
import { AccessDenied } from './views/access-denied.jsx';

// Inside AppInner, after T (theme), dir are computed:
const { session, role, loading: authLoading } = useAdminAuth();

if (authLoading) return <div style={{ minHeight: '100vh', background: T.bg }}/>;
if (!session)    return <SignIn theme={T} dir={dir}/>;
if (role !== 'wellness_admin') return <AccessDenied theme={T} dir={dir}/>;
// otherwise, render the existing admin shell
```

- [ ] **Step 4**: Build + dev smoke

```bash
npm run build
npm run dev &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/admin.html
pkill -f vite 2>/dev/null
```

- [ ] **Step 5**: Commit

```bash
git add src/admin/views/sign-in.jsx src/admin/views/access-denied.jsx src/admin/App.jsx
git commit -m "feat(admin): sign-in screen + wellness_admin role gate"
```

---

## Phase 5 — Data hooks with TDD

11 hooks, each a thin wrapper over `src/lib/supabase-admin.ts`. Same
TDD pattern as HR Phase 4. Mock path: `'../../../lib/supabase-admin'`.

### Task 5.1: `use-platform-overview` (TDD)

**Files:**
- Create: `src/admin/hooks/__tests__/use-platform-overview.test.js`
- Create: `src/admin/hooks/use-platform-overview.js`

- [ ] **Step 1**: Test

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  getPlatformOverview: vi.fn(),
}));

import { getPlatformOverview } from '../../../lib/supabase-admin';
import { usePlatformOverview } from '../use-platform-overview';

beforeEach(() => {
  vi.clearAllMocks();
  getPlatformOverview.mockResolvedValue({
    companies: [{ id: 'c1', name: 'Acme' }],
    totals: { tenants: 1, seats: 50, mrr_cents: 100000 },
  });
});

describe('usePlatformOverview', () => {
  it('loads overview on mount', async () => {
    const { result } = renderHook(() => usePlatformOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.totals.tenants).toBe(1);
  });
});
```

- [ ] **Step 2**: Implement

```js
import { useState, useEffect, useCallback } from 'react';
import { getPlatformOverview } from '../../lib/supabase-admin';

export function usePlatformOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await getPlatformOverview()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}
```

- [ ] **Step 3**: Run + commit

```bash
npm test src/admin/hooks/__tests__/use-platform-overview.test.js
git add src/admin/hooks/use-platform-overview.js src/admin/hooks/__tests__/use-platform-overview.test.js
git commit -m "feat(admin): use-platform-overview hook with tests"
```

### Task 5.2: `use-tenants` (TDD)

**Files:**
- Create: `src/admin/hooks/__tests__/use-tenants.test.js`
- Create: `src/admin/hooks/use-tenants.js`

- [ ] **Step 1**: Test

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listTenants: vi.fn(),
  createTenant: vi.fn(),
}));

import { listTenants, createTenant } from '../../../lib/supabase-admin';
import { useTenants } from '../use-tenants';

beforeEach(() => {
  vi.clearAllMocks();
  listTenants.mockResolvedValue([{ id: 't1', name: 'Acme' }]);
});

describe('useTenants', () => {
  it('lists tenants on mount', async () => {
    const { result } = renderHook(() => useTenants());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tenants).toHaveLength(1);
  });

  it('creates a tenant', async () => {
    createTenant.mockResolvedValue({ id: 't2', name: 'Beta' });
    const { result } = renderHook(() => useTenants());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create({ name: 'Beta' }); });
    expect(createTenant).toHaveBeenCalledWith({ name: 'Beta' });
  });
});
```

- [ ] **Step 2**: Implement

```js
import { useState, useEffect, useCallback } from 'react';
import { listTenants, createTenant } from '../../lib/supabase-admin';

export function useTenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTenants(await listTenants()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const create = useCallback(async (payload) => {
    const created = await createTenant(payload);
    await refetch();
    return created;
  }, [refetch]);

  return { tenants, loading, error, create, refetch };
}
```

- [ ] **Step 3**: Run + commit

```bash
npm test src/admin/hooks/__tests__/use-tenants.test.js
git add src/admin/hooks/use-tenants.js src/admin/hooks/__tests__/use-tenants.test.js
git commit -m "feat(admin): use-tenants hook with tests"
```

### Task 5.3: `use-tenant` (TDD)

**Files:**
- Create: `src/admin/hooks/__tests__/use-tenant.test.js`
- Create: `src/admin/hooks/use-tenant.js`

- [ ] **Step 1**: Test

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  getTenant: vi.fn(),
  inviteCompanyAdmin: vi.fn(),
}));

import { getTenant, inviteCompanyAdmin } from '../../../lib/supabase-admin';
import { useTenant } from '../use-tenant';

beforeEach(() => {
  vi.clearAllMocks();
  getTenant.mockResolvedValue({ id: 't1', name: 'Acme', billing_state: { plan: 'starter' } });
});

describe('useTenant', () => {
  it('loads tenant when id provided', async () => {
    const { result } = renderHook(() => useTenant('t1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tenant.name).toBe('Acme');
  });

  it('skips fetch when id is null', async () => {
    const { result } = renderHook(() => useTenant(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getTenant).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2**: Implement

```js
import { useState, useEffect, useCallback } from 'react';
import { getTenant, inviteCompanyAdmin } from '../../lib/supabase-admin';

export function useTenant(companyId) {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!companyId) { setTenant(null); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setTenant(await getTenant(companyId)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { refetch(); }, [refetch]);

  const invite = useCallback(async (email) => {
    if (!companyId) throw new Error('no_company');
    await inviteCompanyAdmin(companyId, email);
  }, [companyId]);

  return { tenant, loading, error, invite, refetch };
}
```

- [ ] **Step 3**: Run + commit

```bash
npm test src/admin/hooks/__tests__/use-tenant.test.js
git add src/admin/hooks/use-tenant.js src/admin/hooks/__tests__/use-tenant.test.js
git commit -m "feat(admin): use-tenant hook with tests"
```

### Task 5.4: `use-billing` (TDD)

**Files:**
- Create: `src/admin/hooks/__tests__/use-billing.test.js`
- Create: `src/admin/hooks/use-billing.js`

- [ ] **Step 1**: Test

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listInvoices: vi.fn(),
  setBilling: vi.fn(),
}));

import { listInvoices, setBilling } from '../../../lib/supabase-admin';
import { useBilling } from '../use-billing';

beforeEach(() => {
  vi.clearAllMocks();
  listInvoices.mockResolvedValue([{ id: 'i1', amount_cents: 50000 }]);
});

describe('useBilling', () => {
  it('lists invoices for tenant', async () => {
    const { result } = renderHook(() => useBilling('t1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.invoices).toHaveLength(1);
  });

  it('updates billing state', async () => {
    setBilling.mockResolvedValue({ company_id: 't1', mrr_cents: 100000 });
    const { result } = renderHook(() => useBilling('t1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.update({ mrr_cents: 100000 }); });
    expect(setBilling).toHaveBeenCalledWith('t1', { mrr_cents: 100000 });
  });
});
```

- [ ] **Step 2**: Implement

```js
import { useState, useEffect, useCallback } from 'react';
import { listInvoices, setBilling } from '../../lib/supabase-admin';

export function useBilling(companyId) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!companyId) { setInvoices([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setInvoices(await listInvoices(companyId)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { refetch(); }, [refetch]);

  const update = useCallback(async (patch) => {
    if (!companyId) throw new Error('no_company');
    return setBilling(companyId, patch);
  }, [companyId]);

  return { invoices, loading, error, update, refetch };
}
```

- [ ] **Step 3**: Run + commit

```bash
npm test src/admin/hooks/__tests__/use-billing.test.js
git add src/admin/hooks/use-billing.js src/admin/hooks/__tests__/use-billing.test.js
git commit -m "feat(admin): use-billing hook with tests"
```

### Task 5.5: `use-content` (TDD)

**Files:**
- Create: `src/admin/hooks/__tests__/use-content.test.js`
- Create: `src/admin/hooks/use-content.js`

- [ ] **Step 1**: Test

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listGlobalContent: vi.fn(),
  updateContent: vi.fn(),
}));

import { listGlobalContent, updateContent } from '../../../lib/supabase-admin';
import { useContent } from '../use-content';

beforeEach(() => {
  vi.clearAllMocks();
  listGlobalContent.mockResolvedValue([{ id: 'c1', title_en: 'Sleep' }]);
});

describe('useContent (admin)', () => {
  it('loads content list', async () => {
    const { result } = renderHook(() => useContent());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
  });

  it('updates an item', async () => {
    updateContent.mockResolvedValue({ id: 'c1', title_en: 'Better Sleep' });
    const { result } = renderHook(() => useContent());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.update('c1', { title_en: 'Better Sleep' }); });
    expect(updateContent).toHaveBeenCalledWith('c1', { title_en: 'Better Sleep' });
  });
});
```

- [ ] **Step 2**: Implement

```js
import { useState, useEffect, useCallback } from 'react';
import { listGlobalContent, updateContent } from '../../lib/supabase-admin';

export function useContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listGlobalContent()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const update = useCallback(async (id, patch) => {
    const u = await updateContent(id, patch);
    await refetch();
    return u;
  }, [refetch]);

  return { items, loading, error, update, refetch };
}
```

- [ ] **Step 3**: Run + commit

```bash
npm test src/admin/hooks/__tests__/use-content.test.js
git add src/admin/hooks/use-content.js src/admin/hooks/__tests__/use-content.test.js
git commit -m "feat(admin): use-content hook with tests"
```

### Task 5.6: `use-integrations` (TDD)

**Files:**
- Create: `src/admin/hooks/__tests__/use-integrations.test.js`
- Create: `src/admin/hooks/use-integrations.js`

- [ ] **Step 1**: Test

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listIntegrations: vi.fn(),
  setIntegration: vi.fn(),
}));

import { listIntegrations, setIntegration } from '../../../lib/supabase-admin';
import { useIntegrations } from '../use-integrations';

beforeEach(() => {
  vi.clearAllMocks();
  listIntegrations.mockResolvedValue([{ id: 'i1', kind: 'slack', status: 'pending' }]);
});

describe('useIntegrations', () => {
  it('lists integrations', async () => {
    const { result } = renderHook(() => useIntegrations());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.integrations).toHaveLength(1);
  });

  it('updates an integration', async () => {
    setIntegration.mockResolvedValue({ id: 'i1', status: 'configured' });
    const { result } = renderHook(() => useIntegrations());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.set('co1', 'slack', 'configured', { token: 'x' }); });
    expect(setIntegration).toHaveBeenCalledWith('co1', 'slack', 'configured', { token: 'x' });
  });
});
```

- [ ] **Step 2**: Implement

```js
import { useState, useEffect, useCallback } from 'react';
import { listIntegrations, setIntegration } from '../../lib/supabase-admin';

export function useIntegrations() {
  const [integrations, setIntegrationsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setIntegrationsState(await listIntegrations()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const set = useCallback(async (companyId, kind, status, config) => {
    const u = await setIntegration(companyId, kind, status, config);
    await refetch();
    return u;
  }, [refetch]);

  return { integrations, loading, error, set, refetch };
}
```

- [ ] **Step 3**: Run + commit

```bash
npm test src/admin/hooks/__tests__/use-integrations.test.js
git add src/admin/hooks/use-integrations.js src/admin/hooks/__tests__/use-integrations.test.js
git commit -m "feat(admin): use-integrations hook with tests"
```

### Task 5.7: `use-flags` (TDD)

**Files:**
- Create: `src/admin/hooks/__tests__/use-flags.test.js`
- Create: `src/admin/hooks/use-flags.js`

- [ ] **Step 1**: Test

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listFlags: vi.fn(),
  setFlag: vi.fn(),
}));

import { listFlags, setFlag } from '../../../lib/supabase-admin';
import { useFlags } from '../use-flags';

beforeEach(() => {
  vi.clearAllMocks();
  listFlags.mockResolvedValue([{ id: 'f1', key: 'new_home', enabled: true }]);
});

describe('useFlags', () => {
  it('lists flags', async () => {
    const { result } = renderHook(() => useFlags());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.flags).toHaveLength(1);
  });

  it('toggles a flag', async () => {
    setFlag.mockResolvedValue({ id: 'f1', enabled: false });
    const { result } = renderHook(() => useFlags());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.set({ key: 'new_home', scope: 'global', enabled: false }); });
    expect(setFlag).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2**: Implement

```js
import { useState, useEffect, useCallback } from 'react';
import { listFlags, setFlag } from '../../lib/supabase-admin';

export function useFlags() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setFlags(await listFlags()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const set = useCallback(async (payload) => {
    const u = await setFlag(payload);
    await refetch();
    return u;
  }, [refetch]);

  return { flags, loading, error, set, refetch };
}
```

- [ ] **Step 3**: Run + commit

```bash
npm test src/admin/hooks/__tests__/use-flags.test.js
git add src/admin/hooks/use-flags.js src/admin/hooks/__tests__/use-flags.test.js
git commit -m "feat(admin): use-flags hook with tests"
```

### Task 5.8: `use-audit` (TDD)

**Files:**
- Create: `src/admin/hooks/__tests__/use-audit.test.js`
- Create: `src/admin/hooks/use-audit.js`

- [ ] **Step 1**: Test

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({ listAudit: vi.fn() }));

import { listAudit } from '../../../lib/supabase-admin';
import { useAudit } from '../use-audit';

beforeEach(() => {
  vi.clearAllMocks();
  listAudit.mockResolvedValue([{ id: 'a1', action: 'create_tenant' }]);
});

describe('useAudit', () => {
  it('lists audit rows', async () => {
    const { result } = renderHook(() => useAudit());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
  });
});
```

- [ ] **Step 2**: Implement

```js
import { useState, useEffect, useCallback } from 'react';
import { listAudit } from '../../lib/supabase-admin';

export function useAudit(limit = 100) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setEntries(await listAudit(limit)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [limit]);

  useEffect(() => { refetch(); }, [refetch]);
  return { entries, loading, error, refetch };
}
```

- [ ] **Step 3**: Run + commit

```bash
npm test src/admin/hooks/__tests__/use-audit.test.js
git add src/admin/hooks/use-audit.js src/admin/hooks/__tests__/use-audit.test.js
git commit -m "feat(admin): use-audit hook with tests"
```

### Task 5.9: `use-roles` (TDD)

**Files:**
- Create: `src/admin/hooks/__tests__/use-roles.test.js`
- Create: `src/admin/hooks/use-roles.js`

- [ ] **Step 1**: Test

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listAdmins: vi.fn(),
  setRole: vi.fn(),
}));

import { listAdmins, setRole } from '../../../lib/supabase-admin';
import { useRoles } from '../use-roles';

beforeEach(() => {
  vi.clearAllMocks();
  listAdmins.mockResolvedValue([{ id: 'u1', display_name: 'Alex', role: 'hr_admin' }]);
});

describe('useRoles', () => {
  it('lists admins', async () => {
    const { result } = renderHook(() => useRoles());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.admins).toHaveLength(1);
  });

  it('promotes a user', async () => {
    setRole.mockResolvedValue();
    const { result } = renderHook(() => useRoles());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.promote('u1', 'hr_admin', 'co1'); });
    expect(setRole).toHaveBeenCalledWith('u1', 'hr_admin', 'co1');
  });
});
```

- [ ] **Step 2**: Implement

```js
import { useState, useEffect, useCallback } from 'react';
import { listAdmins, setRole } from '../../lib/supabase-admin';

export function useRoles() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setAdmins(await listAdmins()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const promote = useCallback(async (userId, role, companyId) => {
    await setRole(userId, role, companyId);
    await refetch();
  }, [refetch]);

  return { admins, loading, error, promote, refetch };
}
```

- [ ] **Step 3**: Run + commit

```bash
npm test src/admin/hooks/__tests__/use-roles.test.js
git add src/admin/hooks/use-roles.js src/admin/hooks/__tests__/use-roles.test.js
git commit -m "feat(admin): use-roles hook with tests"
```

### Task 5.10: `use-localization` (TDD)

**Files:**
- Create: `src/admin/hooks/__tests__/use-localization.test.js`
- Create: `src/admin/hooks/use-localization.js`

- [ ] **Step 1**: Test

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listStrings: vi.fn(),
  setString: vi.fn(),
}));

import { listStrings, setString } from '../../../lib/supabase-admin';
import { useLocalization } from '../use-localization';

beforeEach(() => {
  vi.clearAllMocks();
  listStrings.mockResolvedValue([{ key: 'home.greeting', lang: 'en', value: 'Hi' }]);
});

describe('useLocalization', () => {
  it('lists strings', async () => {
    const { result } = renderHook(() => useLocalization());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.strings).toHaveLength(1);
  });

  it('saves a string', async () => {
    setString.mockResolvedValue({ key: 'home.greeting', lang: 'ar', value: 'مرحبا' });
    const { result } = renderHook(() => useLocalization());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.save('home.greeting', 'ar', 'مرحبا'); });
    expect(setString).toHaveBeenCalledWith('home.greeting', 'ar', 'مرحبا');
  });
});
```

- [ ] **Step 2**: Implement

```js
import { useState, useEffect, useCallback } from 'react';
import { listStrings, setString } from '../../lib/supabase-admin';

export function useLocalization() {
  const [strings, setStrings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setStrings(await listStrings()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const save = useCallback(async (key, lang, value) => {
    const u = await setString(key, lang, value);
    await refetch();
    return u;
  }, [refetch]);

  return { strings, loading, error, save, refetch };
}
```

- [ ] **Step 3**: Run + commit

```bash
npm test src/admin/hooks/__tests__/use-localization.test.js
git add src/admin/hooks/use-localization.js src/admin/hooks/__tests__/use-localization.test.js
git commit -m "feat(admin): use-localization hook with tests"
```

### Task 5.11: `use-challenge-templates` (TDD)

**Files:**
- Create: `src/admin/hooks/__tests__/use-challenge-templates.test.js`
- Create: `src/admin/hooks/use-challenge-templates.js`

- [ ] **Step 1**: Test

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listChallengeTemplates: vi.fn(),
  createChallengeTemplate: vi.fn(),
}));

import { listChallengeTemplates, createChallengeTemplate } from '../../../lib/supabase-admin';
import { useChallengeTemplates } from '../use-challenge-templates';

beforeEach(() => {
  vi.clearAllMocks();
  listChallengeTemplates.mockResolvedValue([{ id: 't1', slug: 'move' }]);
});

describe('useChallengeTemplates', () => {
  it('lists templates', async () => {
    const { result } = renderHook(() => useChallengeTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.templates).toHaveLength(1);
  });

  it('creates a template', async () => {
    createChallengeTemplate.mockResolvedValue({ id: 't2', slug: 'walk' });
    const { result } = renderHook(() => useChallengeTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create({ slug: 'walk', title_en: 'Walk' }); });
    expect(createChallengeTemplate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2**: Implement

```js
import { useState, useEffect, useCallback } from 'react';
import { listChallengeTemplates, createChallengeTemplate } from '../../lib/supabase-admin';

export function useChallengeTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTemplates(await listChallengeTemplates()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const create = useCallback(async (payload) => {
    const t = await createChallengeTemplate(payload);
    await refetch();
    return t;
  }, [refetch]);

  return { templates, loading, error, create, refetch };
}
```

- [ ] **Step 3**: Run + commit

```bash
npm test src/admin/hooks/__tests__/use-challenge-templates.test.js
git add src/admin/hooks/use-challenge-templates.js src/admin/hooks/__tests__/use-challenge-templates.test.js
git commit -m "feat(admin): use-challenge-templates hook with tests"
```

---

## Phase 6 — Wire each view

11 views, one task each. Same pattern as HR Phase 5.

### Task 6.1: Wire Overview (Dashboard)

**File:** `src/admin/App.jsx` (the section that renders when active === 'overview') or `src/admin/views/overview.jsx`

```jsx
import { usePlatformOverview } from '../hooks/use-platform-overview.js';

export function AdminOverview({ theme, density, chartStyle, layout, lang, onOpenTenant }) {
  const { data, loading } = usePlatformOverview();
  if (loading || !data) return <OverviewLoading theme={theme}/>;
  // pass data.totals into KPI tiles, data.companies into the tenants table
}
```

- [ ] Build clean. Commit: `feat(admin): wire overview to use-platform-overview`

### Task 6.2: Wire Tenants list

**File:** `src/admin/views/tenants.jsx`

```jsx
import { useTenants } from '../hooks/use-tenants.js';

export function AdminTenantsView({ theme, density, lang, onOpen }) {
  const { tenants, loading, create } = useTenants();
  // "New tenant" form calls create({ name, locale, timezone, plan })
}
```

- [ ] Build + commit: `feat(admin): wire tenants view to use-tenants`

### Task 6.3: Wire Tenant Detail

**File:** `src/admin/views/tenant-detail.jsx`

```jsx
import { useTenant } from '../hooks/use-tenant.js';

export function AdminTenantDetail({ theme, density, lang, tenant: tenantArg, onBack }) {
  const { tenant, loading, invite } = useTenant(tenantArg?.id);
  if (loading || !tenant) return <TenantDetailLoading theme={theme}/>;
  // render tenant.name, tenant.billing_state, tenant.integrations, tenant.teams
  // "Invite admin" form calls invite(email)
}
```

- [ ] Build + commit: `feat(admin): wire tenant detail to use-tenant`

### Task 6.4: Wire Billing

**File:** `src/admin/views/billing.jsx`

```jsx
import { useBilling } from '../hooks/use-billing.js';
import { useState } from 'react';

export function AdminBilling({ theme, density, lang, companyId }) {
  const { invoices, loading, update } = useBilling(companyId);
  // render invoices; edit form calls update({ mrr_cents, plan, status, ... })
}
```

If the existing `AdminBilling` doesn't take `companyId`, accept the
nearest equivalent (the parent passes `tenant?.id`). Update the call
site in `App.jsx` if needed.

- [ ] Build + commit: `feat(admin): wire billing view to use-billing`

### Task 6.5: Wire Content (global)

**File:** `src/admin/views/content.jsx`

```jsx
import { useContent } from '../hooks/use-content.js';

export function AdminContentView({ theme, density, lang }) {
  const { items, loading, update } = useContent();
  // edit form calls update(item.id, patch)
}
```

- [ ] Build + commit: `feat(admin): wire global content view to use-content`

### Task 6.6: Wire Integrations

**File:** `src/admin/views/integrations.jsx`

```jsx
import { useIntegrations } from '../hooks/use-integrations.js';

export function AdminIntegrationsView({ theme, density, lang }) {
  const { integrations, loading, set } = useIntegrations();
  // mark configured: set(companyId, kind, 'configured', config)
}
```

- [ ] Build + commit: `feat(admin): wire integrations view to use-integrations`

### Task 6.7: Wire Flags

**File:** `src/admin/views/flags.jsx`

```jsx
import { useFlags } from '../hooks/use-flags.js';

export function AdminFlagsView({ theme, density, lang }) {
  const { flags, loading, set } = useFlags();
  // toggle: set({ key, scope, target_id, enabled, payload })
}
```

- [ ] Build + commit: `feat(admin): wire flags view to use-flags`

### Task 6.8: Wire Audit

**File:** `src/admin/views/audit.jsx`

```jsx
import { useAudit } from '../hooks/use-audit.js';

export function AdminAuditView({ theme, density, lang }) {
  const { entries, loading } = useAudit();
  // chronological list of entries
}
```

- [ ] Build + commit: `feat(admin): wire audit view to use-audit`

### Task 6.9: Wire Roles

**File:** `src/admin/views/roles.jsx`

```jsx
import { useRoles } from '../hooks/use-roles.js';

export function AdminRolesView({ theme, density, lang }) {
  const { admins, loading, promote } = useRoles();
  // each admin row has a role select; on change: promote(userId, role, companyId)
}
```

- [ ] Build + commit: `feat(admin): wire roles view to use-roles`

### Task 6.10: Wire Localization

**File:** `src/admin/views/localization.jsx`

```jsx
import { useLocalization } from '../hooks/use-localization.js';

export function AdminLocalizationView({ theme, density, lang }) {
  const { strings, loading, save } = useLocalization();
  // edit a value: save(key, lang, value)
}
```

If the `localization_strings` table doesn't exist (the helper returns
[] for code 42P01), the view shows an empty state. That's acceptable
for v1 — the spec didn't require this table.

- [ ] Build + commit: `feat(admin): wire localization view to use-localization`

### Task 6.11: Wire Challenge Templates

**File:** `src/admin/views/challenge-templates.jsx`

```jsx
import { useChallengeTemplates } from '../hooks/use-challenge-templates.js';

export function AdminChallengeTemplatesView({ theme, density, lang }) {
  const { templates, loading, create } = useChallengeTemplates();
  // new-template form: create({ slug, title_en, title_ar, kind, default_window_days, target, metric })
}
```

- [ ] Build + commit: `feat(admin): wire challenge-templates view to use-challenge-templates`

---

## Phase 7 — Final verification

### Task 7.1: Run the spec verification suite

End-to-end manual run-through against the cloud project, all from
`http://localhost:5173/admin.html`:

- [ ] **Step 1: Production build clean**

```bash
npm run build
```

- [ ] **Step 2: All tests pass**

```bash
npm test
```

Expected: 14 employee + 17 HR + ~13 admin = ~44 tests across ~25 files.

- [ ] **Step 3: Walk the 14 spec verification steps**

Steps 1–14 from
[the spec verification section](../specs/2026-04-30-admin-console-design.md#verification):

1. **Access:** Sign in as `wellness_admin` → Overview. Sign in as
   `hr_admin` → "no access".
2. **Overview:** Platform KPIs render.
3. **Tenants:** Seeded `Wellhouse` and `Nile Group` listed. Click →
   Detail loads.
4. **Tenant create:** New form → tenant created with code; audit row
   exists.
5. **Roles:** Promote test user → audit row exists.
6. **Flags:** Toggle global flag → row in `feature_flags`; audit row.
7. **Billing:** Edit MRR → persists with audit row.
8. **Audit:** Audit view shows the rows from steps 4-7.
9. **Content:** Edit global content title → reflected for both
   tenants.
10. **Integrations:** Mark Slack configured for a tenant → row in
    `integrations`.
11. **Localization:** Add AR translation → persists.
12. **Challenge Templates:** Create template → HR Portal sees it.
13. **RLS check:** With `hr_admin` JWT, `SELECT * FROM audit_log`
    returns 0 rows.
14. **Build health:** `npm run build` clean; no console errors.

### Task 7.2: Capture follow-ups

**Files:**
- Create: `docs/superpowers/follow-ups/2026-04-30-admin-console-followups.md`

- [ ] **Step 1**: Note items found during verification
  - Whether `localization_strings` table is needed (current state: helper tolerates absence)
  - Impersonation status (off via missing secret — confirm)
  - Cron auth follow-up (carried from HR)
  - Any view that couldn't be cleanly wired

- [ ] **Step 2**: Commit

```bash
git add docs/superpowers/follow-ups/
git commit -m "docs: capture admin console follow-ups"
```

---

## Self-review

**1. Spec coverage:**
- Goal 1 (working Admin Console gated by `wellness_admin`) — Phases 0 + 4.3 + 6.
- Goal 2 (per-view module tree) — Phase 2.
- Goal 3 (cross-tenant reads + audited writes) — Phase 0.2 RPCs all
  audit before returning.
- Goal 4 (tenant provisioning end-to-end) — Task 0.2 `admin_create_tenant`,
  0.2 `admin_invite_company_admin`, Task 5.2 `useTenants.create`,
  Task 6.2 wires Tenants form.
- Goal 5 (visual parity) — Task 2.7 dev smoke.
- Backend additions: tables (0.1), RPCs (0.2), edge functions (0.3 +
  0.4), seed (0.5).
- Verification 1–14 — Task 7.1 step 3.
- Risks → privilege escalation: every RPC starts with the role check.
- Risks → audit completeness: every cross-tenant write calls
  `write_audit_log` before returning.
- Risks → impersonation: hard-gated by `IMPERSONATION_ENABLED=true`
  secret, off by default (Task 0.4 + verification).
- Risks → origin separation: noted in spec; left for deployment
  hardening.
- Risks → role refresh: documented in Task 0.5 step 3 (sign out + back
  in).

**2. Placeholder scan:** No "TBD"/"TODO" outside Open Questions. Phase 6
view tasks reference component identifiers that exist after Phase 2.

**3. Type/name consistency:**
- Admin helpers (`getPlatformOverview`, `listTenants`, `getTenant`,
  `createTenant`, `inviteCompanyAdmin`, `listInvoices`, `setBilling`,
  `listGlobalContent`, `updateContent`, `listIntegrations`,
  `setIntegration`, `listFlags`, `setFlag`, `listAudit`, `listAdmins`,
  `setRole`, `listStrings`, `setString`, `listChallengeTemplates`,
  `createChallengeTemplate`, `exportPlatformReport`) match across
  Phase 3 + Phase 5 mocks.
- Hook names (`usePlatformOverview`, `useTenants`, `useTenant`,
  `useBilling`, `useContent`, `useIntegrations`, `useFlags`, `useAudit`,
  `useRoles`, `useLocalization`, `useChallengeTemplates`) consistent
  Phase 5 + Phase 6.
- `AdminAuthProvider`/`useAdminAuth`/`AdminAppConfigProvider`/
  `useAdminAppConfig` consistent across Phase 4 + App.jsx.
- The shared move (Phase 1) updates HR imports — Phase 2 admin imports
  reference `'../shared/...'` paths.

No issues found.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-30-admin-console-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Same as Employee + HR; fresh
subagent per task, batched intelligently.

**2. Inline Execution** — Execute in this session with checkpoints.

**Which approach?**
