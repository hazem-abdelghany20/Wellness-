import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  getPlatformOverview: vi.fn(),
}));

import { getPlatformOverview } from '../../../lib/supabase-admin';
import { usePlatformOverview } from '../use-platform-overview';

beforeEach(() => {
  vi.clearAllMocks();
  getPlatformOverview.mockResolvedValue({
    companies: [{ id: 'c1', name: 'Acme' }],
    totals: { tenants: 1, seats: 50, mrr_cents: 100000 },
  });
});

describe('usePlatformOverview', () => {
  it('loads overview on mount', async () => {
    const { result } = renderHook(() => usePlatformOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.totals.tenants).toBe(1);
  });
});
