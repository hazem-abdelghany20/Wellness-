import { supabase } from './supabase';

// ── Overview ───────────────────────────────────────────────────

export async function getCompanyOverview(range: '7d' | '30d' | '90d' = '30d') {
  const { data, error } = await supabase.rpc('hr_company_overview', { p_range: range });
  if (error) throw error;
  return data as {
    range: string;
    kpis: Record<string, number>;
    trend: Array<{ week_start: string; avg_mood: number; avg_stress: number }>;
  };
}

// ── Teams ──────────────────────────────────────────────────────

export async function getTeamAggregates() {
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = user?.app_metadata?.company_id as string | undefined;
  if (!companyId) throw new Error('not_in_company');

  const { data, error } = await supabase
    .from('hr_team_overview')
    .select('*')
    .eq('company_id', companyId)
    .order('week_start', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTeamDrilldown(teamId: string, range: '7d' | '30d' | '90d' = '30d') {
  const { data, error } = await supabase.rpc('hr_team_drilldown', { p_team_id: teamId, p_range: range });
  if (error) throw error;
  return data as { team_id: string; range: string; rows: any[] };
}

// ── People ─────────────────────────────────────────────────────

export async function getRoster() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_kind, role, team_id, teams(name, department)')
    .order('display_name');
  if (error) throw error;
  return data ?? [];
}

// ── Content ────────────────────────────────────────────────────

export async function getContentLibrary() {
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('published', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function assignContent(contentId: string, scope: 'all' | 'team', teamId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = user?.app_metadata?.company_id as string | undefined;
  if (!companyId) throw new Error('not_in_company');

  const { data, error } = await supabase.from('content_assignments').insert({
    company_id: companyId,
    content_id: contentId,
    scope,
    team_id: scope === 'team' ? teamId : null,
    assigned_by: user!.id,
  }).select().single();
  if (error) throw error;
  return data;
}

// ── Challenges ─────────────────────────────────────────────────

export async function listChallengeTemplates() {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function scheduleChallenge(template: any, window: { start: string; end: string }, scope: 'all' | 'team', teamId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = user?.app_metadata?.company_id as string | undefined;
  if (!companyId) throw new Error('not_in_company');

  const { data, error } = await supabase.from('challenges').insert({
    company_id: companyId,
    title:        template.title,
    description:  template.description,
    kind:         template.kind ?? 'team',
    metric:       template.metric ?? 'checkins',
    target:       template.target ?? 10,
    start_date:   window.start,
    end_date:     window.end,
    active:       true,
    scope:        scope,
    team_id:      scope === 'team' ? teamId : null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function getChallengeStatus(challengeId: string) {
  const { data, error } = await supabase
    .from('challenges')
    .select('*, challenge_leaderboard_cache(*)')
    .eq('id', challengeId)
    .single();
  if (error) throw error;
  return data;
}

// ── Broadcasts ─────────────────────────────────────────────────

export async function listBroadcasts() {
  const { data, error } = await supabase
    .from('broadcasts')
    .select('*')
    .order('scheduled_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function scheduleBroadcast(payload: {
  title_en: string; title_ar?: string;
  body_en:  string; body_ar?:  string;
  scope: 'all' | 'team'; team_id?: string;
  scheduled_at: string;
}) {
  const { data, error } = await supabase.functions.invoke('hr-schedule-broadcast', { body: payload });
  if (error) throw error;
  return (data as any).broadcast;
}

export async function cancelBroadcast(id: string) {
  const { error } = await supabase
    .from('broadcasts')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (error) throw error;
}

// ── Reports ────────────────────────────────────────────────────

export async function requestReportExport(kind: 'overview' | 'teams', range: '7d' | '30d' | '90d') {
  const { data, error } = await supabase.functions.invoke('hr-export-report', {
    body: { kind, range },
  });
  if (error) throw error;
  return data as { url: string; path: string };
}

// ── Settings ───────────────────────────────────────────────────

export async function getCompanySettings() {
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = user?.app_metadata?.company_id as string | undefined;
  if (!companyId) throw new Error('not_in_company');

  const { data, error } = await supabase
    .from('companies')
    .select('id, name, slug, settings')
    .eq('id', companyId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateCompanySettings(patch: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = user?.app_metadata?.company_id as string | undefined;
  if (!companyId) throw new Error('not_in_company');

  const { data, error } = await supabase
    .from('companies')
    .update(patch)
    .eq('id', companyId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Gifts engine (v2) ─────────────────────────────────────────

export interface GiftPool {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  budget_minor: number;
  spent_minor: number;
  currency: string;
  competition_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GiftCatalogItem {
  id: string;
  company_id: string | null;
  name_en: string;
  name_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  category: 'wh_service' | 'amazon' | 'custom';
  value_minor: number;
  currency: string;
  thumbnail_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AwardedRewardSummary {
  id: string;
  profile_id: string;
  tier: 'bronze' | 'silver' | 'gold';
  status: 'ready' | 'claimed' | 'fulfilled';
  awarded_at: string;
  claimed_at: string | null;
  fulfilled_at: string | null;
  chosen_item: { id: string; name_en: string; value_minor: number } | null;
  profile?: { display_name: string | null; initials: string | null } | null;
}

export async function listGiftPools(): Promise<GiftPool[]> {
  const { data, error } = await supabase
    .from('gift_pools')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    if ((error as { code?: string }).code === '42P01') return [];
    throw error;
  }
  return (data ?? []) as GiftPool[];
}

export async function listGiftCatalog(): Promise<GiftCatalogItem[]> {
  const { data, error } = await supabase
    .from('gift_catalog_items')
    .select('*')
    .eq('active', true)
    .order('category', { ascending: true })
    .order('name_en', { ascending: true });
  if (error) {
    if ((error as { code?: string }).code === '42P01') return [];
    throw error;
  }
  return (data ?? []) as GiftCatalogItem[];
}

export async function listCompanyAwardedRewards(limit = 50): Promise<AwardedRewardSummary[]> {
  const { data, error } = await supabase
    .from('awarded_rewards')
    .select(`
      id, profile_id, tier, status, awarded_at, claimed_at, fulfilled_at,
      chosen_item:gift_catalog_items(id, name_en, value_minor),
      profile:profiles(display_name, initials)
    `)
    .order('awarded_at', { ascending: false })
    .limit(limit);
  if (error) {
    if ((error as { code?: string }).code === '42P01') return [];
    throw error;
  }
  return (data ?? []) as unknown as AwardedRewardSummary[];
}

export interface TierConfiguration {
  id: string;
  company_id: string;
  competition_id: string;
  tier: 'bronze' | 'silver' | 'gold';
  gift_catalog_item_id: string | null;
  allow_employee_choice: boolean;
  choice_options: string[];
  value_minor_override: number | null;
  created_at: string;
  updated_at: string;
}

export async function listTierConfigurations(competitionId?: string): Promise<TierConfiguration[]> {
  let query = supabase.from('tier_configurations').select('*');
  if (competitionId) query = query.eq('competition_id', competitionId);
  const { data, error } = await query.order('competition_id').order('tier');
  if (error) {
    if ((error as { code?: string }).code === '42P01') return [];
    throw error;
  }
  return (data ?? []) as TierConfiguration[];
}

export async function upsertTierConfiguration(
  config: Omit<TierConfiguration, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<TierConfiguration> {
  const { data, error } = await supabase
    .from('tier_configurations')
    .upsert(config, { onConflict: 'competition_id,tier' })
    .select()
    .single();
  if (error) throw error;
  return data as TierConfiguration;
}

export async function upsertGiftPool(
  pool: Omit<GiftPool, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<GiftPool> {
  const { data, error } = await supabase
    .from('gift_pools')
    .upsert(pool)
    .select()
    .single();
  if (error) throw error;
  return data as GiftPool;
}

export async function upsertGiftCatalogItem(
  item: Omit<GiftCatalogItem, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<GiftCatalogItem> {
  const { data, error } = await supabase
    .from('gift_catalog_items')
    .upsert(item)
    .select()
    .single();
  if (error) throw error;
  return data as GiftCatalogItem;
}

export async function markRewardFulfilled(
  rewardId: string,
  deliveryMethod: 'manual' | 'tremendous' | 'voucher_code' = 'manual',
  deliveryDetails: Record<string, unknown> = {},
  notes?: string
) {
  const { data, error } = await supabase.rpc('mark_reward_fulfilled', {
    p_reward_id: rewardId,
    p_delivery_method: deliveryMethod,
    p_delivery_details: deliveryDetails,
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return data;
}
