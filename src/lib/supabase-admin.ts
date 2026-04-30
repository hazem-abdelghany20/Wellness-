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
