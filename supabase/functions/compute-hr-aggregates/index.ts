import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { role, companyId } = await requireAuth(req);

    if (!['hr_admin', 'company_admin'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createServiceClient();

    // Compute for the last 4 complete weeks
    const weeks: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (d.getDay() + 7 * i));
      weeks.push(d.toISOString().split('T')[0]);
    }

    // Get all teams for this company
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('company_id', companyId);

    let computed = 0;
    for (const weekStart of weeks) {
      // Company-wide aggregate
      const { error: e1 } = await supabase.rpc('compute_hr_aggregate', {
        p_company_id: companyId,
        p_team_id: null,
        p_week_start: weekStart,
      });
      if (!e1) computed++;

      // Per-team aggregates
      for (const team of teams ?? []) {
        const { error: e2 } = await supabase.rpc('compute_hr_aggregate', {
          p_company_id: companyId,
          p_team_id: team.id,
          p_week_start: weekStart,
        });
        if (!e2) computed++;
      }
    }

    return new Response(
      JSON.stringify({ computed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    if (err instanceof Response) return err;
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
