import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader, Badge, AvatarMark } from '../../shared/components.jsx';
import { useTenant } from '../hooks/use-tenant.js';

function InviteAdminBox({ theme, lang, onInvite }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setMsg(null);
    try {
      await onInvite(email.trim());
      setMsg({ tone: 'ok', text: s('Invite sent','تم إرسال الدعوة') });
      setEmail('');
    } catch (err) {
      setMsg({ tone: 'err', text: err?.message || String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{
      display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      padding: 12, borderTop: `1px solid ${T.divider}`,
    }}>
      <input value={email} onChange={(e) => setEmail(e.target.value)}
        type="email" placeholder={s('admin@example.com','admin@example.com')}
        style={{
          flex: 1, minWidth: 200, height: 32, padding: '0 10px', borderRadius: 8,
          background: T.panelSunk, border: `1px solid ${T.border}`,
          color: T.text, fontSize: 12, outline: 'none',
        }}/>
      <HRButton theme={T} type="submit" disabled={busy || !email.trim()} icon="mail">
        {busy ? s('Inviting…','جارٍ الدعوة…') : s('Invite admin','ادعُ مسؤولًا')}
      </HRButton>
      {msg && (
        <span style={{ fontSize: 12, color: msg.tone === 'ok' ? T.positive : T.danger }}>{msg.text}</span>
      )}
    </form>
  );
}

function AdminTenantDetail({ theme, density, lang, tenant: tenantArg, onBack }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { tenant, loading, invite } = useTenant(tenantArg?.id);

  if (loading || !tenant) {
    return (
      <div>
        <div style={{ marginBottom: 16, display:'flex', alignItems:'center', gap: 10 }}>
          <button onClick={onBack} style={{
            height: 32, padding: '0 12px', borderRadius: 8,
            background: T.panelSunk, border: `1px solid ${T.border}`, color: T.text,
            fontSize: 12, fontWeight: 600, cursor:'pointer',
            display: 'flex', alignItems:'center', gap: 6,
          }}>
            <HRIcon name="chev" size={14} style={{ transform:'rotate(180deg)' }}/>
            {s('Tenants','العملاء')}
          </button>
        </div>
        <Panel theme={T} density={density}>
          <div style={{ padding: 48, display: 'grid', placeItems: 'center', color: T.textMuted, fontSize: 13 }}>
            {s('Loading…','جارٍ التحميل…')}
          </div>
        </Panel>
      </div>
    );
  }

  const billing = tenant.billing_state || {};
  const seats = billing.seats ?? 0;
  const mrrCents = billing.mrr_cents ?? 0;
  const status = billing.status || 'active';
  const plan = billing.plan || tenant.plan || '—';
  const integrations = tenant.integrations || [];
  const teams = tenant.teams || [];

  const statusTone = status === 'active' ? 'positive' : status === 'past_due' ? 'caution' : 'neutral';

  return (
    <div>
      <div style={{ marginBottom: 16, display:'flex', alignItems:'center', gap: 10 }}>
        <button onClick={onBack} style={{
          height: 32, padding: '0 12px', borderRadius: 8,
          background: T.panelSunk, border: `1px solid ${T.border}`, color: T.text,
          fontSize: 12, fontWeight: 600, cursor:'pointer',
          display: 'flex', alignItems:'center', gap: 6,
        }}>
          <HRIcon name="chev" size={14} style={{ transform:'rotate(180deg)' }}/>
          {s('Tenants','العملاء')}
        </button>
        <span style={{ color: T.textFaint, fontSize: 12 }}>/</span>
        <span style={{ color: T.textMuted, fontSize: 12, fontWeight: 600 }}>{tenant.name}</span>
      </div>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom: 20 }}>
        <div style={{ display:'flex', gap: 16, alignItems:'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: `linear-gradient(135deg, ${T.accent}, ${T.accent}99)`,
            color: T.accentInk, display:'grid', placeItems:'center',
            fontFamily: "'Instrument Serif', serif", fontSize: 26, fontWeight: 400,
          }}>{tenant.name?.[0] || '?'}</div>
          <div>
            <h1 className="display" style={{ margin: 0, fontSize: 36, color: T.text, letterSpacing: -1, fontWeight: 400, lineHeight: 1 }}>
              {tenant.name}
            </h1>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6, display:'flex', gap:10, alignItems:'center', flexWrap: 'wrap' }}>
              {tenant.slug && <><span className="mono">{tenant.slug}</span><span>·</span></>}
              <Badge theme={T} tone="neutral">{plan}</Badge>
              <Badge theme={T} tone={statusTone}>{status}</Badge>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <HRButton theme={T} variant="secondary" icon="mail">{s('Email CSM','مراسلة CSM')}</HRButton>
          <HRButton theme={T} icon="settings">{s('Manage','إدارة')}</HRButton>
        </div>
      </div>

      {/* Billing strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        {[
          { label: s('Seats','المقاعد'), value: seats.toLocaleString() },
          { label: s('MRR','إيراد شهري'), value: `$${(mrrCents/100).toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
          { label: s('Plan','الباقة'), value: plan },
          { label: s('Status','الحالة'), value: status },
        ].map((k,i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div className="display" style={{ fontSize: 28, color: T.text, letterSpacing: -1, lineHeight: 1, fontWeight: 400 }}>{k.value}</div>
          </Panel>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        {/* Integrations from tenant.integrations */}
        <Panel theme={T} density={density} pad={false}>
          <PanelHeader theme={T} density={density}
            title={s('Integrations','التكاملات')}
            subtitle={`${integrations.length} ${s('configured','تم إعداده')}`}/>
          <div>
            {integrations.length === 0 ? (
              <div style={{ padding: 18, color: T.textMuted, fontSize: 12 }}>
                {s('No integrations configured.','لا توجد تكاملات.')}
              </div>
            ) : integrations.map((it, i, arr) => {
              const dot = it.status === 'configured' ? '#6FC79B' : it.status === 'error' ? '#E08A6B' : '#F5B544';
              return (
                <div key={i} style={{
                  padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
                  display:'flex', alignItems:'center', gap:12,
                  borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
                }}>
                  <span style={{ width:8, height:8, borderRadius:999, background:dot, boxShadow:`0 0 0 3px ${dot}22` }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:T.text, fontWeight:600 }}>{it.kind}</div>
                    <div style={{ fontSize:11, color:T.textMuted }}>{it.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Teams */}
        <Panel theme={T} density={density} pad={false}>
          <PanelHeader theme={T} density={density}
            title={s('Teams','الفرق')}
            subtitle={`${teams.length} ${s('teams','فرق')}`}/>
          <div>
            {teams.length === 0 ? (
              <div style={{ padding: 18, color: T.textMuted, fontSize: 12 }}>
                {s('No teams yet.','لا توجد فرق.')}
              </div>
            ) : teams.map((t, i, arr) => (
              <div key={i} style={{
                padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
                display:'flex', alignItems:'center', gap:10,
                borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}>
                <AvatarMark theme={T} name={t.name || t.slug || '?'} size={28}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.name || t.slug}</div>
                  {t.slug && t.name && <div style={{ fontSize: 11, color: T.textMuted }} className="mono">{t.slug}</div>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Invite admin */}
      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density}
          title={s('Invite admin','ادعُ مسؤولًا')}
          subtitle={s('Send a company-admin invite for this tenant.','أرسل دعوة لمسؤول هذا العميل.')}/>
        <InviteAdminBox theme={T} lang={lang} onInvite={invite}/>
      </Panel>
    </div>
  );
}

export { AdminTenantDetail };
