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
