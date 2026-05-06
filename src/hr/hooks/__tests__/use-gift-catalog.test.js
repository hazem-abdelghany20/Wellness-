import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  listGiftCatalog: vi.fn(),
  upsertGiftCatalogItem: vi.fn(),
}));

import { listGiftCatalog, upsertGiftCatalogItem } from '../../../lib/supabase-hr';
import { useGiftCatalog } from '../use-gift-catalog';

beforeEach(() => {
  vi.clearAllMocks();
  listGiftCatalog.mockResolvedValue([]);
});

describe('useGiftCatalog', () => {
  it('groups items by category', async () => {
    listGiftCatalog.mockResolvedValue([
      { id: '1', category: 'wh_service' },
      { id: '2', category: 'amazon' },
      { id: '3', category: 'wh_service' },
      { id: '4', category: 'custom' },
    ]);
    const { result } = renderHook(() => useGiftCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.byCategory.wh_service).toHaveLength(2);
    expect(result.current.byCategory.amazon).toHaveLength(1);
    expect(result.current.byCategory.custom).toHaveLength(1);
  });

  it('upserts and refetches', async () => {
    listGiftCatalog.mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'a', category: 'wh_service', name_en: 'Sleep Reset' }]);
    upsertGiftCatalogItem.mockResolvedValue({ id: 'a', category: 'wh_service', name_en: 'Sleep Reset' });
    const { result } = renderHook(() => useGiftCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(0);
    await act(async () => {
      await result.current.upsert({ category: 'wh_service', name_en: 'Sleep Reset', value_minor: 50000 });
    });
    expect(upsertGiftCatalogItem).toHaveBeenCalled();
    expect(result.current.items).toHaveLength(1);
  });

  it('deactivate calls upsert with active:false', async () => {
    upsertGiftCatalogItem.mockResolvedValue({ id: 'a', active: false });
    const { result } = renderHook(() => useGiftCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.deactivate('a'); });
    expect(upsertGiftCatalogItem).toHaveBeenCalledWith({ id: 'a', active: false });
  });
});
