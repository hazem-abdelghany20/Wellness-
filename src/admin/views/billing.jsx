import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { useBilling } from '../hooks/use-billing.js';

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

function AdminBilling({ theme, density, lang, companyId }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { invoices, loading, update } = useBilling(companyId);
  const [saving, setSaving] = React.useState(false);

  async function handleSave(patch) {
    setSaving(true);
    try { await update(patch); } finally { setSaving(false); }
  }

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
            {s('Open a tenant from the Tenants list to manage its billing.','اختر عميلًا من قائمة العملاء لإدارة فوترته.')}
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
      <div style={{ marginBottom: 18 }}>
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
          right={<HRButton theme={T} variant="secondary" size="sm" icon="download">{s('Export CSV','تصدير CSV')}</HRButton>}/>
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
                  <button style={{ background:'transparent', border:'none', color: T.textMuted, cursor:'pointer', padding: 6 }}>
                    <HRIcon name="more" size={16}/>
                  </button>
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
