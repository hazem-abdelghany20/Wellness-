// Wellness+ end-to-end: the app's REAL client libs (src/lib/*.ts) against a REAL local
// Supabase stack (migrations + seed + edge functions). No mocks. LOCAL ONLY.
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readdirSync } from 'node:fs';
import * as emp from '../src/lib/supabase.ts';
import * as hr from '../src/lib/supabase-hr.ts';
import * as adm from '../src/lib/supabase-admin.ts';

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE = process.env.E2E_SERVICE_KEY;
const DEMO_PW = 'WellnessDemo!2026'; // local test DB only; demo emails always use this in the client
const WH = '00000000-0000-0000-0000-000000000001';
const NG = '00000000-0000-0000-0000-000000000002';
const E = {
  amira: 'amira.hassan@demo.wellhouse.test',
  lina: 'lina.farouk@demo.wellhouse.test',
  omar: 'omar.sami@demo.wellhouse.test',
  nadia: 'nadia.kamel@demo.wellhouse.test',
  sara: 'sara.hr@demo.wellhouse.test',
  admin: 'e2e.admin@demo.wellhouse.test',
};
const OPTS = { auth: { persistSession: false, autoRefreshToken: false } };
const raw = () => createClient(URL, ANON, OPTS);
const svc = createClient(URL, SERVICE, OPTS);
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(email, pw = DEMO_PW) {
  const c = raw();
  const { error } = await c.auth.signInWithPassword({ email, password: pw });
  if (error) throw error;
  return c;
}
async function until(fn, ms = 15000) {
  const t = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t > ms) return null;
    await nap(250);
  }
}
// Subscribe to postgres_changes and resolve once SUBSCRIBED.
async function listen(client, table, filter) {
  const events = [];
  let ready;
  const p = new Promise((r) => (ready = r));
  const ch = client
    .channel('e2e-' + table + '-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, (m) => events.push(m))
    .subscribe((s) => { if (s === 'SUBSCRIBED') ready(true); });
  await Promise.race([p, nap(10000)]);
  await nap(1500); // SUBSCRIBED fires slightly before the postgres_changes binding is live
  return { events, stop: () => client.removeChannel(ch) };
}
const as = async (email) => { await emp.signOut(); return emp.signInOrUpWithPassword(email, 'ignored-for-demo'); };
const state = {};

describe('0 · stack', () => {
  it('auth is up and every edge function is served', async () => {
    const r = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: ANON } });
    expect(r.status).toBe(200);
    const fns = readdirSync('supabase/functions').filter((f) => !f.startsWith('_'));
    expect(fns.length).toBe(12);
    for (const f of fns) {
      const o = await fetch(`${URL}/functions/v1/${f}`, { method: 'OPTIONS', headers: { apikey: ANON } });
      expect(o.status, `function ${f}`).toBeLessThan(400);
    }
    const boot = await fetch(`${URL}/functions/v1/verify-company-code`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'WH-4782', email: 'x@y.z' }) });
    expect(boot.status, 'verify-company-code worker must boot').toBeLessThan(500);
  });
});

describe('1 · employee app (Amira)', () => {
  beforeAll(async () => {
    const r = await as(E.amira);
    state.amira = r.data.user.id;
  });

  it('signs in with the demo account (typed password ignored) and lands in Wellhouse Group', async () => {
    const p = await emp.getMyProfile();
    expect(p.role).toBe('employee');
    const c = await emp.getMyCompany();
    expect(c.name).toBe('Wellhouse Group');
  });

  it('company-code gate: valid code accepted, bad code rejected', async () => {
    const ok = await emp.verifyCompanyCode('WH-4782', E.amira);
    expect(ok.valid).toBe(true);
    expect(ok.company?.name).toBe('Wellhouse Group');
    const bad = await emp.verifyCompanyCode('xxxx', E.amira).catch((e) => ({ valid: false, thrown: String(e) }));
    expect(bad.valid).toBe(false);
  });

  it('daily check-in: saves, re-submitting the same day updates (no duplicate), streak is maintained', async () => {
    const before = (await emp.getMyProfile()).streak_current;
    const a = await emp.submitCheckin({ sleep: 7.5, stress: 3, energy: 6, mood: 8 });
    expect(a.sleep).toBe(8); // half-step slider value rounded for smallint
    const b = await emp.submitCheckin({ sleep: 5, stress: 6, energy: 4, mood: 5 });
    expect(b.id).toBe(a.id);
    expect(b.mood).toBe(5);
    const today = new Date().toISOString().split('T')[0];
    const { count } = await svc.from('checkins').select('*', { count: 'exact', head: true }).eq('user_id', state.amira).eq('checked_at', today);
    expect(count).toBe(1);
    const after = (await emp.getMyProfile()).streak_current;
    state.streak = { before, after };
    expect(after).toBeGreaterThanOrEqual(1);
    const hist = await emp.getCheckinHistory(30);
    expect(hist.some((h) => String(h.checked_at).startsWith(today))).toBe(true);
  });

  it('wallet: Ready/Pending/Delivered rows → choose-from-options → claim → pending; double-claim and stealing blocked', async () => {
    const rows = await emp.listMyAwardedRewards();
    const by = (s) => rows.filter((r) => r.status === s);
    expect(by('ready')).toHaveLength(1);
    expect(by('claimed')).toHaveLength(1);
    expect(by('fulfilled')).toHaveLength(1);
    const ready = by('ready')[0];
    expect(ready.tier).toBe('gold');
    const choice = await emp.getTierChoiceForReward(ready.competition_id, 'gold');
    expect(choice.allow_choice).toBe(true);
    const names = choice.options.map((o) => o.name_en).sort();
    expect(names).toEqual(['Empath — therapy voucher', 'Sakoon — 4-week program', 'Sleep Reset — 1:1 sessions']);
    state.sakoon = choice.options.find((o) => o.name_en.startsWith('Sakoon')).id;
    state.compId = ready.competition_id;
    const claimed = await emp.claimMyReward(ready.id, state.sakoon);
    expect(claimed.status).toBe('claimed');
    expect(claimed.chosen_item_id).toBe(state.sakoon);
    await expect(emp.claimMyReward(ready.id, state.sakoon)).rejects.toBeTruthy(); // double-claim
    const { data: linaReady } = await svc.from('awarded_rewards').select('id').eq('status', 'ready').neq('profile_id', state.amira).limit(1).single();
    await expect(emp.claimMyReward(linaReady.id)).rejects.toBeTruthy(); // someone else's reward
    state.claimedId = ready.id;
  });

  it('content library: items load; playback progress is saved and resumed', async () => {
    const items = await emp.getContentItems();
    expect(items.length).toBe(13); // 10 Wellness House articles + 2 sleep articles + desk-mobility video (audio retired)
    await emp.saveContentProgress(items[0].id, 42);
    expect(await emp.getContentProgress(items[0].id)).toBe(42);
  });

  it('signature competitions: Sabr (21d) + Niyyah (7d) exist; practice day can be completed with a reflection', async () => {
    const sig = await emp.listSignatureChallenges();
    const sabr = sig.find((c) => c.theme === 'sabr');
    const niyyah = sig.find((c) => c.theme === 'niyyah');
    expect(sabr?.duration_days).toBe(21);
    expect(niyyah?.duration_days).toBe(7);
    const path = await emp.getCompetitionPath(sabr.id);
    expect(path.days).toHaveLength(21);
    await emp.completePracticeDay(sabr.id, 1, 'e2e reflection');
    const again = await emp.getCompetitionPath(sabr.id);
    expect(again.completions.some((c) => c.day_number === 1)).toBe(true);
  });

  it('notifications: list + mark-all-read', async () => {
    expect(Array.isArray(await emp.getNotifications())).toBe(true);
    await emp.markAllNotificationsRead();
    const left = (await emp.getNotifications()).filter((n) => !n.read_at && !n.read);
    expect(left).toHaveLength(0);
  });

  it('profile edits persist', async () => {
    await emp.updateMyProfile({ display_name: 'Amira Hassan' });
    expect((await emp.getMyProfile()).display_name).toBe('Amira Hassan');
  });
});

describe('2 · HR portal (Sara) + cross-portal', () => {
  beforeAll(async () => {
    state.sara = (await as(E.sara)).data.user.id;
  });

  it('privacy floor: sub-5 groups are never published; the 5+ company group is, with noise', async () => {
    // history for all six WH people across the last 4 weeks
    const { data: people } = await svc.from('profiles').select('id, company_id').eq('company_id', WH);
    expect(people.length).toBeGreaterThanOrEqual(5);
    const rows = [];
    for (let d = 8; d <= 30; d++) {
      const day = new Date(Date.now() - d * 86400000).toISOString().split('T')[0];
      for (const [i, p] of people.entries()) {
        rows.push({ user_id: p.id, company_id: WH, checked_at: day, sleep: 5 + (i % 4), stress: 3 + (i % 5), energy: 4 + (i % 4), mood: 5 + (i % 5) });
      }
    }
    const ins = await svc.from('checkins').upsert(rows, { onConflict: 'user_id,checked_at' });
    expect(ins.error).toBeNull();
    const { data: s } = await raw().auth.signInWithPassword({ email: E.sara, password: DEMO_PW });
    const r = await fetch(`${URL}/functions/v1/compute-hr-aggregates`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${s.session.access_token}`, 'Content-Type': 'application/json' }, body: '{}' });
    expect(r.status, await r.clone().text()).toBe(200);
    const { data: agg } = await svc.from('hr_weekly_aggregates').select('team_id, group_size').eq('company_id', WH);
    expect(agg.length).toBeGreaterThan(0);
    expect(agg.every((a) => a.group_size >= 5)).toBe(true); // nothing sub-5 ever stored
    expect(agg.some((a) => a.team_id === null)).toBe(true); // company-wide group published
    const teamRows = agg.filter((a) => a.team_id);
    state.teamRowsPublished = teamRows.length; // Engineering has 3 members → must be 0 here
    expect(teamRows.length).toBe(0);
    // belt and braces: DB constraint refuses a hand-written sub-5 row
    const bad = await svc.from('hr_weekly_aggregates').insert({ company_id: WH, team_id: null, week_start: '2000-01-01', group_size: 3 });
    expect(bad.error).toBeTruthy();
  });

  it('dashboard: company overview returns KPIs and a trend', async () => {
    const o = await hr.getCompanyOverview('30d');
    expect(o.kpis).toBeTruthy();
    expect(Object.keys(o.kpis).length).toBeGreaterThan(0);
    expect(Array.isArray(o.trend)).toBe(true);
  });

  it('people: roster is Wellhouse only', async () => {
    const roster = await hr.getRoster();
    expect(roster.length).toBeGreaterThanOrEqual(6);
    const { data: ids } = await svc.from('profiles').select('id').eq('company_id', WH);
    const wh = new Set(ids.map((i) => i.id));
    expect(roster.every((p) => wh.has(p.id))).toBe(true);
  });

  it('gifts catalog: add item persists; deactivating an option removes it from the employee picker (live)', async () => {
    const item = await hr.createGiftCatalogItem({ name_en: 'E2E Spa Voucher', value_minor: 5000 });
    expect((await hr.getGiftCatalogItems()).some((i) => i.id === item.id)).toBe(true);
    await hr.updateGiftCatalogItem(state.sakoon, { active: false });
    const amira = await login(E.amira);
    const { data: cfg } = await amira.from('tier_configurations').select('choice_options').eq('competition_id', state.compId).eq('tier', 'gold').single();
    const { data: items } = await amira.from('gift_catalog_items').select('id').in('id', cfg.choice_options).eq('active', true);
    expect(items.map((i) => i.id)).not.toContain(state.sakoon);
    expect(items).toHaveLength(2);
    await hr.updateGiftCatalogItem(state.sakoon, { active: true });
  });

  it('tier rewards: Bronze fixed / Silver 2 options / Gold 3 options; Bronze can be switched to choice and saved', async () => {
    const tiers = await hr.listTierConfigurations(state.compId);
    const t = Object.fromEntries(tiers.map((x) => [x.tier, x]));
    expect(t.bronze.allow_employee_choice).toBe(false);
    expect(t.bronze.gift_catalog_item_id).toBeTruthy();
    expect(t.silver.choice_options).toHaveLength(2);
    expect(t.gold.choice_options).toHaveLength(3);
    const upd = await hr.updateTierConfiguration(t.bronze.id, { allow_employee_choice: true, choice_options: t.silver.choice_options });
    expect(upd.allow_employee_choice).toBe(true);
    await hr.updateTierConfiguration(t.bronze.id, { allow_employee_choice: false, choice_options: [] });
  });

  it('mark fulfilled: claimed → fulfilled (employee sees it); an unclaimed reward can NOT be fulfilled; employees can not fulfil', async () => {
    const list = await hr.listCompanyAwardedRewards();
    expect(list.length).toBeGreaterThanOrEqual(5);
    await hr.markRewardFulfilled(state.claimedId, 'manual', {}, 'e2e');
    const amira = await login(E.amira);
    const { data: mine } = await amira.from('awarded_rewards').select('status, fulfilled_at').eq('id', state.claimedId).single();
    expect(mine.status).toBe('fulfilled');
    const { data: lina } = await svc.from('awarded_rewards').select('id').eq('status', 'ready').limit(1).single();
    await expect(hr.markRewardFulfilled(lina.id)).rejects.toBeTruthy();
    const { error } = await amira.rpc('mark_reward_fulfilled', { p_reward_id: lina.id, p_delivery_method: 'manual', p_delivery_details: {}, p_notes: null });
    expect(error).toBeTruthy();
  });

  it('realtime wallet: a new reward appears on Amira’s open session without refresh', async () => {
    const amira = await login(E.amira);
    const cap = await listen(amira, 'awarded_rewards', `profile_id=eq.${state.amira}`);
    const { error } = await svc.from('awarded_rewards').insert({ profile_id: state.amira, company_id: WH, competition_id: state.compId, tier: 'bronze', status: 'ready', fulfillment_method: 'manual' });
    expect(error).toBeNull();
    const got = await until(() => cap.events.find((e) => e.eventType === 'INSERT'));
    cap.stop();
    expect(got, 'no realtime INSERT event received').toBeTruthy();
  });

  it('broadcast: HR schedules → Amira’s notifications get it live', async () => {
    const amira = await login(E.amira);
    const cap = await listen(amira, 'notifications', `user_id=eq.${state.amira}`);
    const b = await hr.scheduleBroadcast({ title_en: 'E2E hello', body_en: 'from HR', scope: 'all', scheduled_at: new Date().toISOString() });
    expect(b.id).toBeTruthy();
    const got = await until(() => cap.events.find((e) => e.eventType === 'INSERT'));
    cap.stop();
    expect(got, 'no realtime notification received').toBeTruthy();
    const { data: n } = await amira.from('notifications').select('*').eq('user_id', state.amira);
    expect(n.length).toBeGreaterThan(0);
  });

  it('challenges: templates are readable by HR and one can be scheduled', async () => {
    const tpl = await hr.listChallengeTemplates();
    expect(tpl.length).toBeGreaterThan(0);
    const ch = await hr.scheduleChallenge(tpl[0], { start: '2026-10-05', end: '2026-10-12' }, 'all');
    expect(ch.id).toBeTruthy();
    expect((await hr.listScheduledChallenges()).some((c) => c.id === ch.id)).toBe(true);
  });

  it('content: HR can unpublish an item and it leaves the employee library', async () => {
    const lib = await hr.getContentLibrary();
    const target = lib.find((i) => i.status === 'published' || i.published);
    await hr.updateContentItem(target.id, { published: false });
    const amira = await login(E.amira);
    const { data } = await amira.from('content_items').select('id').eq('id', target.id);
    expect(data).toHaveLength(0);
    await hr.updateContentItem(target.id, { published: true });
  });

  it('reports: export returns a downloadable CSV', async () => {
    const r = await hr.requestReportExport('overview', '30d');
    expect(r.url).toBeTruthy();
    const csv = await (await fetch(r.url)).text();
    expect(csv.split('\n').length).toBeGreaterThan(1);
  });

  it('settings: company name edit persists', async () => {
    const before = await hr.getCompanySettings();
    await hr.updateCompanySettings({ name: 'Wellhouse Group (e2e)' });
    expect((await hr.getCompanySettings()).name).toBe('Wellhouse Group (e2e)');
    await hr.updateCompanySettings({ name: before.name });
  });

  it('HR scope: Sara sees Wellhouse only — never Nile Group', async () => {
    const c = await login(E.sara);
    const { data: cos } = await c.from('companies').select('id');
    expect(cos.map((x) => x.id)).toEqual([WH]);
    const { data: nile } = await c.from('profiles').select('id').eq('company_id', NG);
    expect(nile).toHaveLength(0);
  });
});

describe('3 · cross-tenant isolation + privilege escalation (new Nile Group user)', () => {
  const email = `e2e.nile.${Date.now()}@example.com`;
  const pw = 'E2e-Local-Test-1!';
  let c; let me;

  it('sign-up with company code NG-9130 lands in Nile Group', async () => {
    await emp.signOut();
    const r = await emp.signInOrUpWithPassword(email, pw, { company_code: 'NG-9130' });
    me = r.data.user.id;
    c = raw();
    await c.auth.setSession({ access_token: r.data.session.access_token, refresh_token: r.data.session.refresh_token });
    expect((await emp.getMyCompany()).name).toContain('النيل');
  });

  it('sees none of Wellhouse’s data', async () => {
    for (const [t, q] of [
      ['awarded_rewards', (x) => x], ['broadcasts', (x) => x], ['gift_catalog_items', (x) => x.eq('company_id', WH)],
      ['checkins', (x) => x.eq('company_id', WH)], ['profiles', (x) => x.eq('company_id', WH)],
    ]) {
      const { data } = await q(c.from(t).select('*'));
      expect(data ?? [], t).toHaveLength(0);
    }
    const { data: cos } = await c.from('companies').select('id');
    expect(cos.map((x) => x.id)).toEqual([NG]);
  });

  async function freshNile() {
    const em = `e2e.nile.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.com`;
    const cl = raw();
    const { data, error } = await cl.auth.signUp({ email: em, password: pw, options: { data: { company_code: 'NG-9130' } } });
    if (error) throw error;
    return { cl, id: data.user.id };
  }

  it('can NOT move themselves into another tenant (profiles.company_id)', async () => {
    const u = await freshNile();
    await u.cl.from('profiles').update({ company_id: WH }).eq('id', u.id);
    const { data: p } = await svc.from('profiles').select('company_id').eq('id', u.id).single();
    expect(p.company_id, 'user rewrote their own company_id').toBe(NG);
  });

  it('can NOT promote themselves (profiles.role)', async () => {
    const u = await freshNile();
    await u.cl.from('profiles').update({ role: 'hr_admin' }).eq('id', u.id);
    const { data: p } = await svc.from('profiles').select('role').eq('id', u.id).single();
    expect(p.role, 'user rewrote their own role').toBe('employee');
  });

  it('can NOT write check-ins into another tenant', async () => {
    const u = await freshNile();
    const ci = await u.cl.from('checkins').insert({ user_id: u.id, company_id: WH, checked_at: '2026-10-01', sleep: 5, stress: 5, energy: 5, mood: 5 });
    expect(ci.error, 'cross-tenant insert was accepted').toBeTruthy();
  });

  it('can NOT claim another tenant’s reward or call HR/admin RPCs', async () => {
    const u = await freshNile();
    const { data: aReady } = await svc.from('awarded_rewards').select('id').eq('status', 'ready').limit(1).single();
    expect((await u.cl.rpc('claim_my_reward', { p_reward_id: aReady.id, p_chosen_item: null })).error).toBeTruthy();
    expect((await u.cl.rpc('hr_company_overview', { p_range: '30d' })).error).toBeTruthy();
    expect((await u.cl.rpc('admin_set_flag', { p_key: 'x', p_scope: 'global', p_target_id: null, p_enabled: true, p_payload: {} })).error).toBeTruthy();
  });

  it('anonymous (no login) reads nothing', async () => {
    const a = raw();
    for (const t of ['profiles', 'checkins', 'companies', 'awarded_rewards', 'notifications']) {
      const { data } = await a.from(t).select('*');
      expect(data ?? [], t).toHaveLength(0);
    }
  });

  it('delete-my-account purges the user and they can no longer sign in', async () => {
    await emp.signOut();
    await emp.signInOrUpWithPassword(email, pw);
    await emp.deleteMyAccount();
    const { error } = await raw().auth.signInWithPassword({ email, password: pw });
    expect(error).toBeTruthy();
  });
});

describe('4 · admin console', () => {
  beforeAll(async () => {
    const { data, error } = await svc.auth.admin.createUser({ email: E.admin, password: DEMO_PW, email_confirm: true });
    const id = data?.user?.id ?? (await svc.from('profiles').select('id').eq('email', E.admin).single()).data?.id;
    if (error && !id) throw error;
    await svc.from('profiles').upsert({ id, role: 'wellness_admin', company_id: WH, display_name: 'E2E Admin' });
    await as(E.admin);
  });

  it('platform overview lists both tenants with seats/MRR totals', async () => {
    const o = await adm.getPlatformOverview();
    expect(o.companies.map((c) => c.id).sort()).toEqual([WH, NG].sort());
    expect(o.totals.tenants).toBe(2);
    const t = await adm.getTenant(WH);
    expect(t.name).toBeTruthy();
  });

  it('flags: toggle is audited; roles, localization and global content work', async () => {
    const flags = await adm.listFlags();
    expect(flags.length).toBeGreaterThan(0);
    await adm.setFlag({ key: flags[0].key, scope: 'global', enabled: !flags[0].enabled });
    const audit = await adm.listAudit(20);
    expect(audit.length).toBeGreaterThan(1);
    expect((await adm.listAdmins()).length).toBeGreaterThan(0);
    await adm.setString('e2e.hello', 'en', 'Hello');
    expect((await adm.listStrings()).some((s) => s.key === 'e2e.hello')).toBe(true);
    const item = await adm.createContentItem({ title_en: 'E2E global item', kind: 'article', status: 'published' });
    const amira = await login(E.amira);
    const { data } = await amira.from('content_items').select('id').eq('id', item.id);
    expect(data).toHaveLength(1); // global content reaches employees
  });

  it('new challenge template authored in Admin shows up for HR', async () => {
    const t = await adm.createChallengeTemplate({ slug: `e2e-${Date.now()}`, title_en: 'E2E Template', kind: 'checkins', target: 5 });
    await as(E.sara);
    expect((await hr.listChallengeTemplates()).some((x) => x.id === t.id)).toBe(true);
  });

  it('platform report export works', async () => {
    await as(E.admin);
    const r = await adm.exportPlatformReport('tenants', '30d');
    expect(r.url).toBeTruthy();
  });

  it('non-admins are locked out of the admin console data and actions', async () => {
    await as(E.sara);
    const hrSees = await adm.listTenants();
    expect(hrSees.map((c) => c.id)).toEqual([WH]); // only own tenant, not the platform view
    await expect(adm.setFlag({ key: 'x', scope: 'global', enabled: true })).rejects.toBeTruthy();
    await expect(adm.setRole(state.amira, 'wellness_admin')).rejects.toBeTruthy();
    await as(E.amira);
    expect((await adm.listAudit(5)).length).toBe(0);
    await expect(adm.createTenant({ name: 'Evil Corp' })).rejects.toBeTruthy();
  });
});

describe('5 · security review (measured, not assumed)', () => {
  it('an employee can not read their company’s integrations (config may hold credentials)', async () => {
    const c = await login(E.amira);
    const { data } = await c.from('integrations').select('id, kind');
    expect(data ?? [], 'employee can read integrations rows').toHaveLength(0);
  });

  it('an employee can not read broadcasts that are scheduled/cancelled (only delivered notifications)', async () => {
    const c = await login(E.amira);
    const { data } = await c.from('broadcasts').select('id, status').in('status', ['scheduled', 'cancelled', 'draft']);
    expect(data ?? [], 'employee can read unsent broadcasts').toHaveLength(0);
  });

  it('HR of one tenant can not read audit-log entries about another tenant', async () => {
    await svc.from('audit_log').insert({ actor_email: 'platform@example.com', action: 'e2e.nile.secret', target: 'company', target_id: NG, severity: 'info', details: {} });
    const c = await login(E.sara);
    const { data } = await c.from('audit_log').select('id').eq('action', 'e2e.nile.secret');
    expect(data ?? [], 'Wellhouse HR can read Nile Group audit entries').toHaveLength(0);
  });

  it('HR of one tenant can not see another tenant’s company-scoped feature flags', async () => {
    await svc.from('feature_flags').insert({ key: 'e2e_nile_only', scope: 'company', target_id: NG, enabled: true, payload: {} });
    const c = await login(E.sara);
    const { data } = await c.from('feature_flags').select('id').eq('key', 'e2e_nile_only');
    expect(data ?? [], 'Wellhouse HR can read Nile Group flags').toHaveLength(0);
  });

  it('HR can not read raw individual check-ins (aggregates only)', async () => {
    const c = await login(E.sara);
    const { data } = await c.from('checkins').select('user_id, mood').limit(5);
    expect(data ?? [], 'HR can read individual check-in rows').toHaveLength(0);
  });

  it('an employee can not read a colleague’s check-ins', async () => {
    const c = await login(E.amira);
    const { data: lina } = await svc.from('profiles').select('id').eq('display_name', 'Lina Farouk').single();
    const { data } = await c.from('checkins').select('id').eq('user_id', lina.id);
    expect(data ?? []).toHaveLength(0);
  });

  it('employees are refused by the HR-only edge functions', async () => {
    const c = await login(E.amira);
    const { data: s } = await c.auth.getSession();
    for (const [fn, body] of [['hr-schedule-broadcast', { title_en: 'x', body_en: 'y', scheduled_at: new Date().toISOString() }], ['compute-hr-aggregates', {}], ['hr-export-report', { kind: 'overview', range: '30d' }]]) {
      const r = await fetch(`${URL}/functions/v1/${fn}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${s.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      expect([401, 403], `${fn} answered ${r.status}`).toContain(r.status);
    }
  });

  it('super-admin allowlist: a stranger who registers an allow-listed email gets no cross-tenant power on a fresh project', async () => {
    // Local DB only. Sign-up needs no email confirmation, and is_superadmin() trusts the JWT email claim.
    const target = 'hazemabdelghany@gmail.com';
    await svc.auth.admin.listUsers().then(async ({ data }) => {
      const ex = data.users.find((u) => u.email === target);
      if (ex) await svc.auth.admin.deleteUser(ex.id);
    });
    const c = raw();
    const { data, error } = await c.auth.signUp({ email: target, password: 'E2e-Local-Test-1!', options: { data: { company_code: 'NG-9130' } } });
    expect(error).toBeNull();
    const me = data.user.id;
    const { data: wh } = await c.from('profiles').select('id').eq('company_id', WH);
    const { data: rw } = await c.from('awarded_rewards').select('id');
    const { data: cos } = await c.from('companies').select('id');
    const ov = await c.rpc('hr_company_overview', { p_range: '30d' });
    await svc.auth.admin.deleteUser(me); // clean up the local user
    expect({ whProfilesVisible: (wh ?? []).length, rewardsVisible: (rw ?? []).length, companiesVisible: (cos ?? []).length, hrOverviewAllowed: !ov.error }).toEqual({ whProfilesVisible: 0, rewardsVisible: 0, companiesVisible: 1, hrOverviewAllowed: false });
  });
});

describe('6 · shared-content blast radius', () => {
  it('an HR admin can not edit library content that every tenant sees', async () => {
    const { data: item } = await svc.from('content_items').select('id, title_en').eq('published', true).limit(1).single();
    const c = await login(E.sara);
    await c.from('content_items').update({ title_en: 'HACKED BY TENANT HR' }).eq('id', item.id);
    const { data: after } = await svc.from('content_items').select('title_en').eq('id', item.id).single();
    await svc.from('content_items').update({ title_en: item.title_en }).eq('id', item.id);
    expect(after.title_en, 'one tenant’s HR rewrote global content').toBe(item.title_en);
  });
});
