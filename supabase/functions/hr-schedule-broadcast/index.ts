// Kept for older app builds. Since sprint 3 a broadcast is only stored here;
// the per-minute job delivers it at scheduled_at (quiet hours respected).
// All logic lives in the SQL RPC hr_save_broadcast (called as the HR user,
// so RLS / role checks apply); new code calls that RPC directly
// (src/lib/supabase-broadcasts.ts).
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';

const reply = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase, companyId, role } = await requireAuth(req);
    if (!companyId || !['hr_admin', 'company_admin'].includes(role)) {
      return reply({ error: 'Forbidden' }, 403);
    }

    const payload = await req.json() as Record<string, unknown>;
    if (!payload?.title_en || (!payload.body_en && !payload.media_path) || !payload.scheduled_at) {
      return reply({ error: 'title_en, body_en and scheduled_at are required' }, 400);
    }

    const { data, error } = await supabase.rpc('hr_save_broadcast', {
      p_input: {
        title_en: payload.title_en,
        title_ar: payload.title_ar ?? null,
        body_en: payload.body_en ?? null,
        body_ar: payload.body_ar ?? null,
        scope: payload.scope ?? 'all',
        team_id: payload.scope === 'team' ? payload.team_id ?? null : null,
        scheduled_at: payload.scheduled_at,
        ...(payload.media_path ? {
          media_path: payload.media_path, media_mime: payload.media_mime ?? null,
          media_duration_s: payload.media_duration_s ?? null,
        } : {}),
      },
    });
    if (error) {
      const status = error.code === '42501' ? 403 : error.code === '22023' || error.code === 'P0002' ? 400 : 500;
      return reply({ error: error.message }, status);
    }
    return reply({ broadcast: data }, 200);
  } catch (err) {
    if (err instanceof Response) return err;
    return reply({ error: String(err) }, 500);
  }
});
