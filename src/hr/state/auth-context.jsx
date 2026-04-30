import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  supabase, signInWithOtp, verifyOtp as verifyOtpRaw,
  signOut as signOutRaw, getMyProfile, getMyCompany,
} from '../../lib/supabase';

const HRAuthContext = createContext(null);

export function HRAuthProvider({ children }) {
  const [session, setSession]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [company, setCompany]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [pendingEmail, setPendingEmail] = useState(null);

  const role = session?.user?.app_metadata?.role || null;

  const refreshProfile = useCallback(async () => {
    if (!session) { setProfile(null); setCompany(null); return; }
    try {
      const [p, c] = await Promise.all([getMyProfile(), getMyCompany()]);
      setProfile(p); setCompany(c);
    } catch (e) {
      console.warn('[hr-auth] refreshProfile failed', e);
    }
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
    setProfile(null); setCompany(null); setPendingEmail(null);
  }, []);

  const value = { session, profile, company, role, loading, pendingEmail, signIn, verifyOtp, signOut, refreshProfile };
  return <HRAuthContext.Provider value={value}>{children}</HRAuthContext.Provider>;
}

export function useHRAuth() {
  const ctx = useContext(HRAuthContext);
  if (!ctx) throw new Error('useHRAuth must be used inside HRAuthProvider');
  return ctx;
}
