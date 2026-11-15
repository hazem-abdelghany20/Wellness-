// Sprint 4 end-to-end: the real client libs against the local stack with
// demo_seed_routines.sql loaded. LOCAL ONLY.
//   eval "$(supabase status -o env | sed 's/^/export /')"
//   VITE_SUPABASE_URL=$API_URL VITE_SUPABASE_ANON_KEY=$ANON_KEY E2E_SERVICE_KEY=$SERVICE_ROLE_KEY \
//     npx vitest run --config vitest.e2e.config.js e2e/sprint4.e2e.js
// Leaves the database as it found it (ends / shows / switches back what it changes).
import { describe, it, expect, afterAll } from 'vitest';
import * as emp from '../src/lib/supabase.ts';
import * as rt from '../src/lib/supabase-routines.ts';
import * as hr from '../src/lib/supabase-hr.ts';

const DESK = '00000000-0000-0000-0021-000000000001';
const E = {
  amira: 'amira.hassan@demo.wellhouse.test',
  omar: 'omar.sami@demo.wellhouse.test',
  sara: 'sara.hr@demo.wellhouse.test',
};
const as = async (email) => { await emp.signOut(); rt.clearMediaUrlCache(); return emp.signInOrUpWithPassword(email, 'ignored-for-demo'); };
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const cleanup = [];
afterAll(async () => { for (const f of cleanup.reverse()) { try { await f(); } catch { /* best effort */ } } });

describe('hide a routine row', () => {
  it('HR hides one row: it leaves Today; showing it brings it back; saving the routine keeps it hidden', async () => {
    await as(E.amira);
    const before = await rt.getMyToday();
    if (!before.is_workday) return;
    const target = before.items.find((i) => i.routine_id === DESK && !i.checked);
    expect(target).toBeTruthy();

    await expect(rt.setRoutineItemHidden(target.id, true)).rejects.toMatchObject({ code: '42501' });

    await as(E.sara);
    cleanup.push(async () => { await as(E.sara); await rt.setRoutineItemHidden(target.id, false); });
    const hidden = await rt.setRoutineItemHidden(target.id, true);
    expect(hidden.items.find((i) => i.id === target.id).hidden_at).toBeTruthy();
    // Saving the routine as the builder does (rows by id) must not un-hide it.
    const saved = await rt.saveRoutine({
      id: DESK,
      items: hidden.items.map((i) => ({
        id: i.id, exercise_id: i.exercise_id, title_en: i.title_en, title_ar: i.title_ar, weekday: i.weekday,
        at_time: i.at_time, sets_reps: i.sets_reps, sets_reps_ar: i.sets_reps_ar, note_en: i.note_en,
        note_ar: i.note_ar, sort_order: i.sort_order,
      })),
    });
    expect(saved.items.find((i) => i.id === target.id).hidden_at).toBeTruthy();

    await as(E.amira);
    const during = await rt.getMyToday();
    expect(during.items.some((i) => i.id === target.id)).toBe(false);
    expect(during.progress.total).toBe(before.progress.total - 1);
    await expect(rt.checkRoutineItem(target.id)).rejects.toMatchObject({ message: 'item_not_due_today' });

    await as(E.sara);
    const shown = await rt.setRoutineItemHidden(target.id, false);
    expect(shown.items.find((i) => i.id === target.id).hidden_at).toBeNull();
    await as(E.amira);
    expect((await rt.getMyToday()).progress.total).toBe(before.progress.total);
  });
});

describe('several challenges at once', () => {
  it('HR runs a dated challenge and one built from routine rows; ticks count by themselves', async () => {
    await as(E.amira);
    const today0 = await rt.getMyToday();
    if (!today0.is_workday) return;
    const day = today0.date;
    const [a, b] = today0.items.filter((i) => i.routine_id === DESK && !i.checked);
    expect(b).toBeTruthy();
    const listBefore = await emp.getMyHabitChallenges();
    await expect(hr.scheduleChallenge({ title_en: 'x', startDate: day })).rejects.toMatchObject({ code: '42501' });

    await as(E.sara);
    // A same-day template (a 'next_morning' one is logged the morning after).
    const tpl = (await hr.listHabitTemplates()).find((x) => x.payload?.check_mode !== 'next_morning');
    expect(tpl).toBeTruthy();
    const made = [];
    cleanup.push(async () => { await as(E.sara); for (const id of made) await hr.cancelHabitChallenge(id).catch(() => null); });

    // 3 calendar days from today; only Sun–Thu count.
    const dated = await hr.scheduleChallenge({ templateId: tpl.id, startDate: day, endDate: addDays(day, 2) });
    made.push(dated.id);
    expect(dated.workdays).toBeGreaterThanOrEqual(1);
    expect(dated.workdays).toBeLessThanOrEqual(3);
    expect(dated.success_days).toBeLessThanOrEqual(dated.workdays);
    await expect(hr.scheduleChallenge({ templateId: tpl.id, startDate: day, endDate: addDays(day, 2) }))
      .rejects.toMatchObject({ message: 'habit_week_taken' });
    await expect(hr.scheduleChallenge({ templateId: tpl.id, startDate: day, endDate: addDays(day, 60) }))
      .rejects.toMatchObject({ message: 'bad_dates' });
    await expect(hr.scheduleChallenge({ title_en: 'No workdays', action_en: 'x', startDate: '2030-01-04', endDate: '2030-01-05' }))
      .rejects.toMatchObject({ message: 'no_workdays' });

    const auto = await hr.scheduleChallenge({
      title_en: `E2E two stretches ${Date.now()}`, title_ar: 'تمرينين', routineItemIds: [a.id, b.id],
      startDate: day, endDate: addDays(day, 4),
    });
    made.push(auto.id);
    expect(auto.payload.routine_item_ids.sort()).toEqual([a.id, b.id].sort());
    expect(auto.description_en).toMatch(/Tick these/);

    await as(E.amira);
    const list = await emp.getMyHabitChallenges();
    expect(list.length).toBe(listBefore.length + 2);
    const mine = (id) => list.find((c) => c.challenge.id === id);
    expect(mine(dated.id)).toMatchObject({ status: 'active', auto_from_routine: false, can_log: true });
    expect(mine(dated.id).days).toHaveLength(dated.workdays);
    expect(mine(auto.id)).toMatchObject({ status: 'active', auto_from_routine: true, can_log: false, my_count: 0 });
    expect(mine(auto.id).routine_items.map((i) => i.id).sort()).toEqual([a.id, b.id].sort());

    // Everyone it is for got a note.
    const { data: notes } = await emp.supabase.from('notifications').select('title_en')
      .like('title_en', 'New challenge:%').order('created_at', { ascending: false }).limit(5);
    expect(notes.map((n) => n.title_en)).toEqual(expect.arrayContaining([`New challenge: ${auto.title_en}`]));

    // Manual log on the dated one; refused on the automatic one.
    expect((await emp.logHabit(dated.id, true)).status).not.toBe('none');
    await expect(emp.logHabit(auto.id, true)).rejects.toMatchObject({ message: 'challenge_is_automatic' });

    const state = async () => (await emp.getMyHabitChallenges()).find((c) => c.challenge.id === auto.id);
    await rt.checkRoutineItem(a.id, true);
    expect(await state()).toMatchObject({ my_count: 0, logged_target: false });
    await rt.checkRoutineItem(b.id, true);
    const done = await state();
    expect(done).toMatchObject({ my_count: 1, logged_target: true });
    expect(done.routine_items.every((i) => i.checked && i.due_today)).toBe(true);
    await rt.checkRoutineItem(a.id, false);
    expect(await state()).toMatchObject({ my_count: 0, logged_target: false });
    await rt.checkRoutineItem(b.id, false);
    await emp.logHabit(dated.id, false);

    // HR ends both while they run; they leave the employee's list.
    await as(E.sara);
    await hr.cancelHabitChallenge(dated.id);
    await hr.cancelHabitChallenge(auto.id);
    await expect(hr.cancelHabitChallenge(auto.id)).rejects.toMatchObject({ message: 'only_upcoming_can_be_cancelled' });
    await as(E.amira);
    expect(await emp.getMyHabitChallenges()).toHaveLength(listBefore.length);
  });
});

describe('everyone takes part', () => {
  it('the company switch puts everyone on the board and in HR’s people list, and back', async () => {
    await as(E.omar);
    const omarId = (await emp.supabase.auth.getUser()).data.user.id;
    expect((await rt.getRecognitionBoard('week')).me.opted_in).toBe(false);
    await expect(rt.setCompanySettings({ everyone_visible: true })).rejects.toMatchObject({ code: '42501' });

    await as(E.sara);
    const peopleBefore = await rt.getRoutinePeople('14d');
    expect(peopleBefore.people.some((p) => p.user_id === omarId)).toBe(false);
    cleanup.push(async () => { await as(E.sara); await rt.setCompanySettings({ everyone_visible: false }); });
    const on = await rt.setCompanySettings({ everyone_visible: true });
    expect(on).toMatchObject({ everyone_visible: true, hr_people_view: true });
    const people = await rt.getRoutinePeople('14d');
    expect(people).toMatchObject({ enabled: true, everyone: true, not_shared: 0 });
    expect(people.people.some((p) => p.user_id === omarId)).toBe(true);

    await as(E.omar);
    const board = await rt.getRecognitionBoard('week');
    expect(board.me.opted_in).toBe(true);
    expect(board.named.opted_in).toBe(people.people.length);
    const prefs = await rt.getMyPrefs();
    expect(prefs.company.everyone_visible).toBe(true);
    expect(prefs.recognition_opt_in).toBe(false); // their own choice is untouched
    const seen = await rt.setMyPrefs({ visibility_notice_seen: true });
    expect(seen.visibility_notice_seen_at).toBeTruthy();
    cleanup.push(async () => {
      await emp.signOut();
      const key = process.env.E2E_SERVICE_KEY;
      if (key) {
        await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/profile_prefs?user_id=eq.${omarId}`, {
          method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ visibility_notice_seen_at: null }),
        });
      }
    });

    await as(E.sara);
    expect(await rt.setCompanySettings({ everyone_visible: false })).toMatchObject({ everyone_visible: false });
    expect((await rt.getRoutinePeople('14d')).people.some((p) => p.user_id === omarId)).toBe(false);
    await as(E.omar);
    expect((await rt.getRecognitionBoard('week')).me.opted_in).toBe(false);
  });
});
