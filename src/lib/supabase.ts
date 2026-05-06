import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Wellness+] Supabase env vars missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local'
  );
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// ── Auth helpers ──────────────────────────────────────────────

export async function signInWithOtp(email: string) {
  return supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
}

export async function verifyOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: 'email' });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export function onAuthStateChange(cb: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
  return supabase.auth.onAuthStateChange(cb);
}

// ── Company code validation ───────────────────────────────────

export async function verifyCompanyCode(code: string, email: string) {
  const { data, error } = await supabase.functions.invoke('verify-company-code', {
    body: { code, email },
  });
  if (error) throw error;
  return data as { valid: boolean; company?: { id: string; name: string; slug: string }; error?: string };
}

// ── Profile ───────────────────────────────────────────────────

export async function getMyProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function getMyCompany() {
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = user?.app_metadata?.company_id as string | undefined;
  if (!companyId) return null;
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, slug, settings')
    .eq('id', companyId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Check-ins ─────────────────────────────────────────────────

export async function submitCheckin(payload: {
  sleep: number;
  stress: number;
  energy: number;
  mood: number;
  note?: string;
  variant?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const companyId = user.app_metadata?.company_id as string;
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('checkins')
    .upsert({
      user_id: user.id,
      company_id: companyId,
      checked_at: today,
      ...payload,
    }, { onConflict: 'user_id,checked_at' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getCheckinHistory(days = 30) {
  const { data, error } = await supabase.rpc('get_my_checkin_history', { p_days: days });
  if (error) throw error;
  return data ?? [];
}

export async function getProgressStats() {
  const { data, error } = await supabase.rpc('get_my_progress_stats');
  if (error) throw error;
  return data;
}

// ── Daily plan ────────────────────────────────────────────────

export async function getTodayPlan() {
  const { data, error } = await supabase.functions.invoke('generate-daily-plan', {
    method: 'POST',
    body: {},
  });
  if (error) throw error;
  return data?.plan ?? null;
}

export async function completeAction(planId: string, actionId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('daily_plan_completions')
    .upsert({
      plan_id: planId,
      user_id: user.id,
      company_id: user.app_metadata?.company_id,
      action_id: actionId,
    }, { onConflict: 'plan_id,action_id', ignoreDuplicates: true })
    .select()
    .single();

  if (error && error.code !== '23505') throw error;
  return data;
}

// ── Content ───────────────────────────────────────────────────

export async function getContentItems(category?: string) {
  let query = supabase
    .from('content_items')
    .select('*')
    .eq('published', true)
    .order('sort_order');

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getFeaturedContent() {
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('published', true)
    .eq('featured', true)
    .order('sort_order')
    .limit(3);
  if (error) throw error;
  return data ?? [];
}

export async function saveContentProgress(itemId: string, progressS: number, completed = false) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('content_progress')
    .upsert({
      user_id: user.id,
      item_id: itemId,
      company_id: user.app_metadata?.company_id,
      progress_s: progressS,
      completed,
      finished_at: completed ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,item_id' });

  if (error) throw error;
}

// ── Challenges ────────────────────────────────────────────────

export async function getActiveChallenges() {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('active', true)
    .lte('start_date', new Date().toISOString().split('T')[0])
    .gte('end_date', new Date().toISOString().split('T')[0])
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function joinChallenge(challengeId: string) {
  const { data, error } = await supabase.functions.invoke('update-challenge-activity', {
    body: { challenge_id: challengeId, action: 'join' },
  });
  if (error) throw error;
  return data;
}

export async function getLeaderboard(challengeId: string) {
  const { data, error } = await supabase
    .from('challenge_leaderboard_cache')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('rank');
  if (error) throw error;
  return data ?? [];
}

// ── Notifications ─────────────────────────────────────────────

export async function getNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('read', false);
  if (error) throw error;
}

// ── Insights ──────────────────────────────────────────────────

export async function getInsights() {
  const { data, error } = await supabase.functions.invoke('generate-insights', {
    method: 'POST',
    body: {},
  });
  if (error) throw error;
  return data?.insights ?? [];
}

// ── Realtime subscriptions ────────────────────────────────────

export function subscribeToLeaderboard(challengeId: string, cb: (payload: unknown) => void) {
  return supabase
    .channel(`leaderboard:${challengeId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'challenge_leaderboard_cache',
      filter: `challenge_id=eq.${challengeId}`,
    }, cb)
    .subscribe();
}

export function subscribeToNotifications(userId: string, cb: (payload: unknown) => void) {
  return supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, cb)
    .subscribe();
}

export function subscribeToPlanCompletions(planId: string, cb: (payload: unknown) => void) {
  return supabase
    .channel(`plan:${planId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'daily_plan_completions',
      filter: `plan_id=eq.${planId}`,
    }, cb)
    .subscribe();
}

// ── Wallet (v2 Sprint 0 — read-only Mine-tab hero) ────────────

export type AwardedRewardStatus = 'ready' | 'claimed' | 'fulfilled';

export interface AwardedReward {
  id: string;
  profile_id: string;
  company_id: string;
  competition_id: string | null;
  tier: 'bronze' | 'silver' | 'gold';
  chosen_item_id: string | null;
  status: AwardedRewardStatus;
  fulfillment_method: 'manual' | 'tremendous';
  notes: string | null;
  awarded_at: string;
  claimed_at: string | null;
  fulfilled_at: string | null;
  // Joined catalog fields (optional — present when select includes the join).
  chosen_item?: {
    id: string;
    name_en: string;
    name_ar: string | null;
    category: 'wh_service' | 'amazon' | 'custom';
    value_minor: number;
    currency: string;
    thumbnail_url: string | null;
  } | null;
}

export async function listMyAwardedRewards(): Promise<AwardedReward[]> {
  const { data, error } = await supabase
    .from('awarded_rewards')
    .select(`
      id, profile_id, company_id, competition_id, tier, chosen_item_id,
      status, fulfillment_method, notes,
      awarded_at, claimed_at, fulfilled_at,
      chosen_item:gift_catalog_items (
        id, name_en, name_ar, category, value_minor, currency, thumbnail_url
      )
    `)
    .order('awarded_at', { ascending: false });
  if (error) {
    // Pre-migration project: table missing returns 42P01. Treat as empty.
    if ((error as { code?: string }).code === '42P01') return [];
    throw error;
  }
  return (data ?? []) as unknown as AwardedReward[];
}

export interface TierChoiceOption {
  id: string;
  name_en: string;
  name_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  value_minor: number;
  currency: string;
  thumbnail_url: string | null;
}

export interface TierChoice {
  allow_choice: boolean;
  fixed_item: TierChoiceOption | null;
  options: TierChoiceOption[];
}

export async function getTierChoiceForReward(
  competitionId: string,
  tier: 'bronze' | 'silver' | 'gold'
): Promise<TierChoice | null> {
  const { data: cfg, error: cfgErr } = await supabase
    .from('tier_configurations')
    .select('allow_employee_choice, gift_catalog_item_id, choice_options')
    .eq('competition_id', competitionId)
    .eq('tier', tier)
    .maybeSingle();
  if (cfgErr) {
    if ((cfgErr as { code?: string }).code === '42P01') return null;
    throw cfgErr;
  }
  if (!cfg) return null;

  const ids: string[] = cfg.allow_employee_choice
    ? (cfg.choice_options as string[] || [])
    : (cfg.gift_catalog_item_id ? [cfg.gift_catalog_item_id as string] : []);
  if (ids.length === 0) {
    return { allow_choice: !!cfg.allow_employee_choice, fixed_item: null, options: [] };
  }
  const { data: items, error: itemsErr } = await supabase
    .from('gift_catalog_items')
    .select('id, name_en, name_ar, description_en, description_ar, value_minor, currency, thumbnail_url')
    .in('id', ids)
    .eq('active', true);
  if (itemsErr) throw itemsErr;
  const opts = (items ?? []) as TierChoiceOption[];
  return {
    allow_choice: !!cfg.allow_employee_choice,
    fixed_item: cfg.allow_employee_choice ? null : (opts[0] ?? null),
    options: opts,
  };
}

export async function claimMyReward(
  rewardId: string,
  chosenItemId?: string
): Promise<AwardedReward> {
  const { data, error } = await supabase.rpc('claim_my_reward', {
    p_reward_id: rewardId,
    p_chosen_item: chosenItemId ?? null,
  });
  if (error) throw error;
  return data as AwardedReward;
}

// ── Signature competitions (Sabr / Niyyah / Ramadan Mode — v2 Sprint 3)

export interface SignatureChallenge {
  id: string;
  title_en: string;
  title_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  theme: string | null;
  cultural_context: string | null;
  duration_days: number | null;
  badge_color: string | null;
  badge_icon: string | null;
  start_date: string;
  end_date: string;
  active: boolean;
}

export interface PracticeDay {
  id: string;
  challenge_id: string;
  day_number: number;
  title_en: string;
  title_ar: string | null;
  body_en: string;
  body_ar: string | null;
  prompt_en: string | null;
  prompt_ar: string | null;
}

export interface PracticeCompletion {
  challenge_id: string;
  day_number: number;
  completed_at: string;
  reflection: string | null;
}

export async function listSignatureChallenges(): Promise<SignatureChallenge[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('id, title_en, title_ar, description_en, description_ar, theme, cultural_context, duration_days, badge_color, badge_icon, start_date, end_date, active')
    .not('theme', 'is', null)
    .eq('active', true)
    .order('start_date', { ascending: false });
  if (error) {
    if ((error as { code?: string }).code === '42P01') return [];
    if ((error as { code?: string }).code === '42703') return []; // theme column missing
    throw error;
  }
  return (data ?? []) as SignatureChallenge[];
}

export async function getCompetitionPath(challengeId: string): Promise<{
  challenge: SignatureChallenge | null;
  days: PracticeDay[];
  completions: PracticeCompletion[];
}> {
  const [chRes, daysRes, compRes] = await Promise.all([
    supabase
      .from('challenges')
      .select('id, title_en, title_ar, description_en, description_ar, theme, cultural_context, duration_days, badge_color, badge_icon, start_date, end_date, active')
      .eq('id', challengeId)
      .maybeSingle(),
    supabase
      .from('competition_practice_days')
      .select('*')
      .eq('challenge_id', challengeId)
      .order('day_number'),
    supabase
      .from('practice_completions')
      .select('challenge_id, day_number, completed_at, reflection')
      .eq('challenge_id', challengeId)
      .order('day_number'),
  ]);

  const swallow = (e: unknown) => {
    const code = (e as { code?: string })?.code;
    return code === '42P01' || code === '42703';
  };
  if (chRes.error && !swallow(chRes.error)) throw chRes.error;
  if (daysRes.error && !swallow(daysRes.error)) throw daysRes.error;
  if (compRes.error && !swallow(compRes.error)) throw compRes.error;

  return {
    challenge: (chRes.data ?? null) as SignatureChallenge | null,
    days: (daysRes.data ?? []) as PracticeDay[],
    completions: (compRes.data ?? []) as PracticeCompletion[],
  };
}

export async function completePracticeDay(
  challengeId: string,
  dayNumber: number,
  reflection?: string
): Promise<PracticeCompletion> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');
  const { data, error } = await supabase
    .from('practice_completions')
    .upsert({
      challenge_id: challengeId,
      user_id: user.id,
      day_number: dayNumber,
      reflection: reflection || null,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'challenge_id,user_id,day_number' })
    .select()
    .single();
  if (error) throw error;
  return data as PracticeCompletion;
}
