import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge, AvatarMark } from '../../shared/components.jsx';
import { useRoles } from '../hooks/use-roles.js';

const ROLE_OPTIONS = ['employee', 'hr_admin', 'company_admin', 'wellness_admin'];

const ROLE_TONES = {
  wellness_admin: 'danger',
  company_admin: 'caution',
  hr_admin: 'info',
  employee: 'neutral',
};

function AdminRow({ theme, density, lang, admin, isLast, onPromote }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [role, setRoleVal] = React.useState(admin.role || 'employee');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => { setRoleVal(admin.role || 'employee'); }, [admin.role]);

  async function handleChange(nextRole) {
    setRoleVal(nextRole);
    setBusy(true); setErr(null);
    try {
      await onPromote(admin.id, nextRole, admin.company_id || null);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
      display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: isLast ? 'none' : `1px solid ${T.divider}`,
    }}>
      <AvatarMark theme={T} name={admin.display_name || admin.id || '?'} size={32}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{admin.display_name || s('(unnamed)','(بلا اسم)')}</div>
        <div style={{ fontSize: 11, color: T.textMuted }}>
          {admin.companies?.name || (admin.company_id ? <span className="mono">{admin.company_id}</span> : s('Platform','المنصة'))}
        </div>
      </div>
      <Badge theme={T} tone={ROLE_TONES[role] || 'neutral'}>{role}</Badge>
      <select value={role} onChange={(e) => handleChange(e.target.value)} disabled={busy} style={{
        height: 32, padding: '0 10px', borderRadius: 8,
        background: T.panelSunk, border: `1px solid ${T.border}`,
        color: T.text, fontSize: 12, outline: 'none', cursor: busy ? 'wait' : 'pointer',
      }}>
        {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {err && <span style={{ fontSize: 11, color: T.danger }}>{err}</span>}
    </div>
  );
}

function AdminRolesView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { admins, loading, promote } = useRoles();

  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Users & roles','المستخدمون والأدوار')}
        title={s('Internal access','الوصول الداخلي')}
        sub={loading
          ? s('Loading…','جارٍ التحميل…')
          : `${admins.length} ${s('admins','مسؤول')}`}
        right={<HRButton theme={T} icon="plus">{s('Invite teammate','ادعُ زميلًا')}</HRButton>}/>

      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density}
          title={s('Admins','المسؤولون')}
          subtitle={loading ? s('Loading…','جارٍ التحميل…') : `${admins.length} ${s('total','إجمالي')}`}/>
        {loading ? (
          <div style={{ padding: 48, display: 'grid', placeItems: 'center', color: T.textMuted, fontSize: 13 }}>
            {s('Loading…','جارٍ التحميل…')}
          </div>
        ) : admins.length === 0 ? (
          <div style={{ padding: 32, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
            {s('No admins yet.','لا يوجد مسؤولون بعد.')}
          </div>
        ) : (
          <div>
            {admins.map((a, i) => (
              <AdminRow key={a.id || i} theme={T} density={density} lang={lang}
                admin={a} isLast={i === admins.length - 1} onPromote={promote}/>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

export { AdminRolesView };
