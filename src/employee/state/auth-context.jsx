import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  supabase, signInOrUpWithPassword,
  signOut as signOutRaw, getMyProfile, getMyCompany,
} from '../../lib/supabase';
import { employeeJoin } from '../../lib/supabase-invites';
import { isSuperadminEmail } from '../../lib/superadmin';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  // True while signInWithCode is signing in and placing the account. The app
  // keeps the join screen up meanwhile (see App.jsx).
  const [joining, setJoining] = useState(false);
  // Only the latest profile load may write state: a load started before the
  // account was placed must not overwrite the one started after.
  const loadSeq = useRef(0);

  const loadProfile = useCallback(async () => {
    const seq = ++loadSeq.current;
    setProfileLoaded(false);
    try {
      const [p, c] = await Promise.all([getMyProfile(), getMyCompany()]);
      if (seq === loadSeq.current) { setProfile(p); setCompany(c); }
    } catch (e) {
      if (seq === loadSeq.current) { setProfile(null); setCompany(null); }
      console.warn('[auth] refreshProfile failed', e);
    } finally {
      if (seq === loadSeq.current) setProfileLoaded(true);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) {
      loadSeq.current += 1;
      setProfile(null); setCompany(null); setProfileLoaded(false);
      return;
    }
    await loadProfile();
  }, [session, loadProfile]);

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
  // - Invite link (inviteToken): no code needed.
  // - Company code: verified first, then forwarded so handle_new_user() can
  //   attach the profile to the right tenant on first sign-up.
  // - Neither: works for an email HR imported. Otherwise employeeJoin signs
  //   out again and throws NotInvitedError (code 'no_invite').
  const signInWithCode = useCallback(async (code, email, password, inviteToken) => {
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
    setJoining(true);
    try {
      const { company: c, placement } = await employeeJoin({ email, password, code, inviteToken });
      // The profile may have been created after the session landed; load it
      // again so the app routes on the placed account.
      if (placement?.placed) await loadProfile();
      return c;
    } finally {
      setJoining(false);
    }
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await signOutRaw();
    setProfile(null); setCompany(null);
  }, []);

  const value = {
    session, profile, company, loading, profileLoaded, joining,
    signInWithCode, signOut, refreshProfile,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
