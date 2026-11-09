import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader, Badge, AvatarMark } from '../../shared/components.jsx';
import { useTenant } from '../hooks/use-tenant.js';
import { PeopleImportPanel } from '../../shared/people-import-panel.jsx';
import { JoinLinkCard } from '../../shared/join-link-card.jsx';
import { AdminInviteResult, adminInviteErrorText } from '../../shared/admin-invite-result.jsx';

function InviteAdminBox({ theme, lang, onInvite, companyName }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [result, setResult] = React.useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      setResult(await onInvite(email.trim(), name.trim()));
      setEmail(''); setName('');
    } catch (ex) {
      setErr(adminInviteErrorText(ex, lang));
    } finally {
      setBusy(false);
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
      <input value={name} onChange={(e) => setName(e.target.value)}
        placeholder={s('Name (optional)','الاسم (اختياري)')}
        style={{ ...inputStyle, flex: 1, minWidth: 160 }}/>
      <input value={email} onChange={(e) => setEmail(e.target.value)}
        type="email" dir="ltr" placeholder={s('admin@example.com','admin@example.com')}
        style={{ ...inputStyle, flex: 1, minWidth: 200 }}/>
      <HRButton theme={T} type="submit" disabled={busy || !email.trim()} icon="plus">
        {busy ? s('Creating…','جارٍ الإنشاء…') : s('Invite HR admin','دعوة مسؤول موارد بشرية')}
      </HRButton>
      {err && <span style={{ fontSize: 12, color: T.danger }}>{err}</span>}
      {result && <AdminInviteResult theme={T} lang={lang} result={result} companyName={companyName}/>}
    </form>
  );
}

function AdminTenantDetail({ theme, density, lang, tenant: tenantArg, onBack }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { tenant, loading, invite, refetch } = useTenant(tenantArg?.id);

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
          <HRButton theme={T} variant="secondary" icon="mail" onClick={() => {
            const subject = encodeURIComponent(s(`CSM follow-up: ${tenant.name}`, `متابعة CSM: ${tenant.name}`));
            const body = encodeURIComponent(s(`Re: ${tenant.name}\n\n`, `بخصوص: ${tenant.name}\n\n`));
            window.location.href = `mailto:csm@wellness.app?subject=${subject}&body=${body}`;
          }}>{s('Email CSM','مراسلة CSM')}</HRButton>
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
              const normalisedStatus = it.status === 'ok' ? 'configured' : it.status;
              const dotColor = normalisedStatus === 'configured' ? '#6FC79B'
                            : normalisedStatus === 'error'     ? '#E08A6B'
                            : '#F5B544';
              const statusLabel = normalisedStatus === 'configured' ? s('configured','مُكوَّن')
                               : normalisedStatus === 'error'     ? s('error','خطأ')
                               : s('pending','قيد الإعداد');
              return (
                <div key={i} style={{
                  padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
                  display:'flex', alignItems:'center', gap:12,
                  borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
                }}>
                  <span style={{ width:8, height:8, borderRadius:999, background:dotColor, boxShadow:`0 0 0 3px ${dotColor}22` }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:T.text, fontWeight:600 }}>{it.kind}</div>
                    <div style={{ fontSize:11, color:T.textMuted }}>{statusLabel}</div>
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
      <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap }}>
        <PanelHeader theme={T} density={density}
          title={s('Invite HR admin','دعوة مسؤول موارد بشرية')}
          subtitle={s('Creates a personal HR sign-up link for this tenant. Nothing is emailed — copy the link and send it yourself.','ينشئ رابط تسجيل شخصيًا لبوابة الموارد البشرية لهذا العميل. لا يُرسل أي بريد — انسخ الرابط وأرسله بنفسك.')}/>
        <InviteAdminBox theme={T} lang={lang} onInvite={invite} companyName={tenant.name}/>
      </Panel>

      {/* Join link */}
      {tenant.code && (
        <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap }}>
          <PanelHeader theme={T} density={density}
            title={s('Employee join link','رابط انضمام الموظفين')}
            subtitle={s('Opens the employee app with this tenant’s company code filled in.','يفتح تطبيق الموظفين برمز شركة هذا العميل جاهزًا.')}/>
          <div style={{ padding: DENSITY[density].cardPad }}>
            <JoinLinkCard theme={T} lang={lang} code={tenant.code} companyName={tenant.name}/>
          </div>
        </Panel>
      )}

      {/* People import */}
      <PeopleImportPanel theme={T} lang={lang} density={density}
        companyId={tenant.id} companyName={tenant.name}
        existingTeams={teams} onImported={() => refetch()}/>
    </div>
  );
}

export { AdminTenantDetail };
