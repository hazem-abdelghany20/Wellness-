import { describe, it, expect } from 'vitest';
import { challengeDays, groupByWeek, challengeWeeks } from '../challenge-days.js';

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
