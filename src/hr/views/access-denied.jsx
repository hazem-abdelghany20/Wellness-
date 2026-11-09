import React from 'react';
import { useHRAuth } from '../state/auth-context.jsx';
import { HRButton } from '../../shared/components.jsx';

export function AccessDenied({ theme, dir }) {
  const { signOut } = useHRAuth();
  const s = (en, ar) => (dir === 'rtl' ? ar : en);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg, color: theme.text }} dir={dir}>
      <div style={{ width: 360, padding: 32, background: theme.panel, borderRadius: 16, border: `1px solid ${theme.border}`, textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 24, marginBottom: 12, marginTop: 0 }}>{s('No access', 'لا توجد صلاحية')}</h1>
        <p style={{ fontSize: 14, color: theme.textMuted, marginBottom: 16 }}>
          {s('Your account does not have HR portal access. If you were invited as an HR admin, sign out and open the personal invite link you were given.',
             'حسابك ليس لديه صلاحية لبوابة الموارد البشرية. لو تمت دعوتك كمسؤول موارد بشرية، سجّل الخروج وافتح رابط الدعوة الشخصي الذي وصلك.')}
        </p>
        <HRButton theme={theme} variant="secondary" onClick={signOut}>{s('Sign out', 'تسجيل الخروج')}</HRButton>
      </div>
    </div>
  );
}
