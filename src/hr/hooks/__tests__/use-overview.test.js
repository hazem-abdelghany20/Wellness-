import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  getCompanyOverview: vi.fn(),
}));

import { getCompanyOverview } from '../../../lib/supabase-hr';
import { useOverview } from '../use-overview';

beforeEach(() => {
  vi.clearAllMocks();
  getCompanyOverview.mockResolvedValue({
    range: '30d',
    kpis: { avg_mood: 7.1, avg_stress: 4.3 },
    trend: [{ week_start: '2026-04-01', avg_mood: 7.0, avg_stress: 4.4 }],
  });
});

describe('useOverview', () => {
  it('loads overview for the default range on mount', async () => {
    const { result } = renderHook(() => useOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getCompanyOverview).toHaveBeenCalledWith('30d');
    expect(result.current.data.kpis.avg_mood).toBe(7.1);
  });

  it('refetches when range changes', async () => {
    const { result, rerender } = renderHook(({ range }) => useOverview(range), { initialProps: { range: '30d' } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ range: '7d' });
    await waitFor(() => expect(getCompanyOverview).toHaveBeenCalledWith('7d'));
  });
});
