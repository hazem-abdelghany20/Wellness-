import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { companyId, role } = await requireAuth(req);
    if (!companyId) {
      return new Response(JSON.stringify({ error: 'User has no company' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!['hr_admin', 'company_admin'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json() as {
      title_en?: string; title_ar?: string;
      description_en?: string; description_ar?: string;
      metric?: string;
      goal_value?: number;
      start_date?: string;
      end_date?: string;
      badge_icon?: string; badge_color?: string;
    };

    if (!payload.title_en || !payload.metric || !payload.start_date || !payload.end_date) {
      return new Response(
        JSON.stringify({ error: 'title_en, metric, start_date, end_date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('challenges')
      .insert({
        company_id: companyId,
        title_en: payload.title_en,
        title_ar: payload.title_ar ?? payload.title_en,
        description_en: payload.description_en ?? null,
        description_ar: payload.description_ar ?? null,
        metric: payload.metric,
        goal_value: payload.goal_value ?? 7,
        start_date: payload.start_date,
        end_date: payload.end_date,
        badge_icon: payload.badge_icon ?? 'trophy',
        badge_color: payload.badge_color ?? '#F5B544',
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ challenge: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
