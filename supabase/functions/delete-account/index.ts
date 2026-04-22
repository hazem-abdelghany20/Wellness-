import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { user } = await requireAuth(req);
    const supabase = createServiceClient();

    // Cascade-delete all user data in correct order to satisfy FK constraints
    // Most tables have ON DELETE CASCADE from profiles, but we do explicit cleanup
    // for audit trail and storage objects.

    // 1. Delete push tokens
    await supabase.from('push_tokens').delete().eq('user_id', user.id);

    // 2. Delete notifications
    await supabase.from('notifications').delete().eq('user_id', user.id);

    // 3. Delete challenge participation
    await supabase.from('challenge_participants').delete().eq('user_id', user.id);

    // 4. Delete daily plan completions
    await supabase.from('daily_plan_completions').delete().eq('user_id', user.id);

    // 5. Delete daily plans
    await supabase.from('daily_plans').delete().eq('user_id', user.id);

    // 6. Delete content progress
    await supabase.from('content_progress').delete().eq('user_id', user.id);

    // 7. Delete insights
    await supabase.from('user_insights').delete().eq('user_id', user.id);

    // 8. Delete checkins
    await supabase.from('checkins').delete().eq('user_id', user.id);

    // 9. Soft-delete profile first (for audit), then hard delete
    await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString(), display_name: 'Deleted User', initials: '?' })
      .eq('id', user.id);

    // 10. Delete storage objects for this user (avatars, uploads)
    const { data: objects } = await supabase.storage
      .from('company-assets')
      .list(`avatars/${user.id}`);

    if (objects && objects.length > 0) {
      await supabase.storage
        .from('company-assets')
        .remove(objects.map(o => `avatars/${user.id}/${o.name}`));
    }

    // 11. Hard delete profile (triggers CASCADE to remaining tables)
    await supabase.from('profiles').delete().eq('id', user.id);

    // 12. Delete auth user — point of no return
    const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
    if (authError) throw authError;

    return new Response(
      JSON.stringify({ deleted: true }),
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
