import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';

// ── BILLING ─────────────────────────────────────────────────────
function AdminBilling({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;

  const totalArr = 1577;
  const monthlyRev = [108, 112, 118, 124, 128, 131, 134];
  const months = ['Oct','Nov','Dec','Jan','Feb','Mar','Apr'];

  const invoices = [
    { id:'INV-2026-0412', tenant:'Riyadh Bank',     amount: 34333, status:'paid',    due:'Apr 12, 2026', method:'Wire' },
    { id:'INV-2026-0411', tenant:'Doha Energy',     amount: 25666, status:'paid',    due:'Apr 12, 2026', method:'Wire' },
    { id:'INV-2026-0410', tenant:'Cedar Telecom',   amount: 18666, status:'paid',    due:'Apr 11, 2026', method:'ACH' },
    { id:'INV-2026-0409', tenant:'Nile Group',      amount: 14000, status:'paid',    due:'Apr 10, 2026', method:'Wire' },
    { id:'INV-2026-0408', tenant:'Nordic Holdings', amount: 14000, status:'pending', due:'Apr 24, 2026', method:'ACH' },
    { id:'INV-2026-0407', tenant:'Atlas Logistics', amount:  6000, status:'overdue', due:'Apr 02, 2026', method:'Card' },
    { id:'INV-2026-0406', tenant:'Suez Industrial', amount:  9000, status:'paid',    due:'Apr 09, 2026', method:'Wire' },
    { id:'INV-2026-0405', tenant:'Levant Retail Co.', amount:3000, status:'pending', due:'Apr 28, 2026', method:'Card' },
  ];
  const statusTone = { paid:'success', pending:'caution', overdue:'danger' };
  const statusLabel = { paid:s('Paid','مدفوع'), pending:s('Pending','معلّق'), overdue:s('Overdue','متأخر') };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
          {s('Billing & revenue','الفوترة والإيرادات')}
        </div>
        <h1 className="display" style={{ margin: 0, fontSize: 38, color: T.text, letterSpacing: -1, fontWeight: 400 }}>
          ${totalArr.toLocaleString()}k <span style={{ color: T.textMuted, fontSize: 22 }}>{s('ARR','إيراد سنوي')}</span>
          <span style={{ color: T.accent, marginInlineStart: 8 }}>.</span>
        </h1>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>
          {s('Up 6.3% MoM · 47 paying tenants · next collection cycle May 1','نمو ٦٫٣٪ شهريًا · ٤٧ عميل مدفوع · دورة التحصيل القادمة ١ مايو')}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        {[
          { label: s('MRR','إيراد شهري'), val: '$134k',  sub:'+2.3% wow' },
          { label: s('Outstanding','مستحق'), val: '$23k', sub: s('3 invoices','٣ فواتير') },
          { label: s('Net retention','الاحتفاظ الصافي'), val: '112%', sub: s('trailing 12m','١٢ شهر') },
          { label: s('Avg seat price','متوسط سعر المقعد'), val: '$4.67', sub: s('per month','شهريًا') },
        ].map((k,i)=>(
          <Panel key={i} theme={T} density={density}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div className="display" style={{ fontSize: 30, color: T.text, letterSpacing: -1, lineHeight: 1, fontWeight: 400 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>{k.sub}</div>
          </Panel>
        ))}
      </div>

      <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap }}>
        <PanelHeader theme={T} density={density} title={s('Monthly revenue','الإيراد الشهري')} subtitle={s('Last 7 months','آخر ٧ أشهر')}/>
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ display:'flex', alignItems:'flex-end', gap: 10, height: 140 }}>
            {monthlyRev.map((v,i) => {
              const max = Math.max(...monthlyRev);
              const h = (v/max)*100;
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap: 6 }}>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>${v}k</div>
                  <div style={{ width: '100%', height: `${h}%`, background: `linear-gradient(180deg, ${T.accent}, ${T.accent}66)`, borderRadius: '6px 6px 2px 2px', minHeight: 8 }}/>
                  <div style={{ fontSize: 11, color: T.textFaint }}>{months[i]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density} title={s('Recent invoices','الفواتير الأخيرة')} subtitle={`${invoices.length} ${s('this month','هذا الشهر')}`}
          right={<HRButton theme={T} variant="secondary" size="sm" icon="download">{s('Export CSV','تصدير CSV')}</HRButton>}/>
        <div>
          <div style={{
            display:'grid', gridTemplateColumns:'1.2fr 1.6fr 1fr 1fr 0.8fr 36px',
            padding: `12px ${DENSITY[density].cardPad}px`,
            fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: 0.6, textTransform: 'uppercase',
            borderBottom: `1px solid ${T.divider}`, background: T.panelSunk,
          }}>
            <div>{s('Invoice','فاتورة')}</div>
            <div>{s('Tenant','عميل')}</div>
            <div style={{ textAlign:'end' }}>{s('Amount','مبلغ')}</div>
            <div>{s('Due','استحقاق')}</div>
            <div>{s('Status','حالة')}</div>
            <div></div>
          </div>
          {invoices.map((inv, i) => (
            <div key={inv.id} style={{
              display:'grid', gridTemplateColumns:'1.2fr 1.6fr 1fr 1fr 0.8fr 36px',
              padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
              fontSize: 13, alignItems:'center',
              borderBottom: i < invoices.length - 1 ? `1px solid ${T.divider}` : 'none',
            }}>
              <div className="mono" style={{ fontSize: 11, color: T.textMuted }}>{inv.id}</div>
              <div style={{ color: T.text, fontWeight: 600 }}>{inv.tenant}</div>
              <div className="mono" style={{ textAlign:'end', color: T.text, fontWeight: 600 }}>${inv.amount.toLocaleString()}</div>
              <div style={{ color: T.textMuted, fontSize: 12 }}>
                {inv.due}
                <div style={{ fontSize: 10, color: T.textFaint }}>{inv.method}</div>
              </div>
              <div><Badge theme={T} tone={statusTone[inv.status]}>{statusLabel[inv.status]}</Badge></div>
              <button style={{ background:'transparent', border:'none', color: T.textMuted, cursor:'pointer', padding: 6 }}>
                <HRIcon name="more" size={16}/>
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export { AdminBilling };
