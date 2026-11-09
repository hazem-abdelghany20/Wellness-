import { describe, it, expect } from 'vitest';
import { employeeTourSteps } from '../tour-steps.js';

describe('employeeTourSteps', () => {
  it('starts on Today (watch + tick) when a routine is assigned', () => {
    const steps = employeeTourSteps(true);
    expect(steps.map((s) => s.screen)).toEqual(['today', 'today', 'challenges', 'library', 'score', 'profile']);
  });
  it('leaves Today out when there is no routine', () => {
    const steps = employeeTourSteps(false);
    expect(steps.map((s) => s.screen)).toEqual(['challenges', 'library', 'score', 'profile']);
    expect(steps.some((s) => s.screen === 'today')).toBe(false);
  });
  it('covers the board, privacy, language and help', () => {
    const text = employeeTourSteps(true).map((s) => `${s.body_en} ${s.title_en}`).join(' ');
    expect(text).toMatch(/board/);
    expect(text).toMatch(/Arabic/);
    expect(text).toMatch(/guide/);
    expect(text).toMatch(/HR/);
  });
});
