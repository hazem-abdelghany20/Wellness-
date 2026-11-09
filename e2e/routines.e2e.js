// Sprint 2 end-to-end: the real client libs (src/lib/supabase-routines.ts and the
// changed supabase-hr.ts) against the local stack with demo_seed_routines.sql
// loaded. LOCAL ONLY. Needs no edge functions:
//   eval "$(supabase status -o env | sed 's/^/export /')"
//   VITE_SUPABASE_URL=$API_URL VITE_SUPABASE_ANON_KEY=$ANON_KEY E2E_SERVICE_KEY=$SERVICE_ROLE_KEY \
//     npx vitest run --config vitest.e2e.config.js e2e/routines.e2e.js
// Leaves the database as it found it (unticks, un-hides, archives what it makes).
import { describe, it, expect, afterAll } from 'vitest';
import * as emp from '../src/lib/supabase.ts';
import * as hr from '../src/lib/supabase-hr.ts';
import * as rt from '../src/lib/supabase-routines.ts';

const WH = '00000000-0000-0000-0000-000000000001';
const E = {
  amira: 'amira.hassan@demo.wellhouse.test',
  omar: 'omar.sami@demo.wellhouse.test',
  sara: 'sara.hr@demo.wellhouse.test',
};
const as = async (email) => { await emp.signOut(); rt.clearMediaUrlCache(); return emp.signInOrUpWithPassword(email, 'ignored-for-demo'); };
const cleanup = [];
afterAll(async () => { for (const f of cleanup.reverse()) { try { await f(); } catch { /* best effort */ } } });

describe('employee: Today', () => {
  it('Amira sees today\'s routine and can tick and untick an item', async () => {
    await as(E.amira);
    const today = await rt.getMyToday();
    expect(today.assigned).toBe(true);
    if (!today.is_workday) return; // Fri / Sat: nothing due
    expect(today.items.length).toBeGreaterThan(0);
    const item = today.items.find((i) => !i.checked);
    const after = await rt.checkRoutineItem(item.id);
    expect(after.progress.done).toBe(today.progress.done + 1);
    expect(after.items.find((i) => i.id === item.id).checked).toBe(true);
    const back = await rt.checkRoutineItem(item.id, false);
    expect(back.progress.done).toBe(today.progress.done);
  });

  it('week view has Sun–Thu and the routines with their notes', async () => {
    const week = await rt.getMyRoutineWeek();
    expect(week.days).toHaveLength(5);
    expect(week.routines.map((r) => r.title_en).sort()).toEqual(['Desk Day', 'Weekly split']);
  });

  it('the board names only people who opted in', async () => {
    await as(E.omar);
    const board = await rt.getRecognitionBoard('week');
    expect(board.enabled).toBe(true);
    expect(board.me.opted_in).toBe(false);
    const names = JSON.stringify(board.named);
    expect(names).not.toMatch(/Omar|Yusuf|Sara/);
    expect(board.teams).toEqual([]); // every demo team is under 5 people
  });
});

describe('HR: library, report, people', () => {
  it('report is aggregate and groups the small teams', async () => {
    await as(E.sara);
    const r = await rt.getRoutineReport('14d');
    expect(r.has_routine).toBe(true);
    expect(r.by_team).toHaveLength(1);
    expect(r.by_team[0].small).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/Amira|Yusuf|Lina|Omar|Nadia|Sara/);
    expect(r.by_exercise.length).toBeGreaterThan(5);
  });

  it('people view lists only those who share with HR', async () => {
    const p = await rt.getRoutinePeople('14d');
    expect(p.enabled).toBe(true);
    expect(p.people.map((x) => x.display_name).sort()).toEqual(['Amira Hassan', 'Yusuf Naguib']);
  });

  it('HR adds an exercise with a YouTube link, then archives it', async () => {
    const ex = await rt.saveExercise({
      name_en: 'E2E shoulder shrug', name_ar: 'هز الكتف', body_areas: ['shoulders'],
      default_sets_reps: '2 × 10', media_type: 'youtube', media_youtube_id: rt.youtubeIdFrom('https://youtu.be/dQw4w9WgXcQ'),
    });
    cleanup.push(() => rt.setLibraryStatus('exercise', ex.id, 'archived'));
    expect(ex.company_id).toBe(WH);
    const ours = await rt.listExercises('company');
    expect(ours.some((x) => x.id === ex.id && x.scope === 'company' && x.can_edit)).toBe(true);
  });

  it('HR cannot edit a public article; unpublishing hides it for this company only', async () => {
    const lib = await hr.getContentLibrary();
    const target = lib.find((i) => i.scope === 'public' && i.published);
    await expect(hr.updateContentItem(target.id, { title_en: 'x' })).rejects.toThrow('public_item_read_only');
    const hidden = await hr.updateContentItem(target.id, { status: 'draft' });
    cleanup.push(() => hr.updateContentItem(target.id, { status: 'published' }));
    expect(hidden.status).toBe('hidden');
    await as(E.amira);
    const { data } = await emp.supabase.from('content_items').select('id').eq('id', target.id);
    expect(data).toHaveLength(0);
    await as(E.sara);
    await hr.updateContentItem(target.id, { status: 'published' });
    await as(E.amira);
    const { data: again } = await emp.supabase.from('content_items').select('id').eq('id', target.id);
    expect(again).toHaveLength(1);
    await as(E.sara);
  });
});

describe('company media', () => {
  it('HR uploads into the company folder; an employee plays it through a signed URL with range requests', async () => {
    await as(E.sara);
    const path = `${WH}/exercises/e2e-${Date.now()}.mp4`;
    const { error } = await emp.supabase.storage.from('company-media')
      .upload(path, new Blob([new Uint8Array(4096)], { type: 'video/mp4' }), { contentType: 'video/mp4' });
    expect(error).toBeNull();
    cleanup.push(async () => { await as(E.sara); await rt.removeCompanyMedia(path); });

    await as(E.amira);
    const url = await rt.getMediaUrl({ bucket: 'company-media', path });
    expect(url).toMatch(/token=/);
    expect(await rt.getMediaUrl({ bucket: 'company-media', path })).toBe(url); // reused, not re-signed
    const res = await fetch(url, { headers: { Range: 'bytes=0-1' } });
    expect(res.status).toBe(206);

    const media = await rt.resolveMedia({ media_type: 'video', media_bucket: 'company-media', media_path: path, media_mime: 'video/mp4' });
    expect(media.media_url).toBe(url);
  });
});
