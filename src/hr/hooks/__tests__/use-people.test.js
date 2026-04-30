import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({ getRoster: vi.fn() }));

import { getRoster } from '../../../lib/supabase-hr';
import { usePeople } from '../use-people';

beforeEach(() => {
  vi.clearAllMocks();
  getRoster.mockResolvedValue([
    { id: 'u1', display_name: 'Alex', role: 'employee', team_id: 't1' },
  ]);
});

describe('usePeople', () => {
  it('loads roster on mount', async () => {
    const { result } = renderHook(() => usePeople());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.people).toHaveLength(1);
    expect(result.current.people[0].display_name).toBe('Alex');
  });
});
