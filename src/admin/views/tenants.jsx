import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge, AvatarMark } from '../../shared/components.jsx';
import { useTenants } from '../hooks/use-tenants.js';

function NewTenantForm({ theme, lang, onCreate, busy }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [name, setName] = React.useState('');
  const [locale, setLocale] = React.useState('en');
  const [timezone, setTimezone] = React.useState('UTC');
  const [plan, setPlan] = React.useState('starter');
  const [error, setError] = React.useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await onCreate({ name: name.trim(), locale, timezone, plan });
      setName('');
    } catch (err) {
      setError(err?.message || String(err));
    }
  }

  const inputStyle = {
    height: 32, padding: '0 10px', borderRadius: 8,
    background: T.panelSunk, border: `1px solid ${T.border}`,
    color: T.text, fontSize: 12, outline: 'none',
  };

  return (
    <form onSubmit={submit} style={{
      display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      padding: 12, borderTop: `1px solid ${T.divider}`, background: T.panelSunk,
    }}>
      <input value={name} onChange={(e) => setName(e.target.value)}
        placeholder={s('Tenant name','اسم العميل')} style={{ ...inputStyle, flex: 1, minWidth: 180 }}/>
      <select value={locale} onChange={(e) => setLocale(e.target.value)} style={inputStyle}>
        <option value="en">en</option>
        <option value="ar">ar</option>
        <option value="fr">fr</option>
      </select>
      <input value={timezone} onChange={(e) => setTimezone(e.target.value)}
        placeholder="UTC" style={{ ...inputStyle, width: 110 }}/>
      <select value={plan} onChange={(e) => setPlan(e.target.value)} style={inputStyle}>
        <option value="starter">starter</option>
        <option value="pro">pro</option>
        <option value="enterprise">enterprise</option>
      </select>
      <HRButton theme={T} type="submit" disabled={busy || !name.trim()} icon="plus">
        {busy ? s('Creating…','جارٍ الإنشاء…') : s('Create','إنشاء')}
      </HRButton>
      {error && <span style={{ fontSize: 12, color: T.danger }}>{error}</span>}
    </form>
  );
}

function TenantsHookTable({ theme, density, lang, tenants, onOpen, onCreate, busy }) {
  const T = theme;
  const d = DENSITY[density];
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density}
        title={s('Tenants','العملاء')}
        subtitle={`${tenants.length} ${s('total','إجمالي')}`}/>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
              {[
                { label: s('Tenant','العميل'), align: 'start' },
                { label: s('Slug','المعرف'), align: 'start' },
                { label: s('Plan','الباقة'), align: 'start' },
                { label: s('Seats','المقاعد'), align: 'end' },
                { label: s('MRR','إيراد شهري'), align: 'end' },
                { label: s('Status','حالة'), align: 'end' },
                { label: s('Created','تاريخ الإنشاء'), align: 'end' },
              ].map((h, i) => (
                <th key={i} style={{
                  fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase',
                  color: T.textMuted, fontWeight: 700,
                  textAlign: h.align, padding: `10px ${d.cardPad}px`,
                  background: T.panel,
                }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => {
              const billing = t.billing_state || {};
              const seats = billing.seats ?? 0;
              const mrrCents = billing.mrr_cents ?? 0;
              const status = billing.status || 'active';
              const plan = billing.plan || t.plan || '—';
              const created = t.created_at ? new Date(t.created_at).toLocaleDateString() : '—';
              return (
                <tr key={t.id} style={{ borderBottom: `1px solid ${T.divider}`, cursor: onOpen ? 'pointer' : 'default' }}
                    onClick={() => onOpen && onOpen(t)}>
                  <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AvatarMark theme={T} name={t.name} size={28}/>
                      <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.name}</span>
                    </div>
                  </td>
                  <td className="mono" style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, fontSize: 12, color: T.textMuted }}>{t.slug || '—'}</td>
                  <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px` }}>
                    <Badge theme={T} tone="neutral">{plan}</Badge>
                  </td>
                  <td className="mono" style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end', color: T.text }}>
                    {seats.toLocaleString()}
                  </td>
                  <td className="mono" style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end', color: T.text, fontWeight: 700 }}>
                    ${(mrrCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end' }}>
                    <Badge theme={T} tone={status === 'active' ? 'positive' : 'neutral'} dot>{status}</Badge>
                  </td>
                  <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end', fontSize: 12, color: T.textMuted }}>{created}</td>
                </tr>
              );
            })}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                  {s('No tenants yet — create the first one below.','لا يوجد عملاء بعد — أنشئ أول عميل أدناه.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <NewTenantForm theme={T} lang={lang} onCreate={onCreate} busy={busy}/>
    </Panel>
  );
}

function AdminTenantsView({ theme, density, lang, onOpen }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { tenants, loading, create } = useTenants();
  const [creating, setCreating] = React.useState(false);

  async function handleCreate(payload) {
    setCreating(true);
    try { await create(payload); } finally { setCreating(false); }
  }

  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Customers','العملاء')}
        title={s('All tenants','كل العملاء')}
        sub={loading
          ? s('Loading…','جارٍ التحميل…')
          : `${tenants.length} ${s('total','إجمالي')}`}
        right={<>
          <HRButton theme={T} variant="secondary" icon="download">{s('Export','تصدير')}</HRButton>
        </>}/>
      {loading ? (
        <Panel theme={T} density={density}>
          <div style={{ padding: 48, display: 'grid', placeItems: 'center', color: T.textMuted, fontSize: 13 }}>
            {s('Loading…','جارٍ التحميل…')}
          </div>
        </Panel>
      ) : (
        <TenantsHookTable theme={T} density={density} lang={lang}
          tenants={tenants} onOpen={onOpen}
          onCreate={handleCreate} busy={creating}/>
      )}
    </>
  );
}

export { AdminTenantsView };
