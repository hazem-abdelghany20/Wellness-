import React from 'react';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from '../shared/components.jsx';

// --- admin-sections.jsx ---
// Admin Portal — sections (uses hr-tokens + hr-components)

const ADMIN_DATA = {
  kpis: [
    { key: 'tenants', label: { en: 'Active tenants', ar: 'العملاء النشطون' }, value: 47, delta: 3,  invert: false, suffix: '',
      spark: [38, 40, 41, 43, 44, 46, 47] },
    { key: 'seats',   label: { en: 'Active seats',   ar: 'المقاعد النشطة' }, value: 28412, delta: 4.6, invert: false, suffix: '', fmt: v => v.toLocaleString(),
      spark: [25100, 25800, 26400, 26900, 27500, 28000, 28412] },
    { key: 'damau',   label: { en: 'DAU / MAU',      ar: 'يومي / شهري' }, value: 0.42, delta: 0.03, invert: false, suffix: '', fmt: v => v.toFixed(2),
      spark: [0.36, 0.37, 0.38, 0.40, 0.41, 0.41, 0.42] },
    { key: 'plays',   label: { en: 'Content plays',  ar: 'تشغيل المحتوى' }, value: 184320, delta: 8.2, invert: false, suffix: '/wk', fmt: v => (v/1000).toFixed(0)+'k',
      spark: [142000, 152000, 158000, 165000, 172000, 178000, 184320] },
    { key: 'uptime',  label: { en: 'API uptime',     ar: 'وقت تشغيل API' }, value: 99.98, delta: 0.01, invert: false, suffix: '%', fmt: v => v.toFixed(2),
      spark: [99.94, 99.96, 99.95, 99.97, 99.98, 99.98, 99.98] },
  ],
  tenants: [
    { name: 'Nile Group',          plan: 'Enterprise', region: 'EG · Cairo',     seats: 2400, used: 1820, arr: 168, health: 92, churn: 'low',  joined: 'Mar 2024', mau: 1284 },
    { name: 'Riyadh Bank',         plan: 'Enterprise', region: 'SA · Riyadh',    seats: 5800, used: 4910, arr: 412, health: 88, churn: 'low',  joined: 'Jul 2024', mau: 3621 },
    { name: 'Cedar Telecom',       plan: 'Enterprise', region: 'AE · Dubai',     seats: 3200, used: 2640, arr: 224, health: 81, churn: 'low',  joined: 'Sep 2024', mau: 1980 },
    { name: 'Heliopolis Hospital', plan: 'Pro',        region: 'EG · Cairo',     seats:  900, used:  812, arr:  54, health: 79, churn: 'low',  joined: 'Nov 2024', mau:  640 },
    { name: 'Atlas Logistics',     plan: 'Pro',        region: 'MA · Casablanca',seats: 1200, used:  680, arr:  72, health: 58, churn: 'med',  joined: 'Jan 2025', mau:  410 },
    { name: 'Levant Retail Co.',   plan: 'Pro',        region: 'JO · Amman',     seats:  600, used:  420, arr:  36, health: 66, churn: 'med',  joined: 'Feb 2025', mau:  260 },
    { name: 'Nordic Holdings',     plan: 'Enterprise', region: 'NO · Oslo',      seats: 2100, used: 1480, arr: 168, health: 71, churn: 'med',  joined: 'Aug 2024', mau:  920 },
    { name: 'Doha Energy',         plan: 'Enterprise', region: 'QA · Doha',      seats: 4400, used: 3960, arr: 308, health: 94, churn: 'low',  joined: 'Apr 2024', mau: 2940 },
    { name: 'Beirut Media Group',  plan: 'Pro',        region: 'LB · Beirut',    seats:  450, used:  180, arr:  27, health: 38, churn: 'high', joined: 'Mar 2025', mau:   88 },
    { name: 'Suez Industrial',     plan: 'Pro',        region: 'EG · Suez',      seats: 1800, used: 1520, arr:  108, health: 84, churn: 'low', joined: 'Oct 2024', mau: 1100 },
  ],
  damauSeries: [
    { key: 'dau', name: 'DAU', values: [9800, 10200, 10800, 11200, 11600, 11900, 12100, 12400] },
    { key: 'mau', name: 'MAU', values: [24800, 25400, 26100, 26800, 27400, 27900, 28200, 28412] },
  ],
  damauLabels: ['Mar 2','Mar 9','Mar 16','Mar 23','Mar 30','Apr 6','Apr 13','Apr 20'],
  content: {
    total: 412, published: 384, draft: 18, review: 10,
    byKind: [
      { kind: 'audio',   count: 188, mins: 1820 },
      { kind: 'video',   count: 96,  mins: 740 },
      { kind: 'article', count: 110, mins: 0 },
      { kind: 'breath',  count: 18,  mins: 84 },
    ],
    coverage: [
      { lang: 'English',  pct: 100 },
      { lang: 'العربية',  pct: 96 },
      { lang: 'Français', pct: 64 },
      { lang: 'Türkçe',   pct: 28 },
    ],
    topPlays: [
      { title: 'Sleep onset — a cue for tonight', plays: 18420, kind: 'audio' },
      { title: '3-min reset',                     plays: 14210, kind: 'breath' },
      { title: 'Desk mobility flow',              plays: 11804, kind: 'video' },
      { title: 'Manage stress at work',           plays:  9820, kind: 'article' },
    ],
  },
  integrations: [
    { name: 'Okta SSO',         status: 'ok',   tenants: 32, version: 'SAML 2.0',  last: '2 min ago' },
    { name: 'Microsoft Entra',  status: 'ok',   tenants: 11, version: 'OIDC',      last: '4 min ago' },
    { name: 'Workday HRIS',     status: 'warn', tenants:  8, version: 'API v40',   last: '38 min ago — 2 sync errors' },
    { name: 'BambooHR',         status: 'ok',   tenants: 14, version: 'API v1',    last: '1 min ago' },
    { name: 'Slack',            status: 'ok',   tenants: 28, version: 'App',       last: 'realtime' },
    { name: 'Microsoft Teams',  status: 'ok',   tenants: 19, version: 'Bot',       last: 'realtime' },
    { name: 'Apple Health',     status: 'ok',   tenants: '—', version: 'iOS',      last: 'client-side' },
    { name: 'Health Connect',   status: 'down', tenants: '—', version: 'Android',  last: 'incident · 1h 14m' },
  ],
  audit: [
    { time: '14:42:08', actor: 'system',         action: 'tenant.health.recalc',      target: '47 tenants',           sev: 'info' },
    { time: '14:38:51', actor: 'maya.r@wellness',action: 'flag.toggle',                target: 'leaderboard_v2 → 12%', sev: 'info' },
    { time: '14:31:02', actor: 'noah.k@wellness',action: 'content.publish',            target: 'Sleep onset (en, ar)', sev: 'info' },
    { time: '14:18:34', actor: 'system',         action: 'integration.alert',          target: 'Health Connect down',  sev: 'warn' },
    { time: '13:55:11', actor: 'priya.s@wellness',action: 'tenant.suspend',            target: 'demo-acme.test',        sev: 'warn' },
    { time: '13:42:09', actor: 'maya.r@wellness',action: 'role.assign',                target: 'Riyadh Bank → +1 Admin',sev: 'info' },
    { time: '13:21:46', actor: 'system',         action: 'export.generated',           target: 'Nile Group · Q1 PDF',  sev: 'info' },
    { time: '12:58:03', actor: 'system',         action: 'pipeline.metrics.lag',       target: 'kafka.offset +12k',    sev: 'warn' },
  ],
  flags: [
    { key: 'leaderboard_v2',     desc: 'Team leaderboard with anon ranks',     pct: 12,  state: 'rollout', envs: ['prod'] },
    { key: 'ramadan_mode',       desc: 'Schedule-aware content surface',       pct: 100, state: 'on',      envs: ['prod','staging'] },
    { key: 'voice_check_in',     desc: 'Daily check-in via voice',             pct: 0,   state: 'off',     envs: ['staging'] },
    { key: 'manager_dashboard',  desc: 'Direct-report wellbeing for HR',       pct: 100, state: 'on',      envs: ['prod','staging'] },
    { key: 'crisis_handoff_ar',  desc: 'Arabic crisis hotline routing',        pct: 100, state: 'on',     envs: ['prod'] },
    { key: 'wear_os_pair',       desc: 'Pair Wear OS device',                  pct: 35,  state: 'rollout', envs: ['prod'] },
  ],
  team: [
    { name: 'Maya Reyes',  role: 'Platform Lead',     email: 'maya.r@wellness.app', last: '5m' },
    { name: 'Noah Karim',  role: 'Content Ops',       email: 'noah.k@wellness.app', last: '12m' },
    { name: 'Priya Suresh',role: 'Customer Success',  email: 'priya.s@wellness.app',last: '1h' },
    { name: 'Tomás Ortiz', role: 'SRE on-call',       email: 'tom.o@wellness.app',  last: 'now' },
  ],
};

// ── SIDEBAR ──────────────────────────────────────────────────────
function AdminSidebar({ theme, active, onNav, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const items = [
    { id: 'overview',   icon: 'dashboard',   label: s('Overview', 'نظرة عامة') },
    { id: 'tenants',    icon: 'people',      label: s('Tenants', 'العملاء') },
    { id: 'roles',      icon: 'teams',       label: s('Users & Roles', 'المستخدمون والأدوار') },
    { id: 'content',    icon: 'content',     label: s('Content Library', 'مكتبة المحتوى') },
    { id: 'challenges', icon: 'challenges',  label: s('Challenge Templates', 'قوالب التحديات') },
    { id: 'integrations', icon: 'globe',     label: s('Integrations', 'التكاملات') },
    { id: 'localization', icon: 'mail',      label: s('Localization', 'التعريب') },
    { id: 'flags',      icon: 'sparkle',     label: s('Feature Flags', 'الخصائص التجريبية'), badge: 2 },
    { id: 'audit',      icon: 'shield',      label: s('Audit Log', 'سجل التدقيق') },
    { id: 'billing',    icon: 'reports',     label: s('Billing', 'الفوترة') },
  ];
  return (
    <aside style={{
      width: 232, flexShrink: 0, background: T.sidebarBg, color: T.sidebarText,
      display: 'flex', flexDirection: 'column',
      borderInlineEnd: `1px solid rgba(245,241,232,0.06)`,
      position: 'sticky', top: 0, height: '100vh', zIndex: 10,
    }}>
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="assets/wellness-mark.png" alt="" style={{ height: 22, filter: 'brightness(0) invert(1)' }}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: T.sidebarMark, letterSpacing: -0.3, lineHeight: 1 }}>
            Wellness<span style={{ color: T.sidebarActive }}>+</span>
          </div>
          <div style={{ fontSize: 9.5, color: 'rgba(245,241,232,0.45)', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>
            {s('Admin Console','وحدة الإدارة')}
          </div>
        </div>
      </div>

      {/* Env switcher */}
      <div style={{ padding: '4px 14px 12px' }}>
        <div style={{
          background: 'rgba(245,241,232,0.06)', borderRadius: 10,
          padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
          border: '1px solid rgba(245,241,232,0.06)',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#6FC79B', boxShadow: '0 0 0 3px rgba(111,199,155,0.18)' }}/>
          <div style={{ flex: 1, lineHeight: 1.2 }}>
            <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.55)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{s('Environment','البيئة')}</div>
            <div style={{ fontSize: 12, color: T.sidebarMark, fontWeight: 600 }}>production · eu-west</div>
          </div>
          <HRIcon name="chevDown" size={14} stroke="rgba(245,241,232,0.55)"/>
        </div>
      </div>

      <div style={{ padding: '0 14px' }}>
        {items.map(it => {
          const isActive = active === it.id;
          return (
            <button key={it.id} onClick={() => onNav(it.id)} style={{
              width: '100%', padding: '9px 12px',
              display: 'flex', alignItems: 'center', gap: 12,
              background: isActive ? 'rgba(245,181,68,0.12)' : 'transparent',
              color: isActive ? T.sidebarActive : T.sidebarText,
              border: 'none', borderRadius: 10, cursor: 'pointer', marginBottom: 2,
              fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
              borderInlineStart: isActive ? `2px solid ${T.sidebarActive}` : '2px solid transparent',
            }}>
              <HRIcon name={it.icon} size={18}/>
              <span style={{ flex: 1, textAlign: 'start' }}>{it.label}</span>
              {it.badge && (
                <span style={{
                  minWidth: 20, height: 18, padding: '0 6px', borderRadius: 999,
                  background: '#F5B544', color: '#1A1206',
                  fontSize: 10, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{it.badge}</span>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1 }}/>
      <div style={{ padding: 14, borderTop: '1px solid rgba(245,241,232,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AvatarMark theme={T} name="Maya Reyes" size={32}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: T.sidebarMark, fontWeight: 600 }}>Maya Reyes</div>
            <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.5)' }}>Platform Lead</div>
          </div>
          <HRIcon name="more" size={16} stroke="rgba(245,241,232,0.55)"/>
        </div>
      </div>
    </aside>
  );
}

// ── TOP BAR ────────────────────────────────────────────────────
function AdminTopBar({ theme, lang, dir, range, onRange, onTweaks }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <div style={{
      height: 64, borderBottom: `1px solid ${T.border}`, background: T.panel,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, position: 'sticky', top: 0, zIndex: 5,
    }}>
      <div style={{
        flex: 1, maxWidth: 520, height: 38, background: T.panelSunk, borderRadius: 10,
        border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10,
      }}>
        <HRIcon name="search" size={16} stroke={T.textMuted}/>
        <input placeholder={s('Search tenants, content, audit log…','ابحث في العملاء والمحتوى وسجل التدقيق…')}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: T.text, fontSize: 13,
            textAlign: dir === 'rtl' ? 'right' : 'left' }}/>
        <span className="mono" style={{
          padding: '2px 6px', borderRadius: 5, border: `1px solid ${T.border}`,
          fontSize: 10, color: T.textMuted,
        }}>⌘K</span>
      </div>

      <div style={{ flex: 1 }}/>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 10,
        background: T.isDark ? 'rgba(111,199,155,0.10)' : 'rgba(46,125,94,0.08)',
        color: T.positive, border: `1px solid ${T.border}`,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: T.positive, boxShadow: `0 0 0 3px ${T.isDark ? 'rgba(111,199,155,0.18)' : 'rgba(46,125,94,0.18)'}` }}/>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{s('All systems normal','كل الأنظمة طبيعية')}</span>
      </div>

      <div style={{ display: 'flex', background: T.panelSunk, borderRadius: 10, padding: 3, border: `1px solid ${T.border}` }}>
        {[['24h', s('24h','٢٤س')], ['7d', s('7d','٧ي')], ['30d', s('30d','٣٠ي')], ['90d', s('90d','٩٠ي')]].map(([k, l]) => (
          <button key={k} onClick={() => onRange(k)} style={{
            padding: '6px 11px', borderRadius: 7,
            background: range === k ? T.panel : 'transparent',
            color: range === k ? T.text : T.textMuted,
            border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      <HRButton theme={T} variant="secondary" icon="download">{s('Export','تصدير')}</HRButton>

      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', color: T.textMid }}>
        <HRIcon name="bell" size={18}/>
        <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 999, background: T.danger }}/>
      </button>

      <button onClick={onTweaks} style={{
        background: T.accent, color: T.accentInk, border: 'none', borderRadius: 8,
        height: 36, padding: '0 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <HRIcon name="settings" size={14}/> {s('Tweaks','التعديلات')}
      </button>
    </div>
  );
}

// ── KPI STRIP ──────────────────────────────────────────────────
function AdminKpiStrip({ theme, density, chartStyle, lang }) {
  const T = theme;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: DENSITY[density].gap }}>
      {ADMIN_DATA.kpis.map((k) => (
        <Panel key={k.key} theme={T} density={density}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              {k.label[lang]}
            </div>
            <Delta theme={T} value={k.delta} suffix={k.key === 'damau' ? '' : (k.key === 'uptime' ? 'pp' : '%')}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div className="display" style={{ fontSize: density === 'compact' ? 30 : 36, color: T.text, letterSpacing: -1, lineHeight: 1, fontWeight: 400 }}>
              {k.fmt ? k.fmt(k.value) : k.value}
              <span style={{ fontSize: 14, color: T.textMuted, marginInlineStart: 4 }}>{k.suffix}</span>
            </div>
            <Spark theme={T} values={k.spark} width={70} height={32} chartStyle={chartStyle}
              color={k.key === 'uptime' ? T.positive : T.accent}/>
          </div>
        </Panel>
      ))}
    </div>
  );
}

// ── DAU/MAU CHART ─────────────────────────────────────────────
function DauMauChart({ theme, density, chartStyle, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  // normalize MAU/DAU into 0-10 scale-equivalent for shared chart
  const series = ADMIN_DATA.damauSeries.map((sx, i) => ({
    ...sx,
    color: i === 0 ? T.accent : T.info,
    values: sx.values.map(v => (v / 30000) * 10), // scale to 0-10
    raw: sx.values,
  }));
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={s('Platform engagement','مشاركة المنصة')} subtitle={s('Daily and monthly active across all tenants','نشاط يومي وشهري عبر كل العملاء')}
        right={
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {series.map((sx, i) => (
              <div key={sx.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: sx.color }}/>
                <span style={{ fontSize: 12, color: T.textMid, fontWeight: 600 }}>{sx.name}</span>
                <span className="mono" style={{ fontSize: 12, color: T.text, fontWeight: 700 }}>
                  {sx.raw[sx.raw.length-1].toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        }/>
      <div style={{ padding: '8px 12px 18px' }}>
        <TrendChart theme={T} series={series} labels={ADMIN_DATA.damauLabels} height={240}
          chartStyle={chartStyle} activeKeys={series.map(s => s.key)}/>
      </div>
    </Panel>
  );
}

// ── TENANTS TABLE ─────────────────────────────────────────────
function TenantsTable({ theme, density, lang, onOpen }) {
  const T = theme;
  const d = DENSITY[density];
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [sort, setSort] = React.useState('arr');
  const [filter, setFilter] = React.useState('all');
  const filtered = ADMIN_DATA.tenants.filter(t => filter === 'all' || t.churn === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'arr')   return b.arr - a.arr;
    if (sort === 'seats') return b.seats - a.seats;
    if (sort === 'mau')   return b.mau - a.mau;
    if (sort === 'health')return a.health - b.health;
    return 0;
  });
  const churnTone = { low: 'positive', med: 'caution', high: 'danger' };
  const churnLabel = { low: s('Healthy','مستقر'), med: s('Watch','للمراقبة'), high: s('At risk','خطر') };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={s('Tenants','العملاء')} subtitle={`${filtered.length} ${s('total','إجمالي')} · $${(filtered.reduce((a,b)=>a+b.arr,0)/1).toFixed(0)}k ${s('ARR','إيراد سنوي متكرر')}`}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={{
              height: 32, padding: '0 10px', borderRadius: 8,
              background: T.panelSunk, border: `1px solid ${T.border}`,
              color: T.text, fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer',
            }}>
              <option value="all">{s('All churn','كل الحالات')}</option>
              <option value="low">{s('Healthy','مستقر')}</option>
              <option value="med">{s('Watch','للمراقبة')}</option>
              <option value="high">{s('At risk','خطر')}</option>
            </select>
            <HRButton theme={T} size="sm" icon="plus">{s('New tenant','عميل جديد')}</HRButton>
          </div>
        }/>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
              {[
                { key: 'name', label: s('Tenant','العميل'), align: 'start' },
                { key: 'plan', label: s('Plan','الباقة'), align: 'start' },
                { key: 'region', label: s('Region','المنطقة'), align: 'start' },
                { key: 'seats', label: s('Seats','المقاعد'), align: 'start', sortable: true },
                { key: 'mau', label: s('MAU','شهري'), align: 'end', sortable: true },
                { key: 'arr', label: s('ARR','إيراد'), align: 'end', sortable: true },
                { key: 'health', label: s('Health','الصحة'), align: 'start', sortable: true },
                { key: 'churn', label: s('Risk','المخاطر'), align: 'end' },
                { key: 'joined', label: s('Joined','تاريخ الانضمام'), align: 'end' },
                { key: 'a', label: '', align: 'end' },
              ].map(h => (
                <th key={h.key} onClick={() => h.sortable && setSort(h.key)} style={{
                  fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase',
                  color: sort === h.key ? T.text : T.textMuted, fontWeight: 700,
                  textAlign: h.align, padding: `10px ${d.cardPad}px`,
                  cursor: h.sortable ? 'pointer' : 'default',
                  position: 'sticky', top: 0, background: T.panel,
                }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => {
              const usePct = (t.used / t.seats) * 100;
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${T.divider}`, cursor: onOpen ? 'pointer' : 'default' }}
                    onClick={() => onOpen && onOpen(t)}
                    onMouseEnter={e => e.currentTarget.style.background = T.panelAlt}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AvatarMark theme={T} name={t.name} size={28}/>
                      <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px` }}>
                    <Badge theme={T} tone={t.plan === 'Enterprise' ? 'info' : 'neutral'}>{t.plan}</Badge>
                  </td>
                  <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, fontSize: 12, color: T.textMid }}>{t.region}</td>
                  <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 150 }}>
                      <div style={{ flex: 1 }}>
                        <Bullet theme={T} value={usePct} max={100}
                          color={usePct >= 80 ? T.positive : usePct >= 50 ? T.caution : T.danger}/>
                      </div>
                      <span className="mono" style={{ fontSize: 11, color: T.textMid, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {t.used.toLocaleString()}/{t.seats.toLocaleString()}
                      </span>
                    </div>
                  </td>
                  <td className="mono" style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end', color: T.text, fontWeight: 600 }}>{t.mau.toLocaleString()}</td>
                  <td className="mono" style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end', color: T.text, fontWeight: 700 }}>${t.arr}k</td>
                  <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                      <span className="mono" style={{ fontSize: 12, color: T.text, fontWeight: 600, width: 24 }}>{t.health}</span>
                      <div style={{ flex: 1 }}>
                        <Bullet theme={T} value={t.health} max={100}
                          color={t.health >= 80 ? T.positive : t.health >= 60 ? T.caution : T.danger}/>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end' }}>
                    <Badge theme={T} tone={churnTone[t.churn]} dot>{churnLabel[t.churn]}</Badge>
                  </td>
                  <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end', color: T.textMuted, fontSize: 12 }}>{t.joined}</td>
                  <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end' }}>
                    <HRButton theme={T} variant="ghost" size="sm" icon="more"/>
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

// ── CONTENT LIBRARY HEALTH ────────────────────────────────────
function ContentHealth({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const c = ADMIN_DATA.content;
  const iconFor = { audio: 'headphones', video: 'play', article: 'book', breath: 'leaf' };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={s('Content library','مكتبة المحتوى')}
        subtitle={`${c.total} ${s('items','عنصر')} · ${c.published} ${s('published','منشور')}`}
        right={<HRButton theme={T} size="sm" icon="plus">{s('Upload','رفع')}</HRButton>}/>

      <div style={{ padding: `${DENSITY[density].cardPad - 4}px ${DENSITY[density].cardPad}px ${DENSITY[density].cardPad}px` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
          {c.byKind.map(k => (
            <div key={k.kind} style={{ padding: 12, background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: T.accentSoft, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HRIcon name={iconFor[k.kind]} size={14}/>
                </div>
                <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{k.kind}</span>
              </div>
              <div className="display" style={{ fontSize: 24, color: T.text, lineHeight: 1, letterSpacing: -0.5 }}>{k.count}</div>
              <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4 }}>{k.mins>0 ? `${k.mins} min` : '—'}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 }}>
          {s('Translation coverage','تغطية الترجمة')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {c.coverage.map(cv => (
            <div key={cv.lang} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 12, color: T.text, width: 80 }}>{cv.lang}</div>
              <div style={{ flex: 1 }}>
                <Bullet theme={T} value={cv.pct} max={100} color={cv.pct >= 90 ? T.positive : cv.pct >= 60 ? T.caution : T.danger}/>
              </div>
              <span className="mono" style={{ fontSize: 12, color: T.text, fontWeight: 600, width: 36, textAlign: 'end' }}>{cv.pct}%</span>
            </div>
          ))}
        </div>

        <div style={{ height: 18 }}/>
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 }}>
          {s('Top plays this week','الأكثر تشغيلاً هذا الأسبوع')}
        </div>
        {c.topPlays.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? `1px solid ${T.divider}` : 'none' }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: T.panelSunk, color: T.textMid, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HRIcon name={iconFor[p.kind]} size={12}/>
            </div>
            <div style={{ flex: 1, fontSize: 12, color: T.text }}>{p.title}</div>
            <span className="mono" style={{ fontSize: 12, color: T.textMid, fontWeight: 600 }}>{p.plays.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── INTEGRATIONS STATUS ──────────────────────────────────────
function IntegrationsStatus({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const dot = { ok: T.positive, warn: T.caution, down: T.danger };
  const tone = { ok: 'positive', warn: 'caution', down: 'danger' };
  const lab = { ok: s('Operational','يعمل'), warn: s('Degraded','مُقلَّص'), down: s('Down','معطّل') };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={s('Integrations','التكاملات')}
        subtitle={`${ADMIN_DATA.integrations.filter(i=>i.status==='ok').length}/${ADMIN_DATA.integrations.length} ${s('healthy','سليم')}`}
        right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{s('All','الكل')}</HRButton>}/>
      <div>
        {ADMIN_DATA.integrations.map((it, i) => (
          <div key={i} style={{
            padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
            display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: i < ADMIN_DATA.integrations.length - 1 ? `1px solid ${T.divider}` : 'none',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: dot[it.status], boxShadow: `0 0 0 3px ${dot[it.status]}22` }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{it.name}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{it.version} · {it.last}</div>
            </div>
            <span className="mono" style={{ fontSize: 11, color: T.textMuted }}>{typeof it.tenants === 'number' ? `${it.tenants} ${s('tenants','عميل')}` : it.tenants}</span>
            <Badge theme={T} tone={tone[it.status]}>{lab[it.status]}</Badge>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── AUDIT LOG ─────────────────────────────────────────────────
function AuditLog({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const tone = { info: 'neutral', warn: 'caution', err: 'danger' };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={s('Audit log','سجل التدقيق')} subtitle={s('Live · last 24h','مباشر · آخر ٢٤ ساعة')}
        right={<HRButton theme={T} variant="ghost" size="sm" icon="filter"/>}/>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5 }}>
        {ADMIN_DATA.audit.map((a, i) => (
          <div key={i} style={{
            padding: `${density === 'compact' ? 7 : 9}px ${DENSITY[density].cardPad}px`,
            display: 'flex', alignItems: 'baseline', gap: 12,
            borderBottom: i < ADMIN_DATA.audit.length - 1 ? `1px solid ${T.divider}` : 'none',
          }}>
            <span style={{ color: T.textFaint, width: 60, flexShrink: 0 }}>{a.time}</span>
            <Badge theme={T} tone={tone[a.sev]} style={{ flexShrink: 0 }}>{a.sev}</Badge>
            <span style={{ color: T.textMid, width: 150, flexShrink: 0, fontSize: 11 }}>{a.actor}</span>
            <span style={{ color: T.accent, fontWeight: 600, flexShrink: 0 }}>{a.action}</span>
            <span style={{ color: T.text, flex: 1, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12 }}>{a.target}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── FEATURE FLAGS ────────────────────────────────────────────
function FeatureFlags({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const stateTone = { on: 'positive', off: 'neutral', rollout: 'caution' };
  const stateLabel = { on: s('On','مفعّل'), off: s('Off','مغلق'), rollout: s('Rollout','تدرج') };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={s('Feature flags','الخصائص التجريبية')}
        subtitle={`${ADMIN_DATA.flags.filter(f=>f.state==='rollout').length} ${s('rolling out','قيد التدرج')}`}
        right={<HRButton theme={T} size="sm" icon="plus">{s('New flag','خاصية جديدة')}</HRButton>}/>
      <div>
        {ADMIN_DATA.flags.map((f, i) => (
          <div key={i} style={{
            padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
            display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: i < ADMIN_DATA.flags.length - 1 ? `1px solid ${T.divider}` : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 12, color: T.text, fontWeight: 700 }}>{f.key}</span>
                {f.envs.map(e => (
                  <span key={e} style={{
                    fontSize: 9.5, padding: '2px 6px', borderRadius: 4,
                    background: T.panelSunk, color: T.textMuted, border: `1px solid ${T.border}`,
                    textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700,
                  }}>{e}</span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{f.desc}</div>
            </div>
            <div style={{ width: 100 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span className="mono" style={{ fontSize: 10, color: T.textFaint }}>0%</span>
                <span className="mono" style={{ fontSize: 11, color: T.text, fontWeight: 700 }}>{f.pct}%</span>
              </div>
              <Bullet theme={T} value={f.pct} max={100}
                color={f.state === 'on' ? T.positive : f.state === 'rollout' ? T.caution : T.textFaint}/>
            </div>
            <Badge theme={T} tone={stateTone[f.state]} dot>{stateLabel[f.state]}</Badge>
            <Toggle theme={T} value={f.state !== 'off'} onChange={()=>{}} size="sm"/>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── TEAM (Wellness+ team online) ─────────────────────────────
function AdminTeam({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={s('Team online','الفريق متصل')} subtitle={s('Wellness+ ops','عمليات Wellness+')}/>
      <div>
        {ADMIN_DATA.team.map((t, i) => (
          <div key={i} style={{
            padding: `${DENSITY[density].cellPadY}px ${DENSITY[density].cardPad}px`,
            display: 'flex', alignItems: 'center', gap: 10,
            borderBottom: i < ADMIN_DATA.team.length - 1 ? `1px solid ${T.divider}` : 'none',
          }}>
            <div style={{ position: 'relative' }}>
              <AvatarMark theme={T} name={t.name} size={32}/>
              <span style={{ position: 'absolute', bottom: 0, insetInlineEnd: 0, width: 9, height: 9, borderRadius: 999,
                background: T.positive, border: `2px solid ${T.panel}` }}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>{t.role}</div>
            </div>
            <span style={{ fontSize: 11, color: T.textFaint }}>{t.last}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

Object.assign(window, {
  ADMIN_DATA, AdminSidebar, AdminTopBar, AdminKpiStrip, DauMauChart,
  TenantsTable, ContentHealth, IntegrationsStatus, AuditLog, FeatureFlags, AdminTeam,
});

export {
  ADMIN_DATA, AdminSidebar, AdminTopBar, AdminKpiStrip, DauMauChart,
  TenantsTable, ContentHealth, IntegrationsStatus, AuditLog,
  FeatureFlags, AdminTeam,
};
