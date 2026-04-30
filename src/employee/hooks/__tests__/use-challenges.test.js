import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const unsubscribe = vi.fn();

vi.mock('../../../lib/supabase', () => ({
  getActiveChallenges: vi.fn(),
  joinChallenge: vi.fn(),
  getLeaderboard: vi.fn(),
  subscribeToLeaderboard: vi.fn(() => ({ unsubscribe })),
}));

import {
  getActiveChallenges, joinChallenge, getLeaderboard, subscribeToLeaderboard,
} from '../../../lib/supabase';
import { useChallenges } from '../use-challenges';

beforeEach(() => {
  vi.clearAllMocks();
  getActiveChallenges.mockResolvedValue([{ id: 'ch1', title_en: 'Move' }]);
  getLeaderboard.mockResolvedValue([{ rank: 1, user_id: 'u1' }]);
});

describe('useChallenges', () => {
  it('loads active challenges', async () => {
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.challenges).toHaveLength(1);
  });

  it('subscribes to leaderboard for the active challenge', async () => {
    const { unmount } = renderHook(() => useChallenges('ch1'));
    await waitFor(() => expect(getLeaderboard).toHaveBeenCalledWith('ch1'));
    expect(subscribeToLeaderboard).toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('joins a challenge', async () => {
    joinChallenge.mockResolvedValue({});
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.join('ch1'); });
    expect(joinChallenge).toHaveBeenCalledWith('ch1');
  });
});
