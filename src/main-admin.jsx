import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { HR_THEMES, DENSITY, HR_STRINGS } from './shared/tokens.jsx';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from './shared/components.jsx';
import {
  ADMIN_DATA, AdminSidebar, AdminTopBar, AdminKpiStrip, DauMauChart,
  TenantsTable, ContentHealth, IntegrationsStatus, AuditLog,
  FeatureFlags, AdminTeam,
} from './admin/sections.jsx';
// --- admin-views.jsx ---
// Admin Portal — section view wrappers (page-level layouts that compose existing widgets)

function AdminPageHeader({ theme, eyebrow, title, sub, right }) {
  const T = theme;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
      <div>
        <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>{eyebrow}</div>
        <h1 className="display" style={{ margin: 0, fontSize: 38, color: T.text, letterSpacing: -1, fontWeight: 400 }}>
          {title}<span style={{ color: T.accent, marginInlineStart: 8 }}>.</span>
        </h1>
        {sub && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>{sub}</div>}
      </div>
      {right && <div style={{ display: 'flex', gap: 8 }}>{right}</div>}
    </div>
  );
}

function AdminOverview({ theme, density, chartStyle, layout, lang, onOpenTenant }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Platform overview','نظرة عامة على المنصة')}
        title={s('All tenants · Live','كل العملاء · مباشر')}
        sub={s('47 tenants · 28,412 active seats · last refresh 14:42 UTC','٤٧ عميل · ٢٨٬٤١٢ مقعد نشط · آخر تحديث ١٤:٤٢ UTC')}
        right={<>
          <HRButton theme={T} variant="secondary" icon="calendar">Apr 2026</HRButton>
          <HRButton theme={T} variant="secondary" icon="filter"/>
        </>}/>

      <AdminKpiStrip theme={T} density={density} chartStyle={chartStyle} lang={lang}/>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: DENSITY[density].gap }}>
        <DauMauChart theme={T} density={density} chartStyle={chartStyle} lang={lang}/>
        <AdminTeam theme={T} density={density} lang={lang}/>
      </div>

      <TenantsTable theme={T} density={density} lang={lang} onOpen={onOpenTenant}/>

      <div style={{ display: 'grid', gridTemplateColumns: layout === 'split' ? '1fr 1fr' : '1.3fr 1fr', gap: DENSITY[density].gap }}>
        <ContentHealth theme={T} density={density} lang={lang}/>
        <IntegrationsStatus theme={T} density={density} lang={lang}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: DENSITY[density].gap }}>
        <AuditLog theme={T} density={density} lang={lang}/>
        <FeatureFlags theme={T} density={density} lang={lang}/>
      </div>
    </>
  );
}

function AdminTenantsView({ theme, density, lang, onOpen }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Customers','العملاء')}
        title={s('All tenants','كل العملاء')}
        sub={s('47 active · 3 onboarding · 1 paused','٤٧ نشط · ٣ في الإعداد · ١ متوقف')}
        right={<>
          <HRButton theme={T} variant="secondary" icon="download">{s('Export','تصدير')}</HRButton>
          <HRButton theme={T} icon="plus">{s('Invite tenant','دعوة عميل')}</HRButton>
        </>}/>
      <TenantsTable theme={T} density={density} lang={lang} onOpen={onOpen}/>
    </>
  );
}

function AdminContentView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Content library','مكتبة المحتوى')}
        title={s('Catalogue','الكتالوج')}
        sub={s('412 items across 4 languages · 18 in review','٤١٢ عنصر بـ ٤ لغات · ١٨ قيد المراجعة')}
        right={<>
          <HRButton theme={T} variant="secondary" icon="filter">{s('Filter','تصفية')}</HRButton>
          <HRButton theme={T} icon="plus">{s('Upload','رفع')}</HRButton>
        </>}/>

      <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap: DENSITY[density].gap }}>
        <ContentHealth theme={T} density={density} lang={lang}/>
        <Panel theme={T} density={density} pad={false}>
          <PanelHeader theme={T} density={density} title={s('Moderation queue','قائمة الإشراف')} subtitle={s('10 awaiting review','١٠ بانتظار المراجعة')}/>
          <div>
            {[
              { title: s('Stress at work, 5-min reset','استراحة من التوتر في ٥ دقائق'), kind:'audio', author:'Noah K.', flag: s('Pending review','بانتظار المراجعة'), tone:'caution' },
              { title: s('Sleep onset — Arabic localization','بداية النوم — توطين عربي'),  kind:'audio', author:'Layla Q.', flag: s('Translation','ترجمة'), tone:'info' },
              { title: s('Manage burnout (article)','التعامل مع الإرهاق (مقال)'),         kind:'article', author:'Priya S.', flag: s('Awaiting clinical sign-off','بانتظار اعتماد إكلينيكي'), tone:'caution' },
              { title: s('Desk mobility v2','حركات مكتبية v2'),                            kind:'video', author:'Tomás O.', flag: s('Re-encode failed','فشل إعادة التشفير'), tone:'danger' },
            ].map((it, i, arr) => {
              const icon = { audio:'broadcasts', video:'content', article:'reports', breath:'leaf' }[it.kind] || 'content';
              return (
                <div key={i} style={{
                  padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
                  display:'flex', alignItems:'center', gap: 12,
                  borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
                }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:T.panelSunk, display:'grid', placeItems:'center', color:T.textMuted }}>
                    <HRIcon name={icon} size={15}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize: 13, color: T.text, fontWeight: 600, lineHeight:1.3 }}>{it.title}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{it.author}</div>
                  </div>
                  <Badge theme={T} tone={it.tone}>{it.flag}</Badge>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density} title={s('Content catalogue','الكتالوج الكامل')} subtitle={`412 ${s('items','عنصر')}`}
          right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{s('All','الكل')}</HRButton>}/>
        <div>
          <div style={{
            display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 36px',
            padding: `12px ${DENSITY[density].cardPad}px`,
            fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: 0.6, textTransform: 'uppercase',
            borderBottom: `1px solid ${T.divider}`, background: T.panelSunk,
          }}>
            <div>{s('Title','العنوان')}</div>
            <div>{s('Type','النوع')}</div>
            <div>{s('Languages','اللغات')}</div>
            <div style={{ textAlign:'end' }}>{s('Plays (30d)','تشغيل (٣٠ي)')}</div>
            <div>{s('Status','حالة')}</div>
            <div></div>
          </div>
          {[
            { title: s('Sleep onset — a cue for tonight','بداية النوم — إشارة لهذه الليلة'), kind:'audio', langs: 'EN · AR · FR', plays: 18420, status:'published' },
            { title: s('3-min reset','استراحة ٣ دقائق'), kind:'breath', langs:'EN · AR', plays: 14210, status:'published' },
            { title: s('Desk mobility flow','حركات مكتبية'), kind:'video', langs:'EN', plays: 11804, status:'published' },
            { title: s('Manage stress at work','إدارة التوتر في العمل'), kind:'article', langs:'EN · AR · FR', plays: 9820, status:'published' },
            { title: s('Box breathing, guided','تنفس مربع، موجَّه'), kind:'audio', langs:'EN · AR', plays: 8120, status:'published' },
            { title: s('Caffeine cut-off, in plain terms','الكافيين بلغة واضحة'), kind:'article', langs:'EN', plays: 6420, status:'review' },
            { title: s('Build an evening wind-down','بناء روتين استرخاء مسائي'), kind:'article', langs:'EN · AR', plays: 5210, status:'draft' },
          ].map((c,i,arr) => {
            const tone = { published:'success', review:'caution', draft:'neutral' }[c.status];
            const lab = { published:s('Published','منشور'), review:s('In review','قيد المراجعة'), draft:s('Draft','مسودة') }[c.status];
            const icon = { audio:'broadcasts', video:'content', article:'reports', breath:'leaf' }[c.kind];
            return (
              <div key={i} style={{
                display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 36px',
                padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
                fontSize: 13, alignItems: 'center',
                borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                  <div style={{ width:30, height:30, borderRadius:7, background:T.panelSunk, display:'grid', placeItems:'center', color:T.textMuted, flexShrink:0 }}>
                    <HRIcon name={icon} size={14}/>
                  </div>
                  <span style={{ color:T.text, fontWeight: 600 }}>{c.title}</span>
                </div>
                <div style={{ color:T.textMuted, fontSize: 12, textTransform:'capitalize' }}>{c.kind}</div>
                <div style={{ color:T.textMuted, fontSize: 12 }}>{c.langs}</div>
                <div className="mono" style={{ textAlign:'end', color: T.text, fontWeight: 600 }}>{c.plays.toLocaleString()}</div>
                <div><Badge theme={T} tone={tone}>{lab}</Badge></div>
                <button style={{ background:'transparent', border:'none', color:T.textMuted, cursor:'pointer', padding:6 }}>
                  <HRIcon name="more" size={16}/>
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

function AdminIntegrationsView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Integrations','التكاملات')}
        title={s('System health','صحة الأنظمة')}
        sub={s('7 of 8 healthy · 1 incident · last sweep 30s ago','٧ من ٨ سليم · ١ حادثة · آخر فحص قبل ٣٠ث')}
        right={<HRButton theme={T} icon="plus">{s('Add integration','أضف تكاملًا')}</HRButton>}/>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap: DENSITY[density].gap }}>
        {[
          { label: s('Operational','يعمل'), val: '7', tone: '#6FC79B' },
          { label: s('Degraded','مُقلَّص'), val: '1', tone: '#F5B544' },
          { label: s('Down','معطّل'),    val: '1', tone: '#E08A6B' },
          { label: s('Total syncs / day','مزامنات / يوم'), val: '184', tone: T.text },
        ].map((k, i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div className="display" style={{ fontSize: 32, color: k.tone, letterSpacing: -1, lineHeight: 1, fontWeight: 400 }}>{k.val}</div>
          </Panel>
        ))}
      </div>

      <IntegrationsStatus theme={T} density={density} lang={lang}/>
    </>
  );
}

function AdminFlagsView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Feature flags','الخصائص التجريبية')}
        title={s('Rollout control','إدارة الإطلاق')}
        sub={s('6 active flags · 2 in rollout · staging mirrors prod','٦ خصائص نشطة · ٢ في الإطلاق التدريجي')}
        right={<HRButton theme={T} icon="plus">{s('New flag','خاصية جديدة')}</HRButton>}/>
      <FeatureFlags theme={T} density={density} lang={lang}/>
    </>
  );
}

function AdminAuditView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Audit & compliance','التدقيق والامتثال')}
        title={s('Audit log','سجل التدقيق')}
        sub={s('All admin actions, immutable · SOC 2 Type II · GDPR/HIPAA','جميع الإجراءات الإدارية، ثابتة')}
        right={<HRButton theme={T} variant="secondary" icon="download">{s('Export 90 days','تصدير ٩٠ يومًا')}</HRButton>}/>
      <AuditLog theme={T} density={density} lang={lang}/>
    </>
  );
}

function AdminRolesView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const roles = [
    { name: s('Super admin','مسؤول أعلى'), members: 4, scope: s('Everything','كل شيء'), tone:'danger' },
    { name: s('Platform admin','مسؤول منصة'), members: 8, scope: s('Tenants, content, flags','عملاء، محتوى، خصائص'), tone:'caution' },
    { name: s('Content ops','عمليات المحتوى'), members: 12, scope: s('Library, moderation','مكتبة، إشراف'), tone:'info' },
    { name: s('Customer success','نجاح العملاء'), members: 14, scope: s('Tenants (read), broadcasts','عملاء (قراءة)'), tone:'info' },
    { name: s('Support','دعم'), members: 22, scope: s('Tickets, audit (read)','تذاكر، تدقيق (قراءة)'), tone:'neutral' },
    { name: s('Read-only','قراءة فقط'), members: 6, scope: s('Dashboards only','لوحات فقط'), tone:'neutral' },
  ];
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Users & roles','المستخدمون والأدوار')}
        title={s('Internal access','الوصول الداخلي')}
        sub={s('66 staff · 6 roles · MFA enforced','٦٦ موظف · ٦ أدوار · MFA مُفعّل')}
        right={<HRButton theme={T} icon="plus">{s('Invite teammate','ادعُ زميلًا')}</HRButton>}/>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap: DENSITY[density].gap }}>
        {roles.map((r,i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{r.scope}</div>
              </div>
              <Badge theme={T} tone={r.tone}>{r.members} {s('members','عضو')}</Badge>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop: 10, borderTop: `1px solid ${T.divider}` }}>
              <div style={{ display:'flex' }}>
                {Array.from({ length: Math.min(5, r.members) }).map((_,j) => (
                  <div key={j} style={{
                    width: 26, height: 26, borderRadius: 999,
                    background: ['#7AB8A6','#F5B544','#E08A6B','#A39EDB','#92C7CF'][j],
                    border: `2px solid ${T.panel}`,
                    marginInlineStart: j === 0 ? 0 : -8,
                    color: '#fff', fontSize: 10, fontWeight: 700,
                    display:'grid', placeItems:'center',
                  }}>{['M','N','P','T','S'][j]}</div>
                ))}
                {r.members > 5 && (
                  <div style={{
                    width: 26, height: 26, borderRadius: 999, background: T.panelSunk,
                    border: `2px solid ${T.panel}`, marginInlineStart: -8,
                    color: T.textMuted, fontSize: 10, fontWeight: 700,
                    display:'grid', placeItems:'center',
                  }}>+{r.members - 5}</div>
                )}
              </div>
              <HRButton theme={T} variant="ghost" size="sm" iconR="chev">{s('Manage','إدارة')}</HRButton>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

function AdminLocalizationView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const locales = [
    { code:'en', name:'English',  region:'Global',         coverage: 100, items: 412, missing: 0, tone:'success' },
    { code:'ar', name:'العربية',  region:'MENA',           coverage: 96,  items: 396, missing: 16, tone:'success' },
    { code:'fr', name:'Français', region:'Maghreb · EU',   coverage: 64,  items: 264, missing: 148, tone:'caution' },
    { code:'tr', name:'Türkçe',   region:'Türkiye',        coverage: 28,  items: 116, missing: 296, tone:'caution' },
    { code:'de', name:'Deutsch',  region:'EU',             coverage: 12,  items: 48,  missing: 364, tone:'danger' },
  ];
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Localization','التعريب')}
        title={s('Languages & coverage','اللغات والتغطية')}
        sub={s('5 locales live · RTL & LTR layouts · clinical review per locale','٥ لغات · تخطيطات RTL/LTR · مراجعة إكلينيكية لكل لغة')}
        right={<HRButton theme={T} icon="plus">{s('Add locale','أضف لغة')}</HRButton>}/>

      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density} title={s('Translation status','حالة الترجمة')}/>
        <div>
          <div style={{
            display:'grid', gridTemplateColumns:'1.4fr 1fr 1.6fr 1fr 1fr',
            padding:`12px ${DENSITY[density].cardPad}px`,
            fontSize:10, fontWeight:700, color:T.textMuted, letterSpacing:0.6, textTransform:'uppercase',
            borderBottom:`1px solid ${T.divider}`, background:T.panelSunk,
          }}>
            <div>{s('Locale','اللغة')}</div>
            <div>{s('Region','المنطقة')}</div>
            <div>{s('Coverage','التغطية')}</div>
            <div style={{ textAlign:'end' }}>{s('Translated','مترجم')}</div>
            <div style={{ textAlign:'end' }}>{s('Missing','ناقص')}</div>
          </div>
          {locales.map((l,i,arr) => (
            <div key={l.code} style={{
              display:'grid', gridTemplateColumns:'1.4fr 1fr 1.6fr 1fr 1fr',
              padding:`${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
              fontSize:13, alignItems:'center',
              borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span className="mono" style={{ fontSize: 11, padding:'2px 6px', borderRadius:5, background:T.panelSunk, color:T.textMuted }}>{l.code.toUpperCase()}</span>
                <span style={{ color: T.text, fontWeight: 600 }}>{l.name}</span>
              </div>
              <div style={{ color: T.textMuted, fontSize: 12 }}>{l.region}</div>
              <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                <div style={{ flex:1, height: 8, background:T.panelSunk, borderRadius: 4, overflow:'hidden' }}>
                  <div style={{ width:`${l.coverage}%`, height:'100%',
                    background: l.coverage > 80 ? '#6FC79B' : l.coverage > 40 ? '#F5B544' : '#E08A6B' }}/>
                </div>
                <span className="mono" style={{ fontSize: 11, color: T.text, fontWeight: 600, minWidth: 36, textAlign:'end' }}>{l.coverage}%</span>
              </div>
              <div className="mono" style={{ textAlign:'end', color: T.text }}>{l.items}</div>
              <div className="mono" style={{ textAlign:'end', color: l.missing === 0 ? T.textFaint : T.text }}>{l.missing}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function AdminChallengeTemplatesView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const templates = [
    { name: s('10k Steps × 2 weeks','١٠ آلاف خطوة × أسبوعين'), kind:'movement', uses: 142, success: '78%', emoji:'👟' },
    { name: s('No-screens after 22:00','لا شاشات بعد ٢٢:٠٠'),     kind:'sleep',    uses:  98, success: '52%', emoji:'🌙' },
    { name: s('5 check-ins / week','٥ فحوصات أسبوعيًا'),         kind:'mood',     uses: 220, success: '84%', emoji:'✓' },
    { name: s('Hydration: 8 cups','الترطيب: ٨ أكواب'),           kind:'movement', uses:  76, success: '61%', emoji:'💧' },
    { name: s('5-min stretch break','استراحة تمدد ٥ دقائق'),     kind:'movement', uses: 188, success: '69%', emoji:'🧘'},
    { name: s('Gratitude × 21 days','الامتنان × ٢١ يومًا'),      kind:'mood',     uses:  64, success: '74%', emoji:'☀️' },
  ];
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Challenge templates','قوالب التحديات')}
        title={s('Library','المكتبة')}
        sub={s('Tenants pick from these · 24 templates total · localized to 3+ languages','يختار العملاء من هذه القوالب')}
        right={<HRButton theme={T} icon="plus">{s('New template','قالب جديد')}</HRButton>}/>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap: DENSITY[density].gap }}>
        {templates.map((t,i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 12 }}>
              <div style={{ width:42, height: 42, borderRadius:10, background:T.panelSunk, display:'grid', placeItems:'center', fontSize: 22 }}>{t.emoji}</div>
              <Badge theme={T} tone="neutral">{t.kind}</Badge>
            </div>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>{t.name}</div>
            <div style={{ display: 'flex', justifyContent:'space-between', alignItems:'center', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.divider}` }}>
              <div>
                <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>{s('Used by','مستخدم من')}</div>
                <div className="mono" style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.uses} {s('tenants','عملاء')}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700, textAlign:'end' }}>{s('Completion','إكمال')}</div>
                <div className="mono" style={{ fontSize: 13, color: T.accent, fontWeight: 600, textAlign:'end' }}>{t.success}</div>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

window.AdminPageHeader = AdminPageHeader;
window.AdminOverview = AdminOverview;
window.AdminTenantsView = AdminTenantsView;
window.AdminContentView = AdminContentView;
window.AdminIntegrationsView = AdminIntegrationsView;
window.AdminFlagsView = AdminFlagsView;
window.AdminAuditView = AdminAuditView;
window.AdminRolesView = AdminRolesView;
window.AdminLocalizationView = AdminLocalizationView;
window.AdminChallengeTemplatesView = AdminChallengeTemplatesView;
// --- admin-tenant-billing.jsx ---
// Admin: Tenant detail drill-in + Billing view

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

window.AdminTenantDetail = AdminTenantDetail;
window.AdminBilling = AdminBilling;
// --- admin-app.jsx ---
// Admin Portal — main app shell with Tweaks

const ADMIN_DEFAULTS = /*EDITMODE-BEGIN*/{
  "themeKey": "dark",
  "lang": "en",
  "density": "comfortable",
  "chartStyle": "area",
  "layout": "default"
}/*EDITMODE-END*/;

function AdminApp() {
  const [themeKey, setThemeKey] = React.useState(ADMIN_DEFAULTS.themeKey);
  const [lang, setLang]         = React.useState(ADMIN_DEFAULTS.lang);
  const [density, setDensity]   = React.useState(ADMIN_DEFAULTS.density);
  const [chartStyle, setChartStyle] = React.useState(ADMIN_DEFAULTS.chartStyle);
  const [layout, setLayout]     = React.useState(ADMIN_DEFAULTS.layout);
  const [active, setActive]     = React.useState('overview');
  const [openTenant, setOpenTenant] = React.useState(null);
  const [range, setRange]       = React.useState('30d');
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [editAvail, setEditAvail] = React.useState(false);

  const T = HR_THEMES[themeKey];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const s = (en, ar) => lang === 'ar' ? ar : en;

  React.useEffect(() => {
    document.body.dataset.rtl = dir === 'rtl';
    document.body.style.background = T.bg;
  }, [dir, T.bg]);

  React.useEffect(() => {
    const h = (e) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', h);
    setEditAvail(true);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', h);
  }, []);

  const persist = (patch) => {
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*'); } catch(e){}
  };
  const setT = (k, fn) => (v) => { fn(v); persist({ [k]: v }); };

  return (
    <div data-rtl={dir==='rtl'} style={{
      minHeight: '100vh', background: T.bg, color: T.text,
      display: 'flex', direction: dir,
    }}>
      <AdminSidebar theme={T} active={active} onNav={(id) => { setActive(id); setOpenTenant(null); }} lang={lang}/>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AdminTopBar theme={T} lang={lang} dir={dir} range={range} onRange={setRange} onTweaks={() => setTweaksOpen(o=>!o)}/>

        <main style={{
          padding: 24, display: 'flex', flexDirection: 'column', gap: DENSITY[density].gap,
          maxWidth: layout === 'wide' ? 'none' : 1480, width: '100%', margin: '0 auto', boxSizing: 'border-box',
        }}>
          {openTenant ? (
            <AdminTenantDetail theme={T} density={density} lang={lang} tenant={openTenant} onBack={() => setOpenTenant(null)}/>
          ) : active === 'billing' ? (
            <AdminBilling theme={T} density={density} lang={lang}/>
          ) : active === 'tenants' ? (
            <AdminTenantsView theme={T} density={density} lang={lang} onOpen={setOpenTenant}/>
          ) : active === 'content' ? (
            <AdminContentView theme={T} density={density} lang={lang}/>
          ) : active === 'integrations' ? (
            <AdminIntegrationsView theme={T} density={density} lang={lang}/>
          ) : active === 'flags' ? (
            <AdminFlagsView theme={T} density={density} lang={lang}/>
          ) : active === 'audit' ? (
            <AdminAuditView theme={T} density={density} lang={lang}/>
          ) : active === 'roles' ? (
            <AdminRolesView theme={T} density={density} lang={lang}/>
          ) : active === 'localization' ? (
            <AdminLocalizationView theme={T} density={density} lang={lang}/>
          ) : active === 'challenges' ? (
            <AdminChallengeTemplatesView theme={T} density={density} lang={lang}/>
          ) : (
            <AdminOverview theme={T} density={density} chartStyle={chartStyle} layout={layout} lang={lang} onOpenTenant={setOpenTenant}/>
          )}

          <footer style={{ padding: '16px 0 32px', display: 'flex', justifyContent: 'space-between', color: T.textFaint, fontSize: 11 }}>
            <span>Wellness+ Admin · v2026.04.29 · region eu-west</span>
            <span className="mono">build a8d4f10 · {s('signed in as Maya Reyes','مسجَّل كـ Maya Reyes')}</span>
          </footer>
        </main>
      </div>

      {tweaksOpen && (
        <div style={{
          position: 'fixed', bottom: 18, insetInlineEnd: 18, width: 300,
          background: T.panel, color: T.text, borderRadius: 16,
          border: `1px solid ${T.borderStrong}`, boxShadow: T.shadowMd,
          zIndex: 100, overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{s('Tweaks','التعديلات')}</div>
            <button onClick={() => { setTweaksOpen(false); window.parent.postMessage({type:'__edit_mode_dismissed'},'*'); }}
              style={{ background:'transparent', border:'none', color:T.textMuted, cursor:'pointer' }}>
              <HRIcon name="close" size={16}/>
            </button>
          </div>
          <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TweakRow label={s('Theme','المظهر')}>
              {[['dark','Dark'],['light','Light']].map(([k,l])=>(
                <SegBtn key={k} theme={T} active={themeKey===k} onClick={()=>setT('themeKey',setThemeKey)(k)}>{l}</SegBtn>
              ))}
            </TweakRow>
            <TweakRow label={s('Language','اللغة')}>
              {[['en','EN'],['ar','AR']].map(([k,l])=>(
                <SegBtn key={k} theme={T} active={lang===k} onClick={()=>setT('lang',setLang)(k)}>{l}</SegBtn>
              ))}
            </TweakRow>
            <TweakRow label={s('Density','الكثافة')}>
              {[['compact',s('Compact','مكثف')],['comfortable',s('Comfortable','مريح')]].map(([k,l])=>(
                <SegBtn key={k} theme={T} active={density===k} onClick={()=>setT('density',setDensity)(k)}>{l}</SegBtn>
              ))}
            </TweakRow>
            <TweakRow label={s('Chart','الرسم')}>
              {[['line',s('Line','خط')],['area',s('Area','مساحة')],['bar',s('Bar','عمود')]].map(([k,l])=>(
                <SegBtn key={k} theme={T} active={chartStyle===k} onClick={()=>setT('chartStyle',setChartStyle)(k)}>{l}</SegBtn>
              ))}
            </TweakRow>
            <TweakRow label={s('Layout','التخطيط')}>
              {[['default',s('Default','افتراضي')],['wide',s('Wide','واسع')],['split',s('Split','مقسم')]].map(([k,l])=>(
                <SegBtn key={k} theme={T} active={layout===k} onClick={()=>setT('layout',setLayout)(k)}>{l}</SegBtn>
              ))}
            </TweakRow>
          </div>
        </div>
      )}
    </div>
  );
}

function TweakRow({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(128,128,128,0.6)', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}
function SegBtn({ theme, active, onClick, children }) {
  const T = theme;
  return (
    <button onClick={onClick} style={{
      flex: 1, height: 30, padding: '0 8px', borderRadius: 7, minWidth: 50,
      background: active ? T.accent : T.panelSunk,
      color: active ? T.accentInk : T.text,
      border: `1px solid ${active ? 'transparent' : T.border}`,
      fontSize: 11, fontWeight: 600, cursor: 'pointer',
    }}>{children}</button>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp/>);
