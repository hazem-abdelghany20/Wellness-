import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  subscribeToNotifications,
} from '../../lib/supabase';

export function useNotifications(userId) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setList(await getNotifications()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!userId) return;
    const sub = subscribeToNotifications(userId, () => refetch());
    return () => sub?.unsubscribe?.();
  }, [userId, refetch]);

  const unreadCount = useMemo(
    () => list.filter(n => !n.read).length, [list]
  );

  const markRead = useCallback(async (id) => {
    await markNotificationRead(id);
    setList(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setList(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  return { list, loading, error, unreadCount, markRead, markAllRead, refetch };
}
