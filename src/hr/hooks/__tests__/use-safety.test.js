import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({ getTeamAggregates: vi.fn() }));

import { getTeamAggregates } from '../../../lib/supabase-hr';
import { useSafety } from '../use-safety';

beforeEach(() => {
  vi.clearAllMocks();
  getTeamAggregates.mockResolvedValue([
    { team_id: 't1', team_name: 'Eng', avg_stress: 7.5, has_signal: true },
    { team_id: 't2', team_name: 'Fin', avg_stress: 4.0, has_signal: true },
    { team_id: 't3', team_name: 'Tiny', has_signal: false },
  ]);
});

describe('useSafety', () => {
  it('flags teams with avg_stress >= 7 and has_signal=true as high risk', async () => {
    const { result } = renderHook(() => useSafety());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.highRisk).toHaveLength(1);
    expect(result.current.highRisk[0].team_id).toBe('t1');
  });

  it('excludes teams under the privacy floor', async () => {
    const { result } = renderHook(() => useSafety());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.highRisk.find(t => t.team_id === 't3')).toBeUndefined();
  });
});
