import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  getContentItems: vi.fn(),
  getFeaturedContent: vi.fn(),
  saveContentProgress: vi.fn(),
}));

import { getContentItems, getFeaturedContent, saveContentProgress } from '../../../lib/supabase';
import { useContent } from '../use-content';

beforeEach(() => {
  vi.clearAllMocks();
  getContentItems.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
  getFeaturedContent.mockResolvedValue([{ id: 'c1', featured: true }]);
});

describe('useContent', () => {
  it('loads list and featured', async () => {
    const { result } = renderHook(() => useContent());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.featured).toHaveLength(1);
  });

  it('persists progress', async () => {
    saveContentProgress.mockResolvedValue();
    const { result } = renderHook(() => useContent());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.saveProgress('c1', 30, false); });
    expect(saveContentProgress).toHaveBeenCalledWith('c1', 30, false);
  });
});
