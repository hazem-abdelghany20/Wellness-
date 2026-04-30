import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  supabase, signInWithOtp, verifyOtp as verifyOtpRaw,
  signOut as signOutRaw, getMyProfile,
} from '../../lib/supabase';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingEmail, setPendingEmail] = useState(null);

  const role = session?.user?.app_metadata?.role || null;

  const refreshProfile = useCallback(async () => {
    if (!session) { setProfile(null); return; }
    try { setProfile(await getMyProfile()); }
    catch (e) { console.warn('[admin-auth] refreshProfile failed', e); }
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  const signIn = useCallback(async (email) => {
    await signInWithOtp(email);
    setPendingEmail(email);
  }, []);

  const verifyOtp = useCallback(async (token) => {
    if (!pendingEmail) throw new Error('No pending email');
    const { data, error } = await verifyOtpRaw(pendingEmail, token);
    if (error) throw error;
    setPendingEmail(null);
    return data;
  }, [pendingEmail]);

  const signOut = useCallback(async () => {
    await signOutRaw();
    setProfile(null); setPendingEmail(null);
  }, []);

  const value = { session, profile, role, loading, pendingEmail, signIn, verifyOtp, signOut, refreshProfile };
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
