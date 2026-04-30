import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const unsubscribe = vi.fn();
vi.mock('../../../lib/supabase', () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  subscribeToNotifications: vi.fn(() => ({ unsubscribe })),
}));

import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  subscribeToNotifications,
} from '../../../lib/supabase';
import { useNotifications } from '../use-notifications';

beforeEach(() => {
  vi.clearAllMocks();
  getNotifications.mockResolvedValue([
    { id: 'n1', read: false }, { id: 'n2', read: true },
  ]);
});

describe('useNotifications', () => {
  it('loads notifications and computes unread count', async () => {
    const { result } = renderHook(() => useNotifications('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.list).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
  });

  it('subscribes when userId is provided and unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useNotifications('user-1'));
    await waitFor(() => expect(subscribeToNotifications).toHaveBeenCalled());
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('marks one as read', async () => {
    markNotificationRead.mockResolvedValue();
    const { result } = renderHook(() => useNotifications('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.markRead('n1'); });
    expect(markNotificationRead).toHaveBeenCalledWith('n1');
  });
});
