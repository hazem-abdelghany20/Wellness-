import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  supabase,
  signOut as signOutRaw, getMyProfile, getMyCompany,
} from '../../lib/supabase';
import { hrJoin } from '../../lib/supabase-invites';

const HRAuthContext = createContext(null);

export function HRAuthProvider({ children }) {
  const [session, setSession]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [company, setCompany]   = useState(null);
  const [loading, setLoading]   = useState(true);
  // Only the latest profile load may write state (see signIn).
  const loadSeq = useRef(0);

  // Prefer JWT app_metadata.role for fresh tokens. Fall back to profile.role
  // for superadmins / backfilled users whose claims haven't been re-minted.
  const role = session?.user?.app_metadata?.role || profile?.role || null;

  const loadProfile = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const [p, c] = await Promise.all([getMyProfile(), getMyCompany()]);
      if (seq === loadSeq.current) { setProfile(p); setCompany(c); }
    } catch (e) {
      console.warn('[hr-auth] refreshProfile failed', e);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) { loadSeq.current += 1; setProfile(null); setCompany(null); return; }
    await loadProfile();
  }, [session, loadProfile]);

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

  // inviteToken comes from /hr.html?invite=TOKEN (the HR-admin invite link).
  // It rides along in the sign-up metadata; join_company_for_me() then places
  // an account that already existed without a profile.
  const signIn = useCallback(async (email, password, inviteToken) => {
    const placement = await hrJoin({ email, password, inviteToken });
    if (placement?.placed) await loadProfile();
    return placement;
  }, [loadProfile]);

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
