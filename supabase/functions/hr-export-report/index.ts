import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';

function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { companyId, role, supabase } = await requireAuth(req);
    if (!companyId || !['hr_admin', 'company_admin'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { kind = 'overview', range = '30d' } = await req.json() as { kind?: string; range?: string };
    const { data, error } = await supabase.rpc('hr_company_overview', { p_range: range });
    if (error) throw error;

    const rows = kind === 'teams'
      ? (await supabase.from('hr_team_overview').select('*').eq('company_id', companyId)).data ?? []
      : [
          { metric: 'avg_mood', value: data?.kpis?.avg_mood },
          { metric: 'avg_stress', value: data?.kpis?.avg_stress },
          { metric: 'avg_sleep', value: data?.kpis?.avg_sleep },
          { metric: 'avg_energy', value: data?.kpis?.avg_energy },
          { metric: 'participation', value: data?.kpis?.participation },
        ];

    const headers = rows[0] ? Object.keys(rows[0]) : ['metric', 'value'];
    const csv = [
      headers.map(csvEscape).join(','),
      ...rows.map((row) => headers.map((key) => csvEscape((row as Record<string, unknown>)[key])).join(',')),
    ].join('\n');
    const encoded = btoa(unescape(encodeURIComponent(csv)));
    const path = `reports/${companyId}/${kind}-${range}-${new Date().toISOString()}.csv`;

    return new Response(JSON.stringify({
      path,
      url: `data:text/csv;base64,${encoded}`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : (
      typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message?: unknown }).message)
        : JSON.stringify(err)
    );
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
