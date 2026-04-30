import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge, AvatarMark, Bullet } from '../../shared/components.jsx';
import {
  AdminKpiStrip, DauMauChart, AdminTeam,
  ContentHealth, IntegrationsStatus, AuditLog, FeatureFlags,
} from '../sections.jsx';
import { usePlatformOverview } from '../hooks/use-platform-overview.js';

function LoadingFrame({ theme, label }) {
  return (
    <div style={{
      padding: 48, display: 'grid', placeItems: 'center',
      color: theme.textMuted, fontSize: 13,
    }}>
      {label}
    </div>
  );
}

// Lightweight tenants table that consumes the live `companies` shape returned by
// usePlatformOverview() (id, name, slug, plan, created_at, billing_state).
function OverviewTenantsTable({ theme, density, lang, companies, onOpen }) {
  const T = theme;
  const d = DENSITY[density];
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density}
        title={s('Tenants','العملاء')}
        subtitle={`${companies.length} ${s('total','إجمالي')}`}/>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
              {[
                { label: s('Tenant','العميل'), align: 'start' },
                { label: s('Plan','الباقة'), align: 'start' },
                { label: s('Seats','المقاعد'), align: 'end' },
                { label: s('MRR','إيراد شهري'), align: 'end' },
                { label: s('Status','حالة'), align: 'end' },
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
            {companies.map((c) => {
              const billing = c.billing_state || {};
              const seats = billing.seats ?? 0;
              const mrrCents = billing.mrr_cents ?? 0;
              const status = billing.status || 'active';
              const plan = billing.plan || c.plan || '—';
              return (
                <tr key={c.id} style={{ borderBottom: `1px solid ${T.divider}`, cursor: onOpen ? 'pointer' : 'default' }}
                    onClick={() => onOpen && onOpen(c)}>
                  <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AvatarMark theme={T} name={c.name} size={28}/>
                      <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{c.name}</span>
                    </div>
                  </td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function OverviewKpiStrip({ theme, density, totals, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const tiles = [
    { key: 'tenants', label: s('Active tenants','العملاء النشطون'), val: totals.tenants ?? 0 },
    { key: 'seats',   label: s('Total seats','إجمالي المقاعد'),     val: (totals.seats ?? 0).toLocaleString() },
    { key: 'mrr',     label: s('MRR','إيراد شهري'),                val: `$${((totals.mrr_cents ?? 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: DENSITY[density].gap }}>
      {tiles.map((k) => (
        <Panel key={k.key} theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 10 }}>
            {k.label}
          </div>
          <div className="display" style={{ fontSize: density === 'compact' ? 30 : 36, color: T.text, letterSpacing: -1, lineHeight: 1, fontWeight: 400 }}>
            {k.val}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function AdminOverview({ theme, density, chartStyle, layout, lang, onOpenTenant }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { data, loading } = usePlatformOverview();

  const totals = data?.totals ?? { tenants: 0, seats: 0, mrr_cents: 0 };
  const companies = data?.companies ?? [];

  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Platform overview','نظرة عامة على المنصة')}
        title={s('All tenants · Live','كل العملاء · مباشر')}
        sub={loading
          ? s('Loading platform metrics…','جارٍ تحميل مقاييس المنصة…')
          : `${totals.tenants} ${s('tenants','عميل')} · ${(totals.seats ?? 0).toLocaleString()} ${s('seats','مقعد')}`}
        right={<>
          <HRButton theme={T} variant="secondary" icon="calendar">Apr 2026</HRButton>
          <HRButton theme={T} variant="secondary" icon="filter"/>
        </>}/>

      {loading ? (
        <Panel theme={T} density={density}>
          <LoadingFrame theme={T} label={s('Loading…','جارٍ التحميل…')}/>
        </Panel>
      ) : (
        <>
          <OverviewKpiStrip theme={T} density={density} totals={totals} lang={lang}/>

          <OverviewTenantsTable theme={T} density={density} lang={lang}
            companies={companies} onOpen={onOpenTenant}/>
        </>
      )}
    </>
  );
}

export { AdminOverview };
