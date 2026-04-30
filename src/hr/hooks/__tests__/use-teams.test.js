import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  getTeamAggregates: vi.fn(),
  getTeamDrilldown: vi.fn(),
}));

import { getTeamAggregates, getTeamDrilldown } from '../../../lib/supabase-hr';
import { useTeams } from '../use-teams';

beforeEach(() => {
  vi.clearAllMocks();
  getTeamAggregates.mockResolvedValue([
    { team_id: 't1', team_name: 'Eng', has_signal: true,  avg_mood: 7.0 },
    { team_id: 't2', team_name: 'Fin', has_signal: false, avg_mood: null },
  ]);
});

describe('useTeams', () => {
  it('loads team aggregates', async () => {
    const { result } = renderHook(() => useTeams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams).toHaveLength(2);
  });

  it('drilldown fetches for a single team', async () => {
    getTeamDrilldown.mockResolvedValue({ team_id: 't1', range: '30d', rows: [] });
    const { result } = renderHook(() => useTeams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let drill;
    await act(async () => { drill = await result.current.drilldown('t1', '30d'); });
    expect(getTeamDrilldown).toHaveBeenCalledWith('t1', '30d');
    expect(drill.team_id).toBe('t1');
  });
});
