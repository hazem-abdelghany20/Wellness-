import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  listGiftPools: vi.fn(),
  listCompanyAwardedRewards: vi.fn(),
  listGiftCatalog: vi.fn(),
}));

import {
  listGiftPools, listCompanyAwardedRewards, listGiftCatalog,
} from '../../../lib/supabase-hr';
import { useGiftsOverview } from '../use-gifts';

beforeEach(() => {
  vi.clearAllMocks();
  listGiftPools.mockResolvedValue([]);
  listCompanyAwardedRewards.mockResolvedValue([]);
  listGiftCatalog.mockResolvedValue([]);
});

describe('useGiftsOverview', () => {
  it('aggregates budget across pools and computes remaining', async () => {
    listGiftPools.mockResolvedValue([
      { id: '1', budget_minor: 10000, spent_minor: 3000, currency: 'EGP', active: true },
      { id: '2', budget_minor: 20000, spent_minor: 5000, currency: 'EGP', active: true },
    ]);
    const { result } = renderHook(() => useGiftsOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats.totalBudget).toBe(30000);
    expect(result.current.stats.totalSpent).toBe(8000);
    expect(result.current.stats.remaining).toBe(22000);
    expect(result.current.stats.currency).toBe('EGP');
    expect(result.current.stats.activePools).toBe(2);
  });

  it('counts awarded rewards by status', async () => {
    listCompanyAwardedRewards.mockResolvedValue([
      { id: 'a', status: 'ready' },
      { id: 'b', status: 'ready' },
      { id: 'c', status: 'claimed' },
      { id: 'd', status: 'fulfilled' },
    ]);
    const { result } = renderHook(() => useGiftsOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats.awarded).toBe(4);
    expect(result.current.stats.readyToClaim).toBe(2);
    expect(result.current.stats.pendingFulfillment).toBe(1);
    expect(result.current.stats.fulfilled).toBe(1);
  });

  it('clamps remaining to zero if spend exceeds budget', async () => {
    listGiftPools.mockResolvedValue([
      { id: '1', budget_minor: 1000, spent_minor: 1500, currency: 'EGP', active: true },
    ]);
    const { result } = renderHook(() => useGiftsOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats.remaining).toBe(0);
  });

  it('surfaces errors and stops loading', async () => {
    listGiftPools.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useGiftsOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
