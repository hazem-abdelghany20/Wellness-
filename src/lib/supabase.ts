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
