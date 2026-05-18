import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  supabase, signInOrUpWithPassword,
  signOut as signOutRaw, getMyProfile, getMyCompany,
} from '../../lib/supabase';

const HRAuthContext = createContext(null);

export function HRAuthProvider({ children }) {
  const [session, setSession]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [company, setCompany]   = useState(null);
  const [loading, setLoading]   = useState(true);

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

  const signIn = useCallback(async (email, password) => {
    await signInOrUpWithPassword(email, password);
  }, []);

  const signOut = useCallback(async () => {
    await signOutRaw();
    setProfile(null); setCompany(null);
  }, []);

  const value = { session, profile, company, role, loading, signIn, signOut, refreshProfile };
  return <HRAuthContext.Provider value={value}>{children}</HRAuthContext.Provider>;
}

export function useHRAuth() {
  const ctx = useContext(HRAuthContext);
  if (!ctx) throw new Error('useHRAuth must be used inside HRAuthProvider');
  return ctx;
}
