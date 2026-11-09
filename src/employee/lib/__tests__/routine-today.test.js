import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../lib/supabase', () => ({ supabase: {}, resolveMyCompanyId: vi.fn() }));

import {
  routineDayPoints, nextItemId, applyTick, applyPending, withClock, companyClock, fmtTime,
  fmtDateLong, todayFocus, sourceFileOf, routineWeekPoints, bodyAreasText, hasMedia, pick, ROUTINE_FULL_WEEK,
} from '../routine-today.js';
import { makeToday, item } from '../../test-fixtures/routine.js';

describe('routineDayPoints', () => {
  it('gives 2 per item, capped at 20, plus 10 for a full day', () => {
    expect(routineDayPoints(0, 4)).toBe(0);
    expect(routineDayPoints(3, 4)).toBe(6);
    expect(routineDayPoints(4, 4)).toBe(18);
    expect(routineDayPoints(12, 12)).toBe(30);
    expect(routineDayPoints(11, 12)).toBe(20);
    expect(routineDayPoints(0, 0)).toBe(0);
    expect(ROUTINE_FULL_WEEK).toBe(150);
  });
});

describe('nextItemId', () => {
  const items = [
    item('a', '08:30', 'A', null, null, { checked: true }),
    item('b', '10:00', 'B', null, null),
    item('c', '11:30', 'C', null, null),
    item('d', null, 'D', null, null),
  ];
  it('picks the soonest unticked item still ahead', () => {
    expect(nextItemId(items, '10:30')).toBe('c');
    expect(nextItemId(items, '09:00')).toBe('b');
    expect(nextItemId(items, '10:00')).toBe('b');
  });
  it('then untimed items, then the earliest past one', () => {
    expect(nextItemId(items, '12:00')).toBe('d');
    expect(nextItemId(items.slice(0, 3), '12:00')).toBe('b');
  });
  it('is null when everything is ticked', () => {
    expect(nextItemId(items.map((i) => ({ ...i, checked: true })), '10:00')).toBeNull();
  });
});

describe('applyTick / applyPending', () => {
  it('ticks one item and recomputes progress, points and next', () => {
    const s = makeToday();
    const t = applyTick(s, 'i3', true);
    expect(t.items.find((i) => i.id === 'i3').checked).toBe(true);
    expect(t.progress).toMatchObject({ done: 2, total: 4, pct: 50, all_done: false, points: 4 });
    expect(t.next_item_id).toBe('i4');
    expect(s.items.find((i) => i.id === 'i3').checked).toBe(false); // not mutated
  });
  it('unticking a past item makes it next again when nothing is ahead', () => {
    const s = makeToday({ now: '13:00' });
    const t = applyTick(applyTick(applyTick(s, 'i2', true), 'i3', true), 'i4', true);
    expect(t.progress.all_done).toBe(true);
    expect(t.progress.points).toBe(18);
    expect(t.next_item_id).toBeNull();
    expect(applyTick(t, 'i2', false).next_item_id).toBe('i2');
  });
  it('ignores unknown items', () => {
    const s = makeToday();
    expect(applyTick(s, 'nope', true)).toBe(s);
  });
  it('layers every pending tick over the server state', () => {
    const s = makeToday();
    const out = applyPending(s, new Map([['i2', { checked: true }], ['i1', { checked: false }]]));
    expect(out.items.map((i) => i.checked)).toEqual([false, true, false, false]);
    expect(applyPending(s, new Map())).toBe(s);
  });
});

describe('withClock', () => {
  it('moves "past" and "next" on as time passes', () => {
    const s = makeToday();
    const later = withClock(s, '11:45');
    expect(later.items.find((i) => i.id === 'i3').is_past).toBe(true);
    expect(later.next_item_id).toBe('i4');
    expect(withClock(s, null)).toBe(s);
    expect(withClock(s, s.now)).toBe(s);
  });
});

describe('companyClock', () => {
  it('uses the company zone, summer and winter time included', () => {
    // 23:30 UTC on Sun 1 Nov 2026 is already Monday 01:30 in Cairo (UTC+2 in winter).
    expect(companyClock('Africa/Cairo', new Date('2026-11-01T23:30:00Z'))).toEqual({ date: '2026-11-02', time: '01:30' });
    // In July Cairo is UTC+3.
    expect(companyClock('Africa/Cairo', new Date('2026-07-05T22:15:00Z'))).toEqual({ date: '2026-07-06', time: '01:15' });
  });
  it('is null for an unknown zone', () => {
    expect(companyClock('Not/AZone', new Date())).toBeNull();
    expect(companyClock(null)).toBeNull();
  });
});

describe('text helpers', () => {
  it('formats times with Arabic digits in Arabic', () => {
    expect(fmtTime('09:30', 'en')).toBe('09:30');
    expect(fmtTime('09:30', 'ar')).toBe('٠٩:٣٠');
    expect(fmtTime(null, 'en')).toBe('');
  });
  it('formats the date in both languages', () => {
    expect(fmtDateLong('2026-11-10', 'en')).toMatch(/Tuesday/);
    expect(fmtDateLong('2026-11-10', 'ar')).toMatch(/الثلاثاء/);
  });
  it('reads today’s focus from the first routine that has one', () => {
    const s = makeToday();
    expect(todayFocus(s, 'en')).toBe('Upper body');
    expect(todayFocus(s, 'ar')).toBe('الجزء العلوي');
    expect(todayFocus({ routines: [{ day_title: null }] }, 'en')).toBe('');
  });
  it('picks Arabic with an English fallback', () => {
    expect(pick({ how_en: 'Hold', how_ar: '' }, 'how', 'ar')).toBe('Hold');
    expect(pick({ how_en: 'Hold', how_ar: 'اثبت' }, 'how', 'ar')).toBe('اثبت');
  });
  it('labels body areas and spots media', () => {
    const e = makeToday().items[1].exercise;
    expect(bodyAreasText(e, 'en')).toBe('Neck, Shoulders');
    expect(bodyAreasText(e, 'ar')).toBe('الرقبة، الكتف');
    expect(hasMedia(e)).toBe(true);
    expect(hasMedia({ media_type: 'youtube', media_youtube_id: null })).toBe(false);
    expect(hasMedia(null)).toBe(false);
  });
  it('finds the original table and whether it is a PDF', () => {
    expect(sourceFileOf([{ source_file_path: null }])).toBeNull();
    expect(sourceFileOf([{ source_file_path: 'c1/routines/plan.pdf', source_file_bucket: 'company-media', source_file_mime: 'application/pdf' }]))
      .toEqual({ bucket: 'company-media', path: 'c1/routines/plan.pdf', mime: 'application/pdf', kind: 'pdf' });
    expect(sourceFileOf([{ source_file_path: 'c1/routines/plan.jpg', source_file_mime: 'image/jpeg' }]).kind).toBe('image');
  });
});

describe('routineWeekPoints', () => {
  it('takes item points from the week total so the daily cap is respected', () => {
    // 12 ticks on one day (cap → 20) + 1 full day (10) + 2 challenge days (20) = 50.
    const me = { week: 50, week_parts: { habit_days: 2, weeks_done: 0, articles: 0, routine_items: 12, routine_full_days: 1 } };
    expect(routineWeekPoints(me)).toEqual({ items: 12, fullDays: 1, itemPoints: 20, fullDayPoints: 10 });
  });
  it('is zero without routine parts', () => {
    expect(routineWeekPoints({ week: 30, week_parts: { habit_days: 3, weeks_done: 0, articles: 0 } }))
      .toEqual({ items: 0, fullDays: 0, itemPoints: 0, fullDayPoints: 0 });
    expect(routineWeekPoints(null).items).toBe(0);
  });
});
