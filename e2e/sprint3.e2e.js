// Sprint 3 end-to-end: the real client libs (supabase-teams.ts,
// supabase-broadcasts.ts, the push RPCs, the bulk media helper) against the
// local stack with demo_seed_routines.sql loaded. LOCAL ONLY. send-reminders
// is checked only for its door (no secret → 401 / 503) when functions are
// served; the push path itself is covered by
// supabase/tests/reminders_broadcasts_teams_checks.sql (selection, claims,
// results) and src/lib/__tests__/send-reminders-payload.test.js (payloads).
//   eval "$(supabase status -o env | sed 's/^/export /')"
//   VITE_SUPABASE_URL=$API_URL VITE_SUPABASE_ANON_KEY=$ANON_KEY E2E_SERVICE_KEY=$SERVICE_ROLE_KEY \
//     npx vitest run --config vitest.e2e.config.js e2e/sprint3.e2e.js
// Leaves the database as it found it (deletes / cancels what it makes).
import { describe, it, expect, afterAll } from 'vitest';
import * as emp from '../src/lib/supabase.ts';
import * as rt from '../src/lib/supabase-routines.ts';
import * as teams from '../src/lib/supabase-teams.ts';
import * as bc from '../src/lib/supabase-broadcasts.ts';

const WH = '00000000-0000-0000-0000-000000000001';
const E = {
  amira: 'amira.hassan@demo.wellhouse.test',
  omar: 'omar.sami@demo.wellhouse.test',
  sara: 'sara.hr@demo.wellhouse.test',
};
const as = async (email) => { await emp.signOut(); rt.clearMediaUrlCache(); return emp.signInOrUpWithPassword(email, 'ignored-for-demo'); };
const cleanup = [];
afterAll(async () => { for (const f of cleanup.reverse()) { try { await f(); } catch { /* best effort */ } } });

describe('teams', () => {
  it('HR creates a team, moves a person in, makes them lead, then deletes it moving people out', async () => {
    const sara = await as(E.sara);
    expect(sara.error ?? null).toBeNull();
    const before = await teams.listTeams();
    expect(before.teams.map((t) => t.name)).toEqual(expect.arrayContaining(['Engineering', 'Finance']));
    const omarId = (await as(E.omar)).data.user.id;
    await as(E.sara);
    const omarTeam = (await emp.supabase.from('profiles').select('team_id').eq('id', omarId).single()).data.team_id;
    cleanup.push(async () => { await as(E.sara); await teams.movePersonToTeam(omarId, omarTeam); await teams.setTeamLead(omarId, false); });

    const t = await teams.createTeam(`E2E team ${Date.now()}`, 'QA');
    cleanup.push(async () => { await as(E.sara); await teams.deleteTeam(t.id, { moveMembers: true }).catch(() => null); });
    await expect(teams.createTeam(t.name.toUpperCase())).rejects.toMatchObject({ message: 'team_name_taken' });

    expect((await teams.movePersonToTeam(omarId, t.id)).moved).toBe(1);
    expect(await teams.setTeamLead(omarId)).toMatchObject({ role: 'manager', lead: true, team_id: t.id });
    const listed = (await teams.listTeams()).teams.find((x) => x.id === t.id);
    expect(listed).toMatchObject({ members: 1, leads: [expect.objectContaining({ user_id: omarId })] });

    await expect(teams.deleteTeam(t.id)).rejects.toMatchObject({ message: 'team_not_empty' });
    expect(await teams.deleteTeam(t.id, { moveMembers: true })).toMatchObject({ deleted: true, moved: 1, leads_unset: 1 });
  });

  it('an employee can not use the team tools', async () => {
    await as(E.amira);
    await expect(teams.listTeams()).rejects.toMatchObject({ message: 'not_authorized' });
  });
});

describe('broadcasts with audio', () => {
  it('HR schedules for later (nothing sent), cancels; a due one with audio reaches Amira, who can play it', async () => {
    await as(E.sara);
    const later = await bc.saveBroadcast({
      title_en: 'E2E later', body_en: 'x', scheduled_at: new Date(Date.now() + 3 * 3600e3).toISOString(),
    });
    expect(later.status).toBe('scheduled');
    expect(later.recipients).toBeNull();
    expect((await bc.cancelBroadcast(later.id)).status).toBe('cancelled');

    // Upload a tiny "mp3" into the company folder (node has no XHR: Storage API).
    const path = `${WH}/broadcasts/e2e-${Date.now()}.mp3`;
    const up = await emp.supabase.storage.from('company-media')
      .upload(path, new Blob([new Uint8Array(2048)], { type: 'audio/mpeg' }), { contentType: 'audio/mpeg' });
    expect(up.error).toBeNull();
    cleanup.push(async () => { await as(E.sara); await rt.removeCompanyMedia(path); });

    const q = await emp.supabase.rpc('hr_set_company_settings', { p_patch: { quiet_hours: false } });
    expect(q.error).toBeNull();
    cleanup.push(async () => { await as(E.sara); await emp.supabase.rpc('hr_set_company_settings', { p_patch: { quiet_hours: true } }); });
    const now = await bc.saveBroadcast({ title_en: 'E2E podcast', audio: { path, mime: 'audio/mpeg', duration_s: 12 } });
    expect(now).toMatchObject({ status: 'sent', has_audio: true, media_duration_s: 12 });
    expect(now.recipients).toBeGreaterThan(3);
    expect((await bc.listBroadcasts()).find((b) => b.id === now.id)).toMatchObject({ status: 'sent' });

    await as(E.amira);
    const { data: notes } = await emp.supabase.from('notifications').select('id, broadcast_id, title_en').eq('broadcast_id', now.id);
    expect(notes).toHaveLength(1);
    const audio = await bc.getBroadcastAudioUrl(now.id);
    expect(audio).toMatchObject({ mime: 'audio/mpeg', duration_s: 12 });
    const res = await fetch(audio.url, { headers: { Range: 'bytes=0-1' } });
    expect(res.status).toBe(206);
  });
});

describe('push subscription (no browser: the RPCs the lib calls)', () => {
  it('Amira saves and deletes a device; nobody else sees it', async () => {
    await as(E.amira);
    const endpoint = `https://fcm.googleapis.com/fcm/send/e2e-${Date.now()}`;
    const { data, error } = await emp.supabase.rpc('save_push_subscription', {
      p_sub: { endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) }, lang: 'en' },
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ endpoint, lang: 'en' });
    await as(E.omar);
    expect((await emp.supabase.from('push_subscriptions').select('id').eq('endpoint', endpoint)).data).toHaveLength(0);
    await as(E.amira);
    expect((await emp.supabase.from('push_subscriptions').select('id').eq('endpoint', endpoint)).data).toHaveLength(1);
    expect((await emp.supabase.rpc('delete_push_subscription', { p_endpoint: endpoint })).data).toBe(true);
  });

  it('send-reminders refuses a call without the cron secret', async () => {
    const r = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/send-reminders`, { method: 'POST', body: '{}' })
      .catch(() => null);
    if (!r || (r.status >= 500 && r.status !== 503)) return; // functions not served
    expect([401, 503]).toContain(r.status);
  });
});

describe('bulk exercise media', () => {
  it('HR sets a video on two exercises at once, matched by file name', async () => {
    await as(E.sara);
    const ours = (await rt.listExercises('company')).filter((e) => e.can_edit);
    const pick = ours.slice(0, 2);
    const { matched } = rt.matchFilesToExercises(pick.map((e) => `${e.name_en.replace(/\s+/g, '_')}.MP4`), ours);
    expect(Object.values(matched).sort()).toEqual(pick.map((e) => e.id).sort());
    const old = pick.map((e) => ({ id: e.id, media_type: e.media_type, media_bucket: e.media_bucket, media_path: e.media_path,
                                   media_mime: e.media_mime, media_youtube_id: e.media_youtube_id, poster_path: e.poster_path }));
    cleanup.push(async () => { await as(E.sara); await rt.setExercisesMedia(old); });
    const res = await rt.setExercisesMedia(Object.entries(matched).map(([file, id]) => ({
      id, media_type: 'video', media_bucket: 'company-media', media_path: `${WH}/exercises/${file}`, media_mime: 'video/mp4',
    })));
    expect(res).toEqual({ updated: 2, skipped: [] });
  });
});
