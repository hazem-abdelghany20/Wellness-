import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listGlobalContent: vi.fn(),
  updateContent: vi.fn(),
}));

import { listGlobalContent, updateContent } from '../../../lib/supabase-admin';
import { useContent } from '../use-content';

beforeEach(() => {
  vi.clearAllMocks();
  listGlobalContent.mockResolvedValue([{ id: 'c1', title_en: 'Sleep' }]);
});

describe('useContent (admin)', () => {
  it('loads content list', async () => {
    const { result } = renderHook(() => useContent());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
  });

  it('updates an item', async () => {
    updateContent.mockResolvedValue({ id: 'c1', title_en: 'Better Sleep' });
    const { result } = renderHook(() => useContent());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.update('c1', { title_en: 'Better Sleep' }); });
    expect(updateContent).toHaveBeenCalledWith('c1', { title_en: 'Better Sleep' });
  });
});
