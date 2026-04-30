import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-admin', () => ({
  listChallengeTemplates: vi.fn(),
  createChallengeTemplate: vi.fn(),
}));

import { listChallengeTemplates, createChallengeTemplate } from '../../../lib/supabase-admin';
import { useChallengeTemplates } from '../use-challenge-templates';

beforeEach(() => {
  vi.clearAllMocks();
  listChallengeTemplates.mockResolvedValue([{ id: 't1', slug: 'move' }]);
});

describe('useChallengeTemplates', () => {
  it('lists templates', async () => {
    const { result } = renderHook(() => useChallengeTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.templates).toHaveLength(1);
  });

  it('creates a template', async () => {
    createChallengeTemplate.mockResolvedValue({ id: 't2', slug: 'walk' });
    const { result } = renderHook(() => useChallengeTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create({ slug: 'walk', title_en: 'Walk' }); });
    expect(createChallengeTemplate).toHaveBeenCalled();
  });
});
