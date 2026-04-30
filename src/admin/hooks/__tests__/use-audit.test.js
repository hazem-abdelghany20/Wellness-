import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({ listAudit: vi.fn() }));

import { listAudit } from '../../../lib/supabase-admin';
import { useAudit } from '../use-audit';

beforeEach(() => {
  vi.clearAllMocks();
  listAudit.mockResolvedValue([{ id: 'a1', action: 'create_tenant' }]);
});

describe('useAudit', () => {
  it('lists audit rows', async () => {
    const { result } = renderHook(() => useAudit());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
  });
});
