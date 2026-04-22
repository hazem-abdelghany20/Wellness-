import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { user, companyId } = await requireAuth(req);
    const { challenge_id, action } = await req.json() as {
      challenge_id: string;
      action: 'join' | 'score_update';
    };

    if (!challenge_id) {
      return new Response(
        JSON.stringify({ error: 'challenge_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createServiceClient();

    // Verify challenge exists and is active
    const { data: challenge } = await supabase
      .from('challenges')
      .select('id, company_id, metric, start_date, end_date, active, participant_cap')
      .eq('id', challenge_id)
      .single();

    if (!challenge?.active) {
      return new Response(
        JSON.stringify({ error: 'Challenge not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'join') {
      // Check cap
      if (challenge.participant_cap) {
        const { count } = await supabase
          .from('challenge_participants')
          .select('id', { count: 'exact', head: true })
          .eq('challenge_id', challenge_id);

        if ((count ?? 0) >= challenge.participant_cap) {
          return new Response(
            JSON.stringify({ error: 'Challenge is full' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const { error } = await supabase
        .from('challenge_participants')
        .upsert({
          challenge_id,
          user_id: user.id,
          company_id: companyId,
          score: 0,
        }, { onConflict: 'challenge_id,user_id', ignoreDuplicates: true });

      if (error) throw error;
    }

    if (action === 'score_update') {
      // Recompute score from checkins since challenge start
      const { data: checkins } = await supabase
        .from('checkins')
        .select(challenge.metric)
        .eq('user_id', user.id)
        .gte('checked_at', challenge.start_date)
        .lte('checked_at', challenge.end_date);

      if (checkins && checkins.length > 0) {
        const values = checkins.map(c => c[challenge.metric as keyof typeof c] as number);
        const score = values.reduce((a, b) => a + b, 0) / values.length;

        await supabase
          .from('challenge_participants')
          .update({ score: Math.round(score * 10) / 10 })
          .eq('challenge_id', challenge_id)
          .eq('user_id', user.id);
      }
    }

    // Trigger leaderboard refresh (fire-and-forget)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    fetch(`${supabaseUrl}/functions/v1/refresh-leaderboard`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challenge_id }),
    }).catch(() => {});

    return new Response(
      JSON.stringify({ ok: true }),
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
