import { describe, it, expect } from 'vitest';
import { tierFor, TIER_THRESHOLDS } from '../tiers.js';

describe('tierFor', () => {
  it('returns bronze at streak 0 with progress 0', () => {
    const r = tierFor(0);
    expect(r.tier).toBe('bronze');
    expect(r.progress).toBe(0);
    expect(r.next).toBe('silver');
    expect(r.daysToNext).toBe(TIER_THRESHOLDS.silver);
  });

  it('stays bronze just below the silver threshold', () => {
    const r = tierFor(TIER_THRESHOLDS.silver - 1);
    expect(r.tier).toBe('bronze');
    expect(r.daysToNext).toBe(1);
  });

  it('promotes to silver at the silver threshold', () => {
    const r = tierFor(TIER_THRESHOLDS.silver);
    expect(r.tier).toBe('silver');
    expect(r.progress).toBe(0);
    expect(r.next).toBe('gold');
    expect(r.daysToNext).toBe(TIER_THRESHOLDS.gold - TIER_THRESHOLDS.silver);
  });

  it('reports mid-tier silver progress correctly', () => {
    const mid = TIER_THRESHOLDS.silver + (TIER_THRESHOLDS.gold - TIER_THRESHOLDS.silver) / 2;
    const r = tierFor(mid);
    expect(r.tier).toBe('silver');
    expect(r.progress).toBeCloseTo(0.5, 5);
  });

  it('promotes to gold at the gold threshold and caps progress at 1', () => {
    const r = tierFor(TIER_THRESHOLDS.gold);
    expect(r.tier).toBe('gold');
    expect(r.progress).toBe(1);
    expect(r.next).toBeNull();
    expect(r.daysToNext).toBe(0);
  });

  it('stays gold for arbitrarily long streaks', () => {
    const r = tierFor(TIER_THRESHOLDS.gold + 365);
    expect(r.tier).toBe('gold');
    expect(r.progress).toBe(1);
  });

  it('treats negative or NaN inputs as 0 (defensive)', () => {
    expect(tierFor(-5).tier).toBe('bronze');
    expect(tierFor(-5).progress).toBe(0);
    expect(tierFor(NaN).tier).toBe('bronze');
    expect(tierFor(undefined).tier).toBe('bronze');
  });
});
