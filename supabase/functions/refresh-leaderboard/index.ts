import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { challenge_id } = await req.json() as { challenge_id: string };

    if (!challenge_id) {
      return new Response(
        JSON.stringify({ error: 'challenge_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createServiceClient();

    // Fetch challenge info
    const { data: challenge } = await supabase
      .from('challenges')
      .select('id, company_id, metric, start_date, end_date, active')
      .eq('id', challenge_id)
      .single();

    if (!challenge?.active) {
      return new Response(
        JSON.stringify({ error: 'Challenge not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all participants with their scores
    const { data: participants } = await supabase
      .from('challenge_participants')
      .select('user_id, score')
      .eq('challenge_id', challenge_id)
      .order('score', { ascending: false });

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch profiles for avatar/initials (display_name kept private)
    const userIds = participants.map(p => p.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, avatar_kind, initials')
      .in('id', userIds);

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    // Build anonymized leaderboard rows
    const rows = participants.map((p, idx) => {
      const profile = profileMap[p.user_id] ?? {};
      return {
        challenge_id,
        company_id: challenge.company_id,
        rank: idx + 1,
        display_name: `Anonymous #${idx + 1}`,  // de-identified; client replaces "You" based on user_id match
        avatar_kind: profile.avatar_kind ?? 'monogram',
        initials: profile.initials ?? '?',
        score: p.score,
        is_self: false,  // client-side flag, never stored as true
        updated_at: new Date().toISOString(),
      };
    });

    // Replace entire leaderboard atomically
    await supabase
      .from('challenge_leaderboard_cache')
      .delete()
      .eq('challenge_id', challenge_id);

    const { error } = await supabase
      .from('challenge_leaderboard_cache')
      .insert(rows);

    if (error) throw error;

    return new Response(
      JSON.stringify({ updated: rows.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
