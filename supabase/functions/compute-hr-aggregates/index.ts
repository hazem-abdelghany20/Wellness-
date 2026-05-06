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

    // Belt-and-suspenders 5+ floor verification — re-read the rows we
    // just wrote and confirm every group_size is >= 5. The DB CHECK
    // constraint already prevents sub-5 writes; this guards against any
    // future code path that attempts a direct upsert.
    const { data: written } = await supabase
      .from('hr_weekly_aggregates')
      .select('group_size, week_start, team_id')
      .eq('company_id', companyId)
      .in('week_start', weeks);

    const violations = (written ?? []).filter((r: { group_size: number }) => r.group_size < 5);
    if (violations.length > 0) {
      console.error('[compute-hr-aggregates] privacy floor violation', violations);
    }

    return new Response(
      JSON.stringify({
        computed,
        privacy: {
          group_floor: 5,
          dp_epsilon: 2,
          dp_metrics: ['avg_sleep', 'avg_stress', 'avg_energy', 'avg_mood', 'checkin_rate'],
          violations: violations.length,
        },
      }),
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
