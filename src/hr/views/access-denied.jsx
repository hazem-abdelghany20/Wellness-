import React from 'react';
import { useHRAuth } from '../state/auth-context.jsx';
import { HRButton } from '../components.jsx';

export function AccessDenied({ theme, dir }) {
  const { signOut } = useHRAuth();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg, color: theme.text }} dir={dir}>
      <div style={{ width: 360, padding: 32, background: theme.panel, borderRadius: 16, border: `1px solid ${theme.border}`, textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 24, marginBottom: 12, marginTop: 0 }}>No access</h1>
        <p style={{ fontSize: 14, color: theme.textMuted, marginBottom: 16 }}>
          Your account does not have HR portal access. Contact your administrator if you believe this is wrong.
        </p>
        <HRButton theme={theme} variant="secondary" onClick={signOut}>Sign out</HRButton>
      </div>
    </div>
  );
}
