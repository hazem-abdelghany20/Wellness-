import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { useBilling } from '../hooks/use-billing.js';
import { useTenants } from '../hooks/use-tenants.js';

function BillingEditForm({ theme, lang, onSave, busy }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [mrr, setMrr] = React.useState('');
  const [plan, setPlan] = React.useState('starter');
  const [status, setStatus] = React.useState('active');
  const [seats, setSeats] = React.useState('');
  const [msg, setMsg] = React.useState(null);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    const patch = { plan, status };
    if (mrr !== '') patch.mrr_cents = Math.round(parseFloat(mrr) * 100);
    if (seats !== '') patch.seats = parseInt(seats, 10);
    try {
      await onSave(patch);
      setMsg({ tone: 'ok', text: s('Saved','تم الحفظ') });
    } catch (err) {
      setMsg({ tone: 'err', text: err?.message || String(err) });
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
      padding: 12,
    }}>
      <select value={plan} onChange={(e) => setPlan(e.target.value)} style={inputStyle}>
        <option value="starter">starter</option>
        <option value="pro">pro</option>
        <option value="enterprise">enterprise</option>
      </select>
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
        <option value="active">active</option>
        <option value="past_due">past_due</option>
        <option value="paused">paused</option>
        <option value="canceled">canceled</option>
      </select>
      <input value={mrr} onChange={(e) => setMrr(e.target.value)} type="number" step="0.01"
        placeholder={s('MRR (USD)','MRR (دولار)')} style={{ ...inputStyle, width: 130 }}/>
      <input value={seats} onChange={(e) => setSeats(e.target.value)} type="number"
        placeholder={s('Seats','المقاعد')} style={{ ...inputStyle, width: 110 }}/>
      <HRButton theme={T} type="submit" disabled={busy} icon="save">
        {busy ? s('Saving…','جارٍ الحفظ…') : s('Save billing','احفظ الفوترة')}
      </HRButton>
      {msg && <span style={{ fontSize: 12, color: msg.tone === 'ok' ? T.positive : T.danger }}>{msg.text}</span>}
    </form>
  );
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function AdminBilling({ theme, density, lang, companyId: companyIdProp }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { tenants, loading: tenantsLoading } = useTenants();
  const [pickedId, setPickedId] = React.useState(companyIdProp || null);

  // Default the picker to the prop (came in from a tenant row click) or
  // the first tenant once the list arrives. This makes /billing usable
  // straight from the sidebar instead of requiring a tenant click first.
  React.useEffect(() => {
    if (companyIdProp) { setPickedId(companyIdProp); return; }
    if (!pickedId && tenants && tenants[0]) setPickedId(tenants[0].id);
  }, [companyIdProp, tenants, pickedId]);

  const companyId = pickedId;
  const { invoices, loading, update } = useBilling(companyId);
  const [saving, setSaving] = React.useState(false);

  async function handleSave(patch) {
    setSaving(true);
    try { await update(patch); } finally { setSaving(false); }
  }

  const pickerInput = {
    height: 34, padding: '0 12px', borderRadius: 8,
    background: T.panelSunk, border: `1px solid ${T.border}`,
    color: T.text, fontSize: 13, outline: 'none', minWidth: 240,
  };

  const tenantPicker = (
    <select value={companyId || ''} onChange={(e) => setPickedId(e.target.value)} style={pickerInput}>
      {(tenants ?? []).map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );

  if (!companyId) {
    return (
      <div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
            {s('Billing & revenue','الفوترة والإيرادات')}
          </div>
          <h1 className="display" style={{ margin: 0, fontSize: 38, color: T.text, letterSpacing: -1, fontWeight: 400 }}>
            {s('Billing','الفوترة')}<span style={{ color: T.accent, marginInlineStart: 8 }}>.</span>
          </h1>
        </div>
        <Panel theme={T} density={density}>
          <div style={{ padding: 32, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
            {tenantsLoading
              ? s('Loading tenants…','جارٍ تحميل العملاء…')
              : s('No tenants on the platform yet.','لا يوجد عملاء بعد.')}
          </div>
        </Panel>
      </div>
    );
  }

  const statusTone = { paid:'success', pending:'caution', overdue:'danger', open:'caution', void:'neutral' };
  const totalPaid = invoices
    .filter((inv) => (inv.status === 'paid'))
    .reduce((acc, inv) => acc + (inv.total_cents ?? inv.amount_cents ?? 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
            {s('Billing & revenue','الفوترة والإيرادات')}
          </div>
          <h1 className="display" style={{ margin: 0, fontSize: 38, color: T.text, letterSpacing: -1, fontWeight: 400 }}>
            ${(totalPaid / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} <span style={{ color: T.textMuted, fontSize: 22 }}>{s('collected','تم تحصيله')}</span>
            <span style={{ color: T.accent, marginInlineStart: 8 }}>.</span>
          </h1>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>
            {loading
              ? s('Loading invoices…','جارٍ تحميل الفواتير…')
              : `${invoices.length} ${s('invoices on file','فاتورة في الملف')}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            {s('Tenant','العميل')}
          </span>
          {tenantPicker}
        </div>
      </div>

      <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap }}>
        <PanelHeader theme={T} density={density}
          title={s('Edit billing','تعديل الفوترة')}
          subtitle={s('Update plan, status, MRR, or seat count.','حدِّث الباقة أو الحالة أو الإيراد الشهري أو عدد المقاعد.')}/>
        <BillingEditForm theme={T} lang={lang} onSave={handleSave} busy={saving}/>
      </Panel>

      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density}
          title={s('Invoices','الفواتير')}
          subtitle={loading ? s('Loading…','جارٍ التحميل…') : `${invoices.length} ${s('total','إجمالي')}`}
          right={<HRButton theme={T} variant="secondary" size="sm" icon="download"
            onClick={invoices.length === 0 ? undefined : () => {
              // Build a per-tenant invoices CSV client-side. This is the
              // only export that's tenant-scoped (rest go through the edge
              // function for cross-tenant aggregates).
              const headers = ['invoice','amount_usd','period_start','period_end','status','currency'];
              const rows = invoices.map((inv) => ({
                invoice: inv.number || inv.id,
                amount_usd: ((inv.total_cents ?? inv.amount_cents ?? 0) / 100).toFixed(2),
                period_start: inv.period_start || '',
                period_end: inv.period_end || '',
                status: inv.status || '',
                currency: inv.currency || 'USD',
              }));
              const body = [headers.join(','), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(','))].join('\n');
              const tenant = (tenants ?? []).find((t) => t.id === companyId);
              const slug = (tenant?.slug || tenant?.name || 'tenant').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
              const url = `data:text/csv;charset=utf-8,${encodeURIComponent(body)}`;
              const a = document.createElement('a');
              a.href = url;
              a.download = `invoices-${slug}-${new Date().toISOString().slice(0,10)}.csv`;
              document.body.appendChild(a); a.click(); a.remove();
            }}
          >{s('Export CSV','تصدير CSV')}</HRButton>}/>
        {loading ? (
          <div style={{ padding: 48, display: 'grid', placeItems: 'center', color: T.textMuted, fontSize: 13 }}>
            {s('Loading…','جارٍ التحميل…')}
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: 32, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
            {s('No invoices yet.','لا توجد فواتير بعد.')}
          </div>
        ) : (
          <div>
            <div style={{
              display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr 1fr 36px',
              padding: `12px ${DENSITY[density].cardPad}px`,
              fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: 0.6, textTransform: 'uppercase',
              borderBottom: `1px solid ${T.divider}`, background: T.panelSunk,
            }}>
              <div>{s('Invoice','فاتورة')}</div>
              <div style={{ textAlign:'end' }}>{s('Amount','مبلغ')}</div>
              <div>{s('Period end','نهاية الفترة')}</div>
              <div>{s('Status','حالة')}</div>
              <div></div>
            </div>
            {invoices.map((inv, i) => {
              const cents = inv.total_cents ?? inv.amount_cents ?? 0;
              const period = inv.period_end ? new Date(inv.period_end).toLocaleDateString() : '—';
              const status = inv.status || 'open';
              return (
                <div key={inv.id || i} style={{
                  display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr 1fr 36px',
                  padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
                  fontSize: 13, alignItems:'center',
                  borderBottom: i < invoices.length - 1 ? `1px solid ${T.divider}` : 'none',
                }}>
                  <div className="mono" style={{ fontSize: 11, color: T.textMuted }}>{inv.number || inv.id}</div>
                  <div className="mono" style={{ textAlign:'end', color: T.text, fontWeight: 600 }}>${(cents / 100).toLocaleString()}</div>
                  <div style={{ color: T.textMuted, fontSize: 12 }}>{period}</div>
                  <div><Badge theme={T} tone={statusTone[status] || 'neutral'}>{status}</Badge></div>
                  {/* Per-row action button removed — invoices are append-only
                      in this surface; edits happen via the BillingEditForm. */}
                  <span/>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

export { AdminBilling };
