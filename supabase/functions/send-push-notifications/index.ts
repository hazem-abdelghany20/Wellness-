import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

interface NotificationPayload {
  user_ids?: string[];
  company_id?: string;
  kind: 'checkin_reminder' | 'challenge_update' | 'insight' | 'streak' | 'system';
  title_en: string;
  title_ar?: string;
  body_en?: string;
  body_ar?: string;
  deep_link?: string;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Verify this is called from service_role (cron job or other function)
  const authHeader = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!authHeader.includes(serviceKey)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const payload = await req.json() as NotificationPayload;
    const supabase = createServiceClient();

    // Determine target user IDs
    let userIds: string[] = payload.user_ids ?? [];

    if (payload.company_id && userIds.length === 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', payload.company_id)
        .eq('onboarded', true)
        .is('deleted_at', null);

      userIds = (profiles ?? []).map(p => p.id);
    }

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert in-app notifications
    const notifications = userIds.map(uid => ({
      user_id: uid,
      company_id: payload.company_id ?? '',
      kind: payload.kind,
      title_en: payload.title_en,
      title_ar: payload.title_ar,
      body_en: payload.body_en,
      body_ar: payload.body_ar,
      deep_link: payload.deep_link,
      sent_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) throw error;

    // Fetch active push tokens
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .in('user_id', userIds)
      .eq('active', true);

    // Send to FCM/APNs (stub — replace with real provider)
    let pushed = 0;
    for (const token of tokens ?? []) {
      try {
        await sendPushToToken(token.token, token.platform, payload);
        pushed++;
      } catch {
        // Mark token inactive if delivery fails repeatedly
        await supabase
          .from('push_tokens')
          .update({ active: false })
          .eq('token', token.token);
      }
    }

    return new Response(
      JSON.stringify({ in_app: notifications.length, pushed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendPushToToken(
  token: string,
  platform: string,
  payload: NotificationPayload
): Promise<void> {
  const fcmKey = Deno.env.get('FCM_SERVER_KEY');
  if (!fcmKey) return;  // no-op if not configured

  if (platform === 'android' || platform === 'web') {
    await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${fcmKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title: payload.title_en,
          body: payload.body_en ?? '',
        },
        data: { deep_link: payload.deep_link ?? '' },
      }),
    });
  }
  // iOS APNs integration would go here
}
