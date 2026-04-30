import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader, Badge, Spark, AvatarMark } from '../../shared/components.jsx';

function AdminTenantDetail({ theme, density, lang, tenant, onBack }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const churnTone = { low:'success', med:'caution', high:'danger' };
  const usagePct = Math.round((tenant.used / tenant.seats) * 100);

  // Synthesize series for this tenant
  const seed = tenant.name.length;
  const dauSeries = Array.from({length: 14}, (_,i) => Math.round((tenant.mau/4) + Math.sin(i*0.7+seed)*40 + i*8));
  const checkInRate = 60 + (seed % 18);
  const npsScore = tenant.health > 80 ? 52 : tenant.health > 65 ? 31 : -8;

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
          }}>{tenant.name[0]}</div>
          <div>
            <h1 className="display" style={{ margin: 0, fontSize: 36, color: T.text, letterSpacing: -1, fontWeight: 400, lineHeight: 1 }}>
              {tenant.name}
            </h1>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6, display:'flex', gap:10, alignItems:'center' }}>
              <span>{tenant.region}</span>
              <span>·</span>
              <span>{s(`Joined ${tenant.joined}`,`انضم ${tenant.joined}`)}</span>
              <span>·</span>
              <Badge theme={T} tone="neutral">{tenant.plan}</Badge>
              <Badge theme={T} tone={churnTone[tenant.churn]}>
                {tenant.churn === 'low' ? s('Healthy','مستقر') : tenant.churn === 'med' ? s('Watch','للمراقبة') : s('At risk','خطر')}
              </Badge>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <HRButton theme={T} variant="secondary" icon="mail">{s('Email CSM','مراسلة CSM')}</HRButton>
          <HRButton theme={T} icon="settings">{s('Manage','إدارة')}</HRButton>
        </div>
      </div>

      {/* Quick stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        {[
          { label: s('Seat utilisation','استخدام المقاعد'), value: `${usagePct}%`, sub: `${tenant.used.toLocaleString()} / ${tenant.seats.toLocaleString()}` },
          { label: s('MAU','المستخدمون شهريًا'), value: tenant.mau.toLocaleString(), sub: s('past 30 days','آخر ٣٠ يوم') },
          { label: s('Check-in rate','معدل الفحص'), value: `${checkInRate}%`, sub: s('weekly active','نشط أسبوعيًا') },
          { label: s('eNPS','مؤشر الموظفين'), value: npsScore > 0 ? `+${npsScore}` : `${npsScore}`, sub: s('last pulse','آخر نبضة') },
          { label: s('ARR','الإيراد السنوي'), value: `$${tenant.arr}k`, sub: s('annual','سنوي') },
        ].map((k,i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div className="display" style={{ fontSize: 32, color: T.text, letterSpacing: -1, lineHeight: 1, fontWeight: 400 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>{k.sub}</div>
          </Panel>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        <Panel theme={T} density={density} pad={false}>
          <PanelHeader theme={T} density={density} title={s('Engagement, last 14 days','المشاركة، آخر ١٤ يوم')} subtitle={s('Daily active users','المستخدمون يوميًا')}/>
          <div style={{ padding: '0 18px 18px' }}>
            <Spark theme={T} values={dauSeries} color={T.accent} width={760} height={140} chartStyle="area"/>
          </div>
        </Panel>

        <Panel theme={T} density={density} pad={false}>
          <PanelHeader theme={T} density={density} title={s('Top admins','المسؤولون')}/>
          <div>
            {[
              { name: 'Sarah Bennani', role: s('HR Director','مديرة الموارد البشرية'), last: '2h' },
              { name: 'Khalid Mansour', role: s('People Ops Lead','قائد عمليات الموظفين'), last: '5h' },
              { name: 'Yasmin Aziz',    role: s('Wellbeing Champion','مدافعة عن الرفاه'), last: '1d' },
            ].map((u,i) => (
              <div key={i} style={{
                padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
                display:'flex', alignItems:'center', gap: 10,
                borderBottom: i < 2 ? `1px solid ${T.divider}` : 'none',
              }}>
                <AvatarMark theme={T} name={u.name} size={28}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{u.role}</div>
                </div>
                <span className="mono" style={{ fontSize: 10, color: T.textFaint }}>{u.last}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        <Panel theme={T} density={density} pad={false}>
          <PanelHeader theme={T} density={density} title={s('Active integrations','التكاملات النشطة')}/>
          <div>
            {[
              { name:'Okta SSO', status:'ok', detail:'SAML 2.0 · 2 min ago' },
              { name:'Workday HRIS', status: tenant.health > 70 ? 'ok' : 'warn', detail: tenant.health > 70 ? 'API v40 · synced' : 'sync errors · 38m' },
              { name:'Slack', status:'ok', detail:'realtime' },
            ].map((it,i,arr) => {
              const dot = { ok:'#6FC79B', warn:'#F5B544', down:'#E08A6B' }[it.status];
              return (
                <div key={i} style={{
                  padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
                  display:'flex', alignItems:'center', gap:12,
                  borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
                }}>
                  <span style={{ width:8, height:8, borderRadius:999, background:dot, boxShadow:`0 0 0 3px ${dot}22` }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:T.text, fontWeight:600 }}>{it.name}</div>
                    <div style={{ fontSize:11, color:T.textMuted }}>{it.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel theme={T} density={density} pad={false}>
          <PanelHeader theme={T} density={density} title={s('Recent activity','النشاط الأخير')}/>
          <div>
            {[
              { t:'14:31', action: s('Bulk-assigned Sleep program to 240 users','تم تعيين برنامج النوم لـ ٢٤٠ مستخدم'), actor:'sarah.b' },
              { t:'12:08', action: s('Launched challenge: 10k steps × 2 weeks','أطلقت تحدي: ١٠ آلاف خطوة × أسبوعين'), actor:'khalid.m' },
              { t:'09:45', action: s('Updated Workday sync to nightly','تحديث مزامنة Workday لتكون ليلية'), actor:'system' },
              { t:'yest',  action: s('Added 18 seats','إضافة ١٨ مقعد'), actor:'sarah.b' },
            ].map((a,i,arr) => (
              <div key={i} style={{
                padding: `${DENSITY[density].cellPadY}px ${DENSITY[density].cardPad}px`,
                display:'flex', gap:12,
                borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}>
                <span className="mono" style={{ fontSize: 11, color: T.textFaint, width: 38, flexShrink:0 }}>{a.t}</span>
                <div style={{ flex:1, fontSize: 12, color: T.text, lineHeight: 1.5 }}>
                  {a.action}
                  <span className="mono" style={{ marginInlineStart: 8, color: T.textFaint }}>· {a.actor}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export { AdminTenantDetail };
