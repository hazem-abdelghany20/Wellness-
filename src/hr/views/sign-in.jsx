import React, { useState } from 'react';
import { useHRAuth } from '../state/auth-context.jsx';
import { HRButton } from '../../shared/components.jsx';

export function SignIn({ theme, S, dir }) {
  const { signIn } = useHRAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState(null);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setErr(null); setBusy(true);
    try { await signIn(email, password); }
    catch (e) { setErr(e?.message || 'Sign-in failed'); }
    finally { setBusy(false); }
  };

  const input = {
    width: '100%', height: 40, padding: '0 12px', borderRadius: 8,
    background: theme.panelSunk, border: `1px solid ${theme.border}`,
    color: theme.text, marginBottom: 12, boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg, color: theme.text }} dir={dir}>
      <form onSubmit={handleSubmit} style={{ width: 360, padding: 32, background: theme.panel, borderRadius: 16, border: `1px solid ${theme.border}` }}>
        <h1 className="display" style={{ fontSize: 24, marginBottom: 16, marginTop: 0 }}>{S?.signIn || 'HR Portal'}</h1>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required style={input}/>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" required minLength={6} style={input}/>
        <HRButton theme={theme} onClick={handleSubmit} disabled={busy || !email || password.length < 6}>
          {busy ? 'Signing in…' : (S?.signIn || 'Sign in')}
        </HRButton>
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 10 }}>
          New email? An account is created on first sign-in.
        </div>
        {err && <div style={{ fontSize: 12, color: theme.danger || '#ff6b6b', marginTop: 12 }}>{err}</div>}
      </form>
    </div>
  );
}
