import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { useIntegrations } from '../hooks/use-integrations.js';
import { useTenants } from '../hooks/use-tenants.js';
import { friendlyErrorI18n } from '../../lib/errors';

function NewIntegrationForm({ theme, lang, tenants, onAdd, busy }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [companyId, setCompanyId] = React.useState('');
  const [kind, setKind] = React.useState('');
  const [status, setStatus] = React.useState('pending');
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    if (!companyId && tenants && tenants[0]) setCompanyId(tenants[0].id);
  }, [tenants, companyId]);

  async function submit(e) {
    e.preventDefault();
    if (!companyId || !kind.trim()) return;
    setErr(null);
    try {
      await onAdd(companyId, kind.trim(), status, {});
      setKind('');
    } catch (e) {
      setErr(friendlyErrorI18n(e, lang));
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
      padding: 12, borderTop: `1px solid ${T.divider}`,
    }}>
      <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
        {(tenants ?? []).map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <input value={kind} onChange={(e) => setKind(e.target.value)}
        placeholder={s('kind (e.g. slack, okta)','النوع')} style={{ ...inputStyle, flex: 1, minWidth: 160 }}/>
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
        <option value="pending">pending</option>
        <option value="configured">configured</option>
        <option value="error">error</option>
      </select>
      <HRButton theme={T} type="submit" disabled={busy || !companyId || !kind.trim()} icon="plus">
        {busy ? s('Saving…','جارٍ الحفظ…') : s('Add integration','إضافة')}
      </HRButton>
      {err && <span style={{ fontSize: 12, color: T.danger }}>{err}</span>}
    </form>
  );
}

function IntegrationRow({ theme, density, lang, integration, isLast, onSet }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const status = integration.status || 'pending';
  const tone = status === 'configured' ? 'positive' : status === 'error' ? 'danger' : 'caution';
  const dot = { configured:'#6FC79B', error:'#E08A6B' }[status] || '#F5B544';
  const company = integration.companies?.name || integration.company_id || '—';

  async function markConfigured() {
    setBusy(true); setErr(null);
    try {
      await onSet(integration.company_id, integration.kind, 'configured', integration.config || {});
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
      <span style={{ width: 8, height: 8, borderRadius: 999, background: dot, boxShadow: `0 0 0 3px ${dot}22` }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{integration.kind}</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{company}</div>
      </div>
      <Badge theme={T} tone={tone}>{status}</Badge>
      {status !== 'configured' && (
        <HRButton theme={T} variant="ghost" size="sm" disabled={busy} onClick={markConfigured}>
          {busy ? s('Saving…','جارٍ الحفظ…') : s('Mark configured','اعتبره مُكوَّنًا')}
        </HRButton>
      )}
      {err && <span style={{ fontSize: 11, color: T.danger }}>{err}</span>}
    </div>
  );
}

function AdminIntegrationsView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { integrations, loading, set } = useIntegrations();
  const { tenants } = useTenants();
  const [busy, setBusy] = React.useState(false);

  async function handleAdd(companyId, kind, status, config) {
    setBusy(true);
    try { await set(companyId, kind, status, config); } finally { setBusy(false); }
  }

  const counts = integrations.reduce((acc, it) => {
    acc[it.status] = (acc[it.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Integrations','التكاملات')}
        title={s('System health','صحة الأنظمة')}
        sub={loading
          ? s('Loading…','جارٍ التحميل…')
          : `${integrations.length} ${s('total','إجمالي')}`}/>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap: DENSITY[density].gap }}>
        {[
          { label: s('Configured','مُكوَّن'), val: counts.configured ?? 0, tone: '#6FC79B' },
          { label: s('Pending','قيد الإعداد'), val: counts.pending ?? 0, tone: '#F5B544' },
          { label: s('Error','خطأ'), val: counts.error ?? 0, tone: '#E08A6B' },
          { label: s('Total','الإجمالي'), val: integrations.length, tone: T.text },
        ].map((k, i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div className="display" style={{ fontSize: 32, color: k.tone, letterSpacing: -1, lineHeight: 1, fontWeight: 400 }}>{k.val}</div>
          </Panel>
        ))}
      </div>

      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density}
          title={s('Integrations','التكاملات')}
          subtitle={loading ? s('Loading…','جارٍ التحميل…') : `${integrations.length} ${s('total','إجمالي')}`}/>
        {loading ? (
          <div style={{ padding: 48, display: 'grid', placeItems: 'center', color: T.textMuted, fontSize: 13 }}>
            {s('Loading…','جارٍ التحميل…')}
          </div>
        ) : integrations.length === 0 ? (
          <div style={{ padding: 32, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
            {s('No integrations configured.','لا توجد تكاملات.')}
          </div>
        ) : (
          <div>
            {integrations.map((it, i) => (
              <IntegrationRow key={it.id || `${it.company_id}-${it.kind}-${i}`}
                theme={T} density={density} lang={lang}
                integration={it} isLast={i === integrations.length - 1}
                onSet={set}/>
            ))}
          </div>
        )}
        <NewIntegrationForm theme={T} lang={lang} tenants={tenants} onAdd={handleAdd} busy={busy}/>
      </Panel>
    </>
  );
}

export { AdminIntegrationsView };
