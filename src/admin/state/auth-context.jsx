import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  supabase, signInOrUpWithPassword,
  signOut as signOutRaw, getMyProfile,
} from '../../lib/supabase';
import { isSuperadminEmail } from '../../lib/superadmin';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // app_metadata.role is unset for any user whose JWT custom-claims hook
  // hasn't fired (most superadmins, freshly-onboarded users). Fall back
  // to profiles.role and treat the superadmin allowlist as wellness_admin
  // so the same identity can hop between Admin / HR / Employee portals
  // without separate provisioning.
  const role = isSuperadminEmail(session?.user?.email)
    ? 'wellness_admin'
    : (session?.user?.app_metadata?.role || profile?.role || null);

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

  const signIn = useCallback(async (email, password) => {
    await signInOrUpWithPassword(email, password);
  }, []);

  const signOut = useCallback(async () => {
    await signOutRaw();
    setProfile(null);
  }, []);

  const value = { session, profile, role, loading, signIn, signOut, refreshProfile };
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
