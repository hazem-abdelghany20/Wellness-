import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  supabase, signInWithOtp, verifyOtp as verifyOtpRaw,
  signOut as signOutRaw, getMyProfile, getMyCompany, verifyCompanyCode,
} from '../../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingEmail, setPendingEmail] = useState(null);

  const refreshProfile = useCallback(async () => {
    if (!session) { setProfile(null); setCompany(null); return; }
    try {
      const [p, c] = await Promise.all([getMyProfile(), getMyCompany()]);
      setProfile(p); setCompany(c);
    } catch (e) {
      console.warn('[auth] refreshProfile failed', e);
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  const signInWithCode = useCallback(async (code, email) => {
    const v = await verifyCompanyCode(code, email);
    if (!v.valid) throw new Error(v.error || 'Invalid company code');
    await signInWithOtp(email);
    setPendingEmail(email);
    return v.company;
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

  const value = {
    session, profile, company, loading, pendingEmail,
    signInWithCode, verifyOtp, signOut, refreshProfile,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
