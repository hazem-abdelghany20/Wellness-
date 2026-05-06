import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  listMyAwardedRewards: vi.fn(),
  claimMyReward: vi.fn(),
}));

import { listMyAwardedRewards, claimMyReward } from '../../../lib/supabase';
import { useWallet } from '../use-wallet';

const mkReward = (over = {}) => ({
  id: crypto.randomUUID(),
  profile_id: 'u1',
  company_id: 'c1',
  competition_id: null,
  tier: 'silver',
  chosen_item_id: null,
  status: 'ready',
  fulfillment_method: 'manual',
  notes: null,
  awarded_at: '2026-04-01T10:00:00Z',
  claimed_at: null,
  fulfilled_at: null,
  chosen_item: null,
  ...over,
});

beforeEach(() => { vi.clearAllMocks(); });

describe('useWallet', () => {
  it('loads rewards on mount', async () => {
    listMyAwardedRewards.mockResolvedValue([mkReward()]);
    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rewards).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('groups rewards by status', async () => {
    listMyAwardedRewards.mockResolvedValue([
      mkReward({ status: 'ready' }),
      mkReward({ status: 'claimed' }),
      mkReward({ status: 'fulfilled' }),
      mkReward({ status: 'ready' }),
    ]);
    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.grouped.ready).toHaveLength(2);
    expect(result.current.grouped.claimed).toHaveLength(1);
    expect(result.current.grouped.fulfilled).toHaveLength(1);
  });

  it('sorts rewards: ready first, then claimed, then fulfilled', async () => {
    listMyAwardedRewards.mockResolvedValue([
      mkReward({ status: 'fulfilled' }),
      mkReward({ status: 'claimed' }),
      mkReward({ status: 'ready' }),
    ]);
    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rewards.map(r => r.status)).toEqual(['ready', 'claimed', 'fulfilled']);
  });

  it('within a status bucket, newest awarded first', async () => {
    listMyAwardedRewards.mockResolvedValue([
      mkReward({ status: 'ready', awarded_at: '2026-01-01T00:00:00Z', tier: 'bronze' }),
      mkReward({ status: 'ready', awarded_at: '2026-04-01T00:00:00Z', tier: 'silver' }),
      mkReward({ status: 'ready', awarded_at: '2026-02-15T00:00:00Z', tier: 'gold' }),
    ]);
    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rewards.map(r => r.tier)).toEqual(['silver', 'gold', 'bronze']);
  });

  it('surfaces errors and stops loading', async () => {
    listMyAwardedRewards.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.rewards).toEqual([]);
  });

  it('returns empty buckets when there are no rewards', async () => {
    listMyAwardedRewards.mockResolvedValue([]);
    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.grouped).toEqual({ ready: [], claimed: [], fulfilled: [] });
  });

  it('claim() calls the RPC with reward + chosen item then refetches', async () => {
    listMyAwardedRewards
      .mockResolvedValueOnce([mkReward({ id: 'r1', status: 'ready' })])
      .mockResolvedValueOnce([mkReward({ id: 'r1', status: 'claimed' })]);
    claimMyReward.mockResolvedValue({ id: 'r1', status: 'claimed' });
    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.claim('r1', 'item-7'); });
    expect(claimMyReward).toHaveBeenCalledWith('r1', 'item-7');
    expect(result.current.rewards[0].status).toBe('claimed');
  });
});
