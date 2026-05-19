import React, { useState } from 'react';
import { useAdminAuth } from '../state/auth-context.jsx';
import { HRButton } from '../../shared/components.jsx';
import { friendlyErrorI18n } from '../../lib/errors';

export function SignIn({ theme, dir, lang = 'en' }) {
  const { signIn } = useAdminAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState(null);
  const s = (en, ar) => lang === 'ar' ? ar : en;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setErr(null); setBusy(true);
    try { await signIn(email, password); }
    catch (e) { setErr(friendlyErrorI18n(e, lang) || s('Sign-in failed','فشل تسجيل الدخول')); }
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
        <h1 className="display" style={{ fontSize: 24, marginBottom: 16, marginTop: 0 }}>{s('Admin Console','وحدة الإدارة')}</h1>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={s('admin@wellness.plus','admin@wellness.plus')} autoComplete="email" required style={input}/>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={s('Password','كلمة المرور')} autoComplete="current-password" required minLength={6} style={input}/>
        <HRButton theme={theme} onClick={handleSubmit} disabled={busy || !email || password.length < 6}>
          {busy ? s('Signing in…','جارٍ تسجيل الدخول…') : s('Sign in','تسجيل الدخول')}
        </HRButton>
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 10 }}>
          {s('New email? An account is created on first sign-in.','بريد جديد؟ يُنشأ الحساب عند أول تسجيل دخول.')}
        </div>
        {err && <div style={{ fontSize: 12, color: theme.danger || '#ff6b6b', marginTop: 12 }}>{err}</div>}
      </form>
    </div>
  );
}
