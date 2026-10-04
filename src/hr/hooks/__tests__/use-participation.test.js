import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({ getParticipationOverview: vi.fn() }));
import { getParticipationOverview } from '../../../lib/supabase-hr';
import { useParticipation } from '../use-participation';

beforeEach(() => { vi.clearAllMocks(); });

describe('useParticipation', () => {
  it('loads the participation overview for the range', async () => {
    getParticipationOverview.mockResolvedValue({ members: 8, took_part: 5, completed: 3, reads: 12 });
    const { result } = renderHook(() => useParticipation('7d'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getParticipationOverview).toHaveBeenCalledWith('7d');
    expect(result.current.data.took_part).toBe(5);
  });

  it('exposes errors', async () => {
    getParticipationOverview.mockRejectedValue(new Error('not_authorized'));
    const { result } = renderHook(() => useParticipation());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error.message).toBe('not_authorized');
  });
});
