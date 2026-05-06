import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  listTierConfigurations: vi.fn(),
  upsertTierConfiguration: vi.fn(),
  listChallengeTemplates: vi.fn(),
}));

import {
  listTierConfigurations, upsertTierConfiguration, listChallengeTemplates,
} from '../../../lib/supabase-hr';
import { useTierConfig } from '../use-tier-config';

beforeEach(() => {
  vi.clearAllMocks();
  listTierConfigurations.mockResolvedValue([]);
  listChallengeTemplates.mockResolvedValue([]);
});

describe('useTierConfig', () => {
  it('synthesizes defaults for missing tiers', async () => {
    listTierConfigurations.mockResolvedValue([
      { tier: 'gold', competition_id: 'c1', gift_catalog_item_id: 'g1', allow_employee_choice: false, choice_options: [] },
    ]);
    const { result } = renderHook(() => useTierConfig('c1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tierMap.bronze.gift_catalog_item_id).toBeNull();
    expect(result.current.tierMap.silver.gift_catalog_item_id).toBeNull();
    expect(result.current.tierMap.gold.gift_catalog_item_id).toBe('g1');
  });

  it('save calls upsert with the competition id', async () => {
    upsertTierConfiguration.mockResolvedValue({ id: 'tc1', tier: 'silver', competition_id: 'c1' });
    const { result } = renderHook(() => useTierConfig('c1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.save({
        tier: 'silver',
        gift_catalog_item_id: 'g2',
        allow_employee_choice: false,
        choice_options: [],
        company_id: 'co1',
      });
    });
    expect(upsertTierConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'silver', competition_id: 'c1' })
    );
  });

  it('exposes the competition list for the selector', async () => {
    listChallengeTemplates.mockResolvedValue([
      { id: 'c1', title: 'Sleep', active: true },
      { id: 'c2', title: 'Steps', active: false },
    ]);
    const { result } = renderHook(() => useTierConfig(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.competitions).toHaveLength(2);
  });
});
