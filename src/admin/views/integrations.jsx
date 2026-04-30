import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { useIntegrations } from '../hooks/use-integrations.js';

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
          : `${integrations.length} ${s('total','إجمالي')}`}
        right={<HRButton theme={T} icon="plus">{s('Add integration','أضف تكاملًا')}</HRButton>}/>

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
      </Panel>
    </>
  );
}

export { AdminIntegrationsView };
