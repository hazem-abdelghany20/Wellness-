import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  supabase, signInOrUpWithPassword,
  signOut as signOutRaw, getMyProfile, getMyCompany, verifyCompanyCode,
} from '../../lib/supabase';
import { isSuperadminEmail } from '../../lib/superadmin';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!session) {
      setProfile(null); setCompany(null); setProfileLoaded(false);
      return;
    }
    setProfileLoaded(false);
    try {
      const [p, c] = await Promise.all([getMyProfile(), getMyCompany()]);
      setProfile(p); setCompany(c);
    } catch (e) {
      setProfile(null); setCompany(null);
      console.warn('[auth] refreshProfile failed', e);
    } finally {
      setProfileLoaded(true);
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

  // Unified email + password sign-in for the employee portal.
  // - Super-admin emails skip the company-code gate.
  // - Regular emails must present a valid company code; the code is forwarded
  //   as raw_user_meta_data so handle_new_user() can attach the profile to
  //   the right tenant on first sign-up.
  const signInWithCode = useCallback(async (code, email, password) => {
    if (isSuperadminEmail(email)) {
      // Attach super-admins to the seed Wellhouse Group tenant so the
      // handle_new_user() trigger can create a valid profile row
      // (profiles.company_id is NOT NULL). Without this the employee
      // portal's onboarding writes fail with "no row to update".
      await signInOrUpWithPassword(email, password, {
        company_code: 'WH-4782',
      });
      return null;
    }
    const v = await verifyCompanyCode(code, email);
    if (!v.valid) throw new Error(v.error || 'Invalid company code');
    await signInOrUpWithPassword(email, password, {
      company_code: (code || '').toUpperCase().trim(),
    });
    return v.company;
  }, []);

  const signOut = useCallback(async () => {
    await signOutRaw();
    setProfile(null); setCompany(null);
  }, []);

  const value = {
    session, profile, company, loading, profileLoaded,
    signInWithCode, signOut, refreshProfile,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
