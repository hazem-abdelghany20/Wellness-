import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  getContentLibrary: vi.fn(),
  assignContent: vi.fn(),
}));

import { getContentLibrary, assignContent } from '../../../lib/supabase-hr';
import { useContent } from '../use-content';

beforeEach(() => {
  vi.clearAllMocks();
  getContentLibrary.mockResolvedValue([{ id: 'c1', title_en: 'Sleep' }]);
});

describe('useContent (HR)', () => {
  it('loads library on mount', async () => {
    const { result } = renderHook(() => useContent());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
  });

  it('assigns content to all', async () => {
    assignContent.mockResolvedValue({ id: 'a1' });
    const { result } = renderHook(() => useContent());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.assign('c1', 'all'); });
    expect(assignContent).toHaveBeenCalledWith('c1', 'all', undefined);
  });
});
