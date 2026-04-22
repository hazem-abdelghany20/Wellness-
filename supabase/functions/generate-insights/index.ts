import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { user, companyId } = await requireAuth(req);
    const supabase = createServiceClient();
    const today = new Date().toISOString().split('T')[0];

    // Check if valid insights already exist
    const { data: existing } = await supabase
      .from('user_insights')
      .select('*')
      .eq('user_id', user.id)
      .gte('valid_until', today)
      .order('created_at', { ascending: false })
      .limit(5);

    if (existing && existing.length >= 3) {
      return new Response(
        JSON.stringify({ insights: existing }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch last 30 days of checkins
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: checkins } = await supabase
      .from('checkins')
      .select('checked_at, sleep, stress, energy, mood')
      .eq('user_id', user.id)
      .gte('checked_at', fromDate)
      .order('checked_at', { ascending: true });

    if (!checkins || checkins.length < 7) {
      return new Response(
        JSON.stringify({ insights: [], message: 'Not enough data yet' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const insights = computeInsights(checkins);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);
    const validUntilStr = validUntil.toISOString().split('T')[0];

    // Delete old insights and insert new
    await supabase.from('user_insights').delete().eq('user_id', user.id);

    if (insights.length > 0) {
      await supabase.from('user_insights').insert(
        insights.map(i => ({
          ...i,
          user_id: user.id,
          company_id: companyId,
          valid_until: validUntilStr,
        }))
      );
    }

    return new Response(
      JSON.stringify({ insights }),
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

interface Checkin {
  checked_at: string;
  sleep: number;
  stress: number;
  energy: number;
  mood: number;
}

function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function computeInsights(checkins: Checkin[]) {
  const insights = [];
  const recent = checkins.slice(-14);
  const older = checkins.slice(0, -14);

  if (older.length >= 7) {
    const sleepDelta = avg(recent.map(c => c.sleep)) - avg(older.map(c => c.sleep));
    if (Math.abs(sleepDelta) > 0.5) {
      insights.push({
        metric: 'sleep',
        icon: 'moon',
        tone: sleepDelta > 0 ? 'positive' : 'warning',
        title_en: sleepDelta > 0
          ? `Sleep improved ${sleepDelta.toFixed(1)} points`
          : `Sleep declined ${Math.abs(sleepDelta).toFixed(1)} points`,
        title_ar: sleepDelta > 0
          ? `النوم تحسَّن ${sleepDelta.toFixed(1)} نقطة`
          : `النوم تراجع ${Math.abs(sleepDelta).toFixed(1)} نقطة`,
        body_en: sleepDelta > 0
          ? 'Your sleep trend has been improving over the past two weeks.'
          : 'Your sleep scores have been declining. Consider your evening routine.',
        body_ar: sleepDelta > 0
          ? 'اتجاه نومك تحسَّن خلال الأسبوعين الماضيين.'
          : 'درجات نومك تتراجع. راجع روتين مساءك.',
      });
    }

    const stressDelta = avg(recent.map(c => c.stress)) - avg(older.map(c => c.stress));
    if (Math.abs(stressDelta) > 0.5) {
      insights.push({
        metric: 'stress',
        icon: 'leaf',
        tone: stressDelta < 0 ? 'positive' : 'warning',
        title_en: stressDelta < 0
          ? `Stress down ${Math.abs(stressDelta).toFixed(1)} points`
          : `Stress up ${stressDelta.toFixed(1)} points`,
        title_ar: stressDelta < 0
          ? `التوتر انخفض ${Math.abs(stressDelta).toFixed(1)} نقطة`
          : `التوتر ارتفع ${stressDelta.toFixed(1)} نقطة`,
        body_en: stressDelta < 0
          ? 'Great progress on stress management this fortnight.'
          : 'Stress levels have been rising. Try the breathing exercises.',
        body_ar: stressDelta < 0
          ? 'تقدم رائع في إدارة التوتر هذا الأسبوعين.'
          : 'مستويات التوتر ترتفع. جرّب تمارين التنفس.',
      });
    }
  }

  // Day-of-week pattern
  const byDay: Record<number, number[]> = {};
  for (const c of checkins) {
    const dow = new Date(c.checked_at).getDay();
    byDay[dow] = byDay[dow] ?? [];
    byDay[dow].push(c.stress);
  }
  const dayAvgs = Object.entries(byDay)
    .filter(([, vals]) => vals.length >= 2)
    .map(([day, vals]) => ({ day: Number(day), avg: avg(vals) }));

  if (dayAvgs.length >= 5) {
    const lowest = dayAvgs.sort((a, b) => a.avg - b.avg)[0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNamesAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    insights.push({
      metric: 'stress',
      icon: 'leaf',
      tone: 'info',
      title_en: `Stress lowest on ${dayNames[lowest.day]}s`,
      title_ar: `أقل توتر يوم ${dayNamesAr[lowest.day]}`,
      body_en: `Your stress scores are consistently lowest on ${dayNames[lowest.day]}s. Notice what's different.`,
      body_ar: `درجات التوتر لديك أقل باستمرار يوم ${dayNamesAr[lowest.day]}. لاحظ ما الذي يختلف.`,
    });
  }

  // Streak insight
  if (checkins.length >= 14) {
    insights.push({
      metric: 'overall',
      icon: 'activity',
      tone: 'neutral',
      title_en: `${checkins.length} check-ins in ${checkins.length} days`,
      title_ar: `${checkins.length} تسجيلاً في ${checkins.length} يوماً`,
      body_en: "Your habit is stabilizing. Try adding a note this week.",
      body_ar: 'عادتك تستقر. جرّب إضافة ملاحظة هذا الأسبوع.',
    });
  }

  return insights.slice(0, 4);
}
