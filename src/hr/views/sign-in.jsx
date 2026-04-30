import React, { useState } from 'react';
import { useHRAuth } from '../state/auth-context.jsx';
import { HRButton } from '../../shared/components.jsx';

export function SignIn({ theme, S, dir }) {
  const { signIn, verifyOtp, pendingEmail } = useHRAuth();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState(null);

  const handleSendCode = async () => {
    setErr(null); setBusy(true);
    try { await signIn(email); }
    catch (e) { setErr(e?.message || 'Failed to send code'); }
    finally { setBusy(false); }
  };

  const handleVerify = async () => {
    setErr(null); setBusy(true);
    try { await verifyOtp(token); }
    catch (e) { setErr(e?.message || 'Invalid code'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg, color: theme.text }} dir={dir}>
      <div style={{ width: 360, padding: 32, background: theme.panel, borderRadius: 16, border: `1px solid ${theme.border}` }}>
        <h1 className="display" style={{ fontSize: 24, marginBottom: 16, marginTop: 0 }}>{S?.signIn || 'HR Portal'}</h1>
        {!pendingEmail ? (
          <>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, background: theme.panelSunk, border: `1px solid ${theme.border}`, color: theme.text, marginBottom: 12, boxSizing: 'border-box' }} />
            <HRButton theme={theme} onClick={handleSendCode} disabled={busy || !email}>{busy ? 'Sending…' : (S?.sendCode || 'Send code')}</HRButton>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 12 }}>Code sent to {pendingEmail}</div>
            <input value={token} onChange={e => setToken(e.target.value)} placeholder="6-digit code" style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, background: theme.panelSunk, border: `1px solid ${theme.border}`, color: theme.text, marginBottom: 12, boxSizing: 'border-box' }} />
            <HRButton theme={theme} onClick={handleVerify} disabled={busy || token.length < 6}>{busy ? 'Verifying…' : (S?.verify || 'Verify')}</HRButton>
          </>
        )}
        {err && <div style={{ fontSize: 12, color: theme.danger || '#ff6b6b', marginTop: 12 }}>{err}</div>}
      </div>
    </div>
  );
}
