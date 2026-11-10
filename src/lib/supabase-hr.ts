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
  const companyId = await resolveCompanyId();
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
    .is('deleted_at', null)
    .order('display_name');
  if (error) throw error;
  return data ?? [];
}

// ── Content ────────────────────────────────────────────────────

// PostgREST "function not found": the live database doesn't have the sprint 2
// SQL (20261110000001) yet. The content screen then works as before.
function rpcMissing(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message || ''));
}

// A public (Wellness House) row as this company sees it: hidden = shown as
// 'hidden' / unpublished so the current Publish toggle reads right.
function companyView(row: any) {
  if (row?.scope === 'public' && row.hidden) return { ...row, status: 'hidden', published: false };
  return row;
}

// Public + our own content, pinned first, with scope / hidden / pinned flags
// (see listLibrary in supabase-routines.ts).
export async function getContentLibrary() {
  const { data, error } = await supabase.rpc('library_list', { p_type: 'content', p_scope: 'all' });
  if (rpcMissing(error)) {
    const old = await supabase.from('content_items').select('*').order('sort_order');
    if (old.error) throw old.error;
    return old.data ?? [];
  }
  if (error) throw error;
  return ((data ?? []) as any[]).map(companyView);
}

// Shared (public) rows are never written: publish / unpublish hides or shows
// the item for this company only, pinned pins it. Our own rows are saved
// through save_content_item. Any other change to a public row is refused.
export async function updateContentItem(contentId: string, patch: Record<string, unknown>) {
  const { data: row, error: readErr } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', contentId)
    .single();
  if (readErr) throw readErr;
  if (!row || !('company_id' in row)) {
    // Database without company_id yet: previous behaviour.
    const normalized = { ...patch };
    if ('published' in normalized && !('status' in normalized)) {
      normalized.status = normalized.published ? 'published' : 'draft';
    }
    const { data, error } = await supabase.from('content_items').update(normalized).eq('id', contentId).select().single();
    if (error) throw error;
    return data;
  }

  const wantsPublished = 'status' in patch ? patch.status === 'published'
    : 'published' in patch ? !!patch.published : undefined;

  if (row.company_id == null) {
    const allowed = new Set(['status', 'published', 'pinned']);
    const other = Object.keys(patch).filter((k) => !allowed.has(k));
    if (other.length) throw Object.assign(new Error('public_item_read_only'), { code: '42501' });
    const { data: pref, error } = await supabase.rpc('hr_set_library_pref', {
      p_item_type: 'content', p_item_id: contentId,
      p_hidden: wantsPublished === undefined ? null : !wantsPublished,
      p_pinned: 'pinned' in patch ? !!patch.pinned : null,
      p_sort_order: null,
    });
    if (error) throw error;
    return companyView({ ...row, scope: 'public', can_edit: false, hidden: !!pref?.hidden, pinned: !!pref?.pinned });
  }

  const input: Record<string, unknown> = { id: contentId, ...patch };
  delete input.published;
  delete input.pinned;
  if (wantsPublished !== undefined) input.status = wantsPublished ? 'published' : 'draft';
  const { data, error } = await supabase.rpc('save_content_item', { p_input: input });
  if (error) throw error;
  if ('pinned' in patch) {
    const { error: pinErr } = await supabase.rpc('hr_set_library_pref', {
      p_item_type: 'content', p_item_id: contentId, p_hidden: null, p_pinned: !!patch.pinned, p_sort_order: null,
    });
    if (pinErr) throw pinErr;
  }
  return { ...(data as any), scope: 'company', can_edit: true };
}

export async function assignContent(contentId: string, scope: 'all' | 'team', teamId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');
  const companyId = await resolveCompanyId();

  const { data, error } = await supabase.from('content_assignments').insert({
    company_id: companyId,
    content_id: contentId,
    scope,
    team_id: scope === 'team' ? teamId : null,
    assigned_by: user.id,
  }).select().single();
  if (error) throw error;
  return data;
}

// ── Participation (what the HR dashboard shows) ──────────────

export async function getParticipationOverview(range: '7d' | '30d' | '90d' = '30d') {
  const { data, error } = await supabase.rpc('hr_participation_overview', { p_range: range });
  if (error) throw error;
  return data;
}

// ── Challenges (weekly habit challenges) ─────────────────────

// Archived templates (Wellness House admin) are left out of the picker;
// weeks already scheduled from them keep running. Filtered here rather than
// with .is('archived_at', null) so the picker still loads on a database
// that hasn't got the archived_at column yet. Since sprint 2 this returns
// public templates plus the company's own (company_id set; payload.weeks
// 1–4); RLS hides other companies' templates.
export async function listHabitTemplates() {
  const { data, error } = await supabase
    .from('challenge_templates')
    .select('*')
    .eq('kind', 'habit')
    .order('title_en');
  if (error) throw error;
  return (data ?? []).filter((t: any) => !t.archived_at);
}

export async function listHabitChallenges() {
  const { data, error } = await supabase.rpc('hr_habit_challenges');
  if (error) throw error;
  return data ?? [];
}

export async function scheduleHabitChallenge(templateId: string, weekStart: string, teamId?: string | null) {
  const { data, error } = await supabase.rpc('hr_schedule_habit_challenge', {
    p_template_id: templateId, p_week_start: weekStart, p_team_id: teamId || null,
  });
  if (error) throw error;
  return data;
}

export async function cancelHabitChallenge(challengeId: string) {
  const { error } = await supabase.rpc('hr_cancel_habit_challenge', { p_challenge_id: challengeId });
  if (error) throw error;
}

export async function listCompanyTeams() {
  const companyId = await resolveCompanyId();
  const { data, error } = await supabase
    .from('teams')
    .select('id, name')
    .eq('company_id', companyId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listScheduledChallenges() {
  // Live challenges (runtime instances) — used by the tier-rewards
  // competition picker, whose FK targets challenges.id, NOT
  // challenge_templates.id. Returns active + recently-ended challenges
  // ordered by start_date desc.
  const companyId = await resolveCompanyId();
  const { data, error } = await supabase
    .from('challenges')
    .select('id, title_en, title_ar, start_date, end_date, active')
    .eq('company_id', companyId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Broadcasts ─────────────────────────────────────────────────
// Sprint 3: these go through the hr_*_broadcast RPCs (delivery at the set
// time, quiet hours, audio — full API in ./supabase-broadcasts). Before that
// SQL is live they fall back to the old table / edge-function calls.

export async function listBroadcasts() {
  const rpc = await supabase.rpc('hr_list_broadcasts', { p_limit: 100 });
  if (!rpc.error) return (rpc.data ?? []) as any[];
  if (!rpcMissing(rpc.error)) throw rpc.error;
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
  const rpc = await supabase.rpc('hr_save_broadcast', { p_input: payload });
  if (!rpc.error) return rpc.data as any;
  if (!rpcMissing(rpc.error)) throw rpc.error;
  const { data, error } = await supabase.functions.invoke('hr-schedule-broadcast', { body: payload });
  if (error) throw error;
  return (data as any).broadcast;
}

export async function cancelBroadcast(id: string) {
  const rpc = await supabase.rpc('hr_cancel_broadcast', { p_broadcast_id: id });
  if (!rpc.error) return;
  if (!rpcMissing(rpc.error)) throw rpc.error;
  const { error } = await supabase
    .from('broadcasts')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (error) throw error;
}

// ── Gifts ───────────────────────────────────────────────────────

async function getMyCompanyId() {
  return resolveCompanyId();
}

export async function getGiftCatalogItems() {
  const companyId = await getMyCompanyId();
  const { data, error } = await supabase
    .from('gift_catalog_items')
    .select('*')
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .order('category')
    .order('name_en');
  if (error) throw error;
  return data ?? [];
}

export async function createGiftCatalogItem(payload: {
  name_en: string;
  name_ar?: string;
  description_en?: string;
  description_ar?: string;
  category?: string;
  value_minor?: number;
  currency?: string;
}) {
  const companyId = await getMyCompanyId();
  const { data, error } = await supabase
    .from('gift_catalog_items')
    .insert({
      company_id: companyId,
      name_en: payload.name_en,
      name_ar: payload.name_ar ?? payload.name_en,
      description_en: payload.description_en ?? '',
      description_ar: payload.description_ar ?? payload.description_en ?? '',
      category: payload.category ?? 'wh_service',
      value_minor: payload.value_minor ?? 0,
      currency: payload.currency ?? 'EGP',
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGiftCatalogItem(id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('gift_catalog_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getTierConfigurations() {
  const companyId = await getMyCompanyId();
  const { data, error } = await supabase
    .from('tier_configurations')
    .select('*')
    .eq('company_id', companyId)
    .order('tier');
  if (error) throw error;
  return data ?? [];
}

export async function updateTierConfiguration(id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('tier_configurations')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAwardedRewards() {
  const companyId = await getMyCompanyId();
  const { data, error } = await supabase
    .from('awarded_rewards')
    .select(`
      *,
      profiles(display_name, initials),
      gift_catalog_items(name_en, name_ar)
    `)
    .eq('company_id', companyId)
    .order('awarded_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getGiftPools() {
  const companyId = await getMyCompanyId();
  const { data, error } = await supabase
    .from('gift_pools')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
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

async function resolveCompanyId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');
  const jwtCompany = user.app_metadata?.company_id as string | undefined;
  if (jwtCompany) return jwtCompany;
  const { data: prof } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();
  const profCompany = prof?.company_id as string | undefined;
  if (!profCompany) throw new Error('not_in_company');
  return profCompany;
}

export async function getCompanySettings() {
  const companyId = await resolveCompanyId();
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, slug, code, settings')
    .eq('id', companyId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateCompanySettings(patch: Record<string, unknown>) {
  const companyId = await resolveCompanyId();
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
  // The RLS INSERT/UPDATE policy on tier_configurations requires
  // company_id = current admin's company. UI callers don't track it,
  // so resolve and inject it before the upsert.
  const company_id = config.company_id ?? (await resolveCompanyId());
  const { data, error } = await supabase
    .from('tier_configurations')
    .upsert({ ...config, company_id }, { onConflict: 'competition_id,tier' })
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
  // Use update() when id is present so PostgREST evaluates the UPDATE RLS
  // policy (which allows editing shared company_id=NULL catalog rows for
  // HR admins). upsert() goes through INSERT, which requires company_id to
  // match the caller and blocks edits to the seeded shared catalog.
  if (item.id) {
    const { id, ...patch } = item;
    const { data, error } = await supabase
      .from('gift_catalog_items')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as GiftCatalogItem;
  }
  const companyId = await resolveCompanyId();
  const { data, error } = await supabase
    .from('gift_catalog_items')
    .insert({ ...item, company_id: item.company_id ?? companyId })
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
