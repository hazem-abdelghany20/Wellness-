import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { HR_THEMES, DENSITY, HR_STRINGS } from './shared/tokens.jsx';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from './shared/components.jsx';
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
