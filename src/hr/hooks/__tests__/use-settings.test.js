import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  getCompanySettings: vi.fn(),
  updateCompanySettings: vi.fn(),
}));

import { getCompanySettings, updateCompanySettings } from '../../../lib/supabase-hr';
import { useSettings } from '../use-settings';

beforeEach(() => {
  vi.clearAllMocks();
  getCompanySettings.mockResolvedValue({ id: 'co1', name: 'Acme', settings: { locale: 'en' } });
});

describe('useSettings', () => {
  it('loads settings on mount', async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.company.name).toBe('Acme');
  });

  it('updates settings', async () => {
    updateCompanySettings.mockResolvedValue({ id: 'co1', name: 'Acme 2' });
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.update({ name: 'Acme 2' }); });
    expect(updateCompanySettings).toHaveBeenCalledWith({ name: 'Acme 2' });
  });
});
