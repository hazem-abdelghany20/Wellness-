import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  listChallengeTemplates: vi.fn(),
  scheduleChallenge: vi.fn(),
  getChallengeStatus: vi.fn(),
}));

import {
  listChallengeTemplates, scheduleChallenge, getChallengeStatus,
} from '../../../lib/supabase-hr';
import { useChallenges } from '../use-challenges';

beforeEach(() => {
  vi.clearAllMocks();
  listChallengeTemplates.mockResolvedValue([{ id: 'tpl-1', title_en: 'Move' }]);
});

describe('useChallenges (HR)', () => {
  it('loads templates on mount', async () => {
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.templates).toHaveLength(1);
  });

  it('schedules a challenge', async () => {
    scheduleChallenge.mockResolvedValue({ id: 'c1' });
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.schedule({ id: 'tpl-1' }, { start: '2026-05-01', end: '2026-05-15' }, 'all');
    });
    expect(scheduleChallenge).toHaveBeenCalled();
  });
});
