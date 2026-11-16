import { describe, it, expect } from 'vitest';
import { challengeDays, groupByWeek, challengeWeeks, dotRows, challengeDayOf } from '../challenge-days.js';

const twoWeeks = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12',
  '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'];

describe('challengeDays', () => {
  it('uses the server’s days as they are', () => {
    expect(challengeDays({ days: twoWeeks, challenge: { start_date: '2026-11-08', end_date: '2026-11-19' } })).toEqual(twoWeeks);
  });
  it('without days, lists only Sun–Thu between start and end (never start + i)', () => {
    const days = challengeDays({ challenge: { start_date: '2026-11-08', end_date: '2026-11-19' } });
    expect(days).toEqual(twoWeeks);
    expect(days).not.toContain('2026-11-13'); // Friday
    expect(days).not.toContain('2026-11-14'); // Saturday
  });
  it('is empty without a challenge', () => {
    expect(challengeDays({ status: 'none' })).toEqual([]);
    expect(challengeDays(null)).toEqual([]);
  });
});

describe('groupByWeek / challengeWeeks', () => {
  it('groups days into Sunday weeks', () => {
    const weeks = groupByWeek(twoWeeks);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toEqual({ weekStart: '2026-11-08', days: twoWeeks.slice(0, 5) });
    expect(weeks[1].weekStart).toBe('2026-11-15');
  });
  it('reads weeks from the server, else counts them', () => {
    expect(challengeWeeks({ weeks: 3, days: twoWeeks })).toBe(3);
    expect(challengeWeeks({ days: twoWeeks })).toBe(2);
    expect(challengeWeeks({ days: twoWeeks.slice(0, 5) })).toBe(1);
  });
});

describe('dotRows (custom dates)', () => {
  it('one week of 5 is one row of 5, as before', () => {
    expect(dotRows(twoWeeks.slice(0, 5))).toEqual([{ weekStart: '2026-11-08', slots: twoWeeks.slice(0, 5) }]);
  });
  it('a 3-day challenge is one row of 3 dots, no empty slots', () => {
    const three = ['2026-11-09', '2026-11-10', '2026-11-11']; // Mon–Wed
    expect(dotRows(three)).toEqual([{ weekStart: '2026-11-08', slots: three }]);
  });
  it('a 23-day challenge lines up under Sun…Thu, with gaps where it starts and ends mid-week', () => {
    // Tue 3 Nov → Thu 3 Dec 2026: 3 + 5 + 5 + 5 + 5 workdays.
    const days = challengeDays({ challenge: { start_date: '2026-11-03', end_date: '2026-12-03' } });
    expect(days).toHaveLength(23);
    const rows = dotRows(days);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.slots.length === 5)).toBe(true);
    expect(rows[0]).toEqual({ weekStart: '2026-11-01', slots: [null, null, '2026-11-03', '2026-11-04', '2026-11-05'] });
    expect(rows[1].slots).toEqual(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
    expect(rows.flatMap((r) => r.slots).filter(Boolean)).toEqual(days); // every day once, in order
  });
  it('a challenge that ends on a Monday leaves the rest of the last row empty', () => {
    const days = challengeDays({ challenge: { start_date: '2026-11-08', end_date: '2026-11-16' } }); // 7 days
    const rows = dotRows(days);
    expect(rows).toHaveLength(2);
    expect(rows[1].slots).toEqual(['2026-11-15', '2026-11-16', null, null, null]);
  });
  it('is empty without days', () => {
    expect(dotRows([])).toEqual([]);
    expect(dotRows(null)).toEqual([]);
  });
});

describe('challengeDayOf', () => {
  it('reads "day X of Y" from the server', () => {
    expect(challengeDayOf({ status: 'active', days: twoWeeks, elapsed: 3, days_total: 10 })).toEqual({ day: 3, total: 10 });
  });
  it('counts from the days when the server sends no elapsed', () => {
    expect(challengeDayOf({ status: 'active', days: twoWeeks, target_date: '2026-11-15' })).toEqual({ day: 6, total: 10 });
    // A weekend inside the challenge: still the last workday done.
    expect(challengeDayOf({ status: 'active', days: twoWeeks, target_date: '2026-11-14' })).toEqual({ day: 5, total: 10 });
  });
  it('stays between 1 and the total while it runs, 0 before it starts', () => {
    expect(challengeDayOf({ status: 'active', days: twoWeeks.slice(0, 3), elapsed: 0 })).toEqual({ day: 1, total: 3 });
    expect(challengeDayOf({ status: 'active', days: twoWeeks.slice(0, 3), elapsed: 9 })).toEqual({ day: 3, total: 3 });
    expect(challengeDayOf({ status: 'upcoming', days: twoWeeks.slice(0, 3), elapsed: 0 })).toEqual({ day: 0, total: 3 });
  });
  it('is null without days', () => {
    expect(challengeDayOf({ status: 'none' })).toBeNull();
    expect(challengeDayOf(null)).toBeNull();
  });
});
