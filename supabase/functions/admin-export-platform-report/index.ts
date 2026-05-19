// admin-export-platform-report
//
// Generates a CSV report scoped to the platform (all tenants).
// kind: 'tenants' → company list with billing snapshot
// kind: 'usage'   → tenant usage rollup (active seats + check-in counts)
//
// Gated to wellness_admin (and the superadmin allowlist via
// requireAuth's role escalation). Returns a data: URL CSV so the
// browser can `<a download>` it without a storage bucket round-trip.

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(headers: string[], rows: Array<Record<string, unknown>>) {
  return [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((k) => csvEscape(row[k])).join(',')),
  ].join('\n');
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { user, role } = await requireAuth(req);

    // requireAuth maps superadmin emails to 'company_admin'. For platform
    // exports we additionally allow that to pass — it covers our own
    // operators while we keep the gate for everyone else.
    const allowed = role === 'wellness_admin' ||
      (await import('../_shared/superadmin.ts')).isSuperadminEmail(user.email);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { kind = 'tenants', range = '30d' } = await req.json() as { kind?: string; range?: string };
    const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : 30;

    // Use the service client to bypass per-row RLS — we've already gated
    // at the function entry.
    const service = createServiceClient();

    let rows: Array<Record<string, unknown>> = [];
    let headers: string[] = [];

    if (kind === 'tenants') {
      const { data, error } = await service
        .from('companies')
        .select('id, name, slug, plan, created_at, billing_state(plan, mrr_cents, seats, status)')
        .order('created_at', { ascending: true });
      if (error) throw error;
      rows = (data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        plan: c.billing_state?.plan ?? c.plan ?? '',
        seats: c.billing_state?.seats ?? 0,
        mrr_usd: ((c.billing_state?.mrr_cents ?? 0) / 100).toFixed(2),
        status: c.billing_state?.status ?? '',
        created_at: c.created_at,
      }));
      headers = ['id', 'name', 'slug', 'plan', 'seats', 'mrr_usd', 'status', 'created_at'];
    } else if (kind === 'usage') {
      // Active seats = profiles with onboarded=true, not deleted, grouped
      // by company. Combined with check-ins in the last `days`.
      const since = new Date(Date.now() - days * 86_400_000).toISOString();

      const { data: companies, error: e1 } = await service
        .from('companies').select('id, name');
      if (e1) throw e1;

      const out: Array<Record<string, unknown>> = [];
      for (const c of (companies ?? [])) {
        const { count: seats } = await service
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', c.id)
          .eq('onboarded', true)
          .is('deleted_at', null);
        const { count: checkins } = await service
          .from('checkins')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', c.id)
          .gte('checked_at', since);
        out.push({
          company_id: c.id,
          company_name: c.name,
          seats: seats ?? 0,
          checkins_window: checkins ?? 0,
          window_days: days,
        });
      }
      rows = out;
      headers = ['company_id', 'company_name', 'seats', 'checkins_window', 'window_days'];
    } else if (kind === 'audit') {
      const { data, error } = await service
        .from('audit_log')
        .select('occurred_at, actor_email, action, target, severity, details')
        .gte('occurred_at', new Date(Date.now() - days * 86_400_000).toISOString())
        .order('occurred_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      rows = (data ?? []).map((a: any) => ({
        occurred_at: a.occurred_at,
        actor: a.actor_email,
        action: a.action,
        target: a.target,
        severity: a.severity,
        details: JSON.stringify(a.details ?? {}),
      }));
      headers = ['occurred_at', 'actor', 'action', 'target', 'severity', 'details'];
    } else {
      return new Response(JSON.stringify({ error: 'unknown_kind' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = csv(headers, rows);
    const encoded = btoa(unescape(encodeURIComponent(body)));
    const path = `reports/platform/${kind}-${range}-${new Date().toISOString()}.csv`;

    // Record the export in the audit log so this admin action is visible.
    await service.from('audit_log').insert({
      actor_email: user.email,
      actor_id: user.id,
      action: 'report.exported',
      target: `${kind} (${range})`,
      severity: 'info',
      details: { kind, range, rows: rows.length },
    });

    return new Response(JSON.stringify({
      path,
      url: `data:text/csv;base64,${encoded}`,
      rows: rows.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
