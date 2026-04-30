import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listStrings: vi.fn(),
  setString: vi.fn(),
}));

import { listStrings, setString } from '../../../lib/supabase-admin';
import { useLocalization } from '../use-localization';

beforeEach(() => {
  vi.clearAllMocks();
  listStrings.mockResolvedValue([{ key: 'home.greeting', lang: 'en', value: 'Hi' }]);
});

describe('useLocalization', () => {
  it('lists strings', async () => {
    const { result } = renderHook(() => useLocalization());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.strings).toHaveLength(1);
  });

  it('saves a string', async () => {
    setString.mockResolvedValue({ key: 'home.greeting', lang: 'ar', value: 'مرحبا' });
    const { result } = renderHook(() => useLocalization());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.save('home.greeting', 'ar', 'مرحبا'); });
    expect(setString).toHaveBeenCalledWith('home.greeting', 'ar', 'مرحبا');
  });
});
