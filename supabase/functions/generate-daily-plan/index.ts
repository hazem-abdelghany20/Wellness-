import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

interface PlanAction {
  id: string;
  type: 'content' | 'checkin' | 'breathe' | 'challenge';
  title_en: string;
  title_ar: string;
  content_id?: string;
  duration_mins: number;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { user, companyId } = await requireAuth(req);
    const supabase = createServiceClient();
    const today = new Date().toISOString().split('T')[0];

    // Return existing plan if already generated today
    const { data: existing } = await supabase
      .from('daily_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('plan_date', today)
      .maybeSingle();

    if (existing?.generated) {
      return new Response(
        JSON.stringify({ plan: existing }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user profile for personalization
    const { data: profile } = await supabase
      .from('profiles')
      .select('baseline_sleep, baseline_stress, baseline_energy, baseline_mood, goals, streak_current')
      .eq('id', user.id)
      .single();

    // Fetch featured content
    const { data: contentItems } = await supabase
      .from('content_items')
      .select('id, slug, kind, title_en, title_ar, duration_mins, category')
      .eq('published', true)
      .order('sort_order')
      .limit(20);

    // Build personalized actions
    const actions: PlanAction[] = [];
    const goals = profile?.goals ?? [];

    // Always include daily check-in
    actions.push({
      id: 'daily-checkin',
      type: 'checkin',
      title_en: 'Daily check-in',
      title_ar: 'التسجيل اليومي',
      duration_mins: 1,
    });

    // Add breathing if stress is high baseline
    if ((profile?.baseline_stress ?? 5) >= 6) {
      actions.push({
        id: 'box-breath',
        type: 'breathe',
        title_en: 'Box breathing, 4 minutes',
        title_ar: 'تنفس مربع، 4 دقائق',
        duration_mins: 4,
      });
    }

    // Add content based on goals
    const goalCategoryMap: Record<string, string> = {
      sleep: 'sleep',
      stress: 'stress',
      energy: 'energy',
      movement: 'movement',
      mindfulness: 'mindfulness',
    };

    for (const goal of goals.slice(0, 2)) {
      const category = goalCategoryMap[goal];
      if (!category || !contentItems) continue;
      const item = contentItems.find(c => c.category === category);
      if (item) {
        actions.push({
          id: `content-${item.id}`,
          type: 'content',
          title_en: item.title_en,
          title_ar: item.title_ar ?? item.title_en,
          content_id: item.id,
          duration_mins: item.duration_mins ?? 5,
        });
      }
    }

    // Fallback: add a featured item if actions < 3
    if (actions.length < 3 && contentItems?.length) {
      const featured = contentItems.find(c => !actions.some(a => a.content_id === c.id));
      if (featured) {
        actions.push({
          id: `content-${featured.id}`,
          type: 'content',
          title_en: featured.title_en,
          title_ar: featured.title_ar ?? featured.title_en,
          content_id: featured.id,
          duration_mins: featured.duration_mins ?? 5,
        });
      }
    }

    const { data: plan, error } = await supabase
      .from('daily_plans')
      .upsert({
        user_id: user.id,
        company_id: companyId,
        plan_date: today,
        actions,
        generated: true,
      }, { onConflict: 'user_id,plan_date' })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ plan }),
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
