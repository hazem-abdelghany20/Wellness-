import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { user, companyId, role } = await requireAuth(req);
    if (!companyId || !['hr_admin', 'company_admin'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json() as {
      title_en?: string;
      title_ar?: string;
      body_en?: string;
      body_ar?: string;
      scope?: 'all' | 'team';
      team_id?: string;
      scheduled_at?: string;
    };

    if (!payload.title_en || !payload.body_en || !payload.scheduled_at) {
      return new Response(JSON.stringify({ error: 'title_en, body_en and scheduled_at are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createServiceClient();
    const { data: broadcast, error } = await supabase
      .from('broadcasts')
      .insert({
        company_id: companyId,
        title_en: payload.title_en,
        title_ar: payload.title_ar ?? null,
        body_en: payload.body_en,
        body_ar: payload.body_ar ?? null,
        scope: payload.scope ?? 'all',
        team_id: payload.scope === 'team' ? payload.team_id ?? null : null,
        scheduled_at: payload.scheduled_at,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    const recipientQuery = supabase
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
      .is('deleted_at', null);

    if (payload.scope === 'team' && payload.team_id) {
      recipientQuery.eq('team_id', payload.team_id);
    }

    const { data: recipients, error: recipientsError } = await recipientQuery;
    if (recipientsError) throw recipientsError;

    if (recipients?.length) {
      const notifications = recipients.map((p) => ({
        user_id: p.id,
        company_id: companyId,
        kind: 'system',
        title_en: payload.title_en,
        title_ar: payload.title_ar ?? null,
        body_en: payload.body_en,
        body_ar: payload.body_ar ?? null,
        deep_link: 'notifications',
        sent_at: new Date().toISOString(),
      }));
      const { error: notifyError } = await supabase.from('notifications').insert(notifications);
      if (notifyError) throw notifyError;
    }

    return new Response(JSON.stringify({ broadcast }), {
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
