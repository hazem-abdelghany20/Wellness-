import React from 'react';
import { DENSITY } from '../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart, Bullet, AvatarMark, Toggle } from '../shared/components.jsx';
// --- hr-sections.jsx ---
// HR Portal sections: KPI strip, trends chart, at-risk teams, team breakdown, safety queue,
// broadcasts, content pins, active challenges, sidebar, topbar, people drawer.

// ── DATA ─────────────────────────────────────────────────────────
const HR_DATA = {
  kpis: [
    { key: 'index',  label: 'wellbeingIndex', value: 6.8, suffix: '/10', delta: 0.4, invert: false,
      spark: [6.1, 6.2, 6.0, 6.3, 6.5, 6.6, 6.8] },
    { key: 'active', label: 'weeklyActive',   value: 1284, suffix: '',  delta: 2.3, invert: false, fmt: (v) => v.toLocaleString(),
      spark: [1180, 1210, 1165, 1220, 1245, 1260, 1284] },
    { key: 'risk',   label: 'atRiskTeams',    value: 4, suffix: '',  delta: -1, invert: true,
      spark: [6, 5, 6, 5, 5, 5, 4] },
    { key: 'safety', label: 'safetyFlags',    value: 7, suffix: ' open', delta: 2, invert: true,
      spark: [3, 4, 4, 5, 6, 6, 7] },
  ],
  trends: {
    labels: ['Apr 1','Apr 4','Apr 7','Apr 10','Apr 13','Apr 16','Apr 19','Apr 22'],
    labelsAr: ['١ إبريل','٤','٧','١٠','١٣','١٦','١٩','٢٢ إبريل'],
    series: [
      { key: 'sleep',  name: 'Sleep',  values: [6.3, 6.5, 6.2, 6.6, 6.8, 6.7, 7.0, 7.1] },
      { key: 'stress', name: 'Stress', values: [6.2, 6.4, 6.5, 6.8, 6.3, 6.0, 5.7, 5.5] },
      { key: 'energy', name: 'Energy', values: [5.8, 5.9, 6.0, 6.2, 6.3, 6.5, 6.6, 6.7] },
      { key: 'mood',   name: 'Mood',   values: [6.4, 6.5, 6.6, 6.5, 6.7, 6.8, 6.9, 7.0] },
    ],
  },
  atRisk: [
    { team: 'Customer Ops — Tier 2', head: 'Marwan El-Sayed', size: 28, index: 4.6, trend: -0.8, risk: 'high',
      reason: { en: 'Elevated stress × 3 weeks', ar: 'توتر مرتفع لـ 3 أسابيع' } },
    { team: 'Finance — Accounts Payable', head: 'Farida Hassan', size: 16, index: 5.1, trend: -0.4, risk: 'high',
      reason: { en: 'Sleep dropped 1.2h', ar: 'انخفاض النوم 1.2س' } },
    { team: 'Field Sales — Delta', head: 'Khaled Ibrahim', size: 22, index: 5.4, trend: -0.2, risk: 'med',
      reason: { en: 'Engagement down 18%', ar: 'انخفاض المشاركة 18%' } },
    { team: 'Logistics — Night shift', head: 'Rania Nour', size: 19, index: 5.5, trend: -0.3, risk: 'med',
      reason: { en: 'Low recovery score', ar: 'انخفاض التعافي' } },
  ],
  teams: [
    { team: 'Engineering — Platform', dept: 'Tech',       head: 'Yousef Kamal',  size: 42, index: 7.4, trend: 0.3, risk: 'low',
      sleep: 7.2, stress: 4.9, energy: 6.8, mood: 7.1 },
    { team: 'Engineering — Mobile',   dept: 'Tech',       head: 'Dina Abbas',    size: 18, index: 6.9, trend: 0.1, risk: 'low',
      sleep: 6.8, stress: 5.4, energy: 6.6, mood: 7.0 },
    { team: 'Customer Ops — Tier 1',  dept: 'Support',    head: 'Omar Fathy',    size: 31, index: 6.1, trend: -0.1, risk: 'med',
      sleep: 6.1, stress: 6.6, energy: 5.8, mood: 6.4 },
    { team: 'Customer Ops — Tier 2',  dept: 'Support',    head: 'Marwan El-Sayed', size: 28, index: 4.6, trend: -0.8, risk: 'high',
      sleep: 5.2, stress: 7.8, energy: 4.9, mood: 5.1 },
    { team: 'Finance — Accounts Payable', dept: 'Finance', head: 'Farida Hassan', size: 16, index: 5.1, trend: -0.4, risk: 'high',
      sleep: 5.4, stress: 7.2, energy: 5.2, mood: 5.6 },
    { team: 'Finance — FP&A',          dept: 'Finance',    head: 'Sara Mansour',  size: 12, index: 6.8, trend: 0.2, risk: 'low',
      sleep: 6.8, stress: 5.6, energy: 6.6, mood: 6.9 },
    { team: 'Field Sales — Delta',     dept: 'Sales',      head: 'Khaled Ibrahim', size: 22, index: 5.4, trend: -0.2, risk: 'med',
      sleep: 5.8, stress: 6.8, energy: 5.4, mood: 5.6 },
    { team: 'Logistics — Day',         dept: 'Ops',        head: 'Hossam El-Din', size: 35, index: 6.4, trend: 0.1, risk: 'low',
      sleep: 6.4, stress: 6.0, energy: 6.2, mood: 6.5 },
    { team: 'Logistics — Night shift', dept: 'Ops',        head: 'Rania Nour',    size: 19, index: 5.5, trend: -0.3, risk: 'med',
      sleep: 5.3, stress: 6.7, energy: 5.4, mood: 5.8 },
    { team: 'People & Culture',        dept: 'HR',         head: 'Hana El-Masry', size: 9,  index: 7.8, trend: 0.4, risk: 'low',
      sleep: 7.4, stress: 4.6, energy: 7.2, mood: 7.6 },
  ],
  people: [
    { name: 'Amira Mostafa', role: 'Senior Analyst', team: 'Finance — Accounts Payable', index: 4.8, trend: -0.6, last: '2d ago', flag: false },
    { name: 'Mahmoud Fayed', role: 'Support Lead',   team: 'Customer Ops — Tier 2',       index: 5.2, trend: -0.4, last: '1d ago', flag: true  },
    { name: 'Nour Saeed',    role: 'Account Mgr',    team: 'Field Sales — Delta',         index: 5.6, trend: -0.2, last: 'Today',  flag: false },
    { name: 'Tariq Helmy',   role: 'Engineer II',    team: 'Engineering — Platform',      index: 7.1, trend: 0.2,  last: 'Today',  flag: false },
    { name: 'Laila Adib',    role: 'FP&A Analyst',   team: 'Finance — FP&A',              index: 6.9, trend: 0.1,  last: 'Today',  flag: false },
  ],
  safety: [
    { id: 'SF-204', who: 'Anonymous · Tier 2', severity: 'high',   opened: '2h ago', note: { en: 'Self-reported burnout — asked to speak to someone', ar: 'إرهاق مُبلَّغ ذاتياً — طلب التحدث مع شخص ما' }, status: 'open' },
    { id: 'SF-203', who: 'Anonymous · Logistics Night', severity: 'high', opened: '5h ago', note: { en: 'Three consecutive nights < 4h sleep', ar: 'ثلاث ليالٍ متتالية < 4س نوم' }, status: 'open' },
    { id: 'SF-201', who: 'Anonymous · Support',    severity: 'med', opened: 'Yesterday', note: { en: 'Stress spike after schedule change', ar: 'ارتفاع التوتر بعد تغيير الجدول' }, status: 'review' },
    { id: 'SF-199', who: 'Anonymous · Sales Delta', severity: 'med', opened: '2d ago',   note: { en: 'Low mood pattern × 2 weeks', ar: 'نمط مزاج منخفض لـ أسبوعين' }, status: 'review' },
  ],
  broadcasts: [
    { id: 1, title: { en: 'Ramadan wind-down tips', ar: 'نصائح الاسترخاء الرمضانية' }, segment: { en: 'All staff', ar: 'كل الموظفين' }, opens: '78%', sent: 'Mon · 09:00' },
    { id: 2, title: { en: 'Mindfulness week starts Monday', ar: 'أسبوع اليقظة يبدأ الإثنين' }, segment: { en: 'Egypt · all depts', ar: 'مصر · كل الأقسام' }, opens: '64%', sent: 'Apr 15' },
    { id: 3, title: { en: 'Reach out — Support Tier 2', ar: 'تواصل — دعم المستوى 2' }, segment: { en: 'Team · 28 people', ar: 'الفريق · 28 شخصاً' }, opens: '—', sent: 'Draft' },
  ],
  content: [
    { kind: 'audio',   title: { en: 'Sleep onset — a cue for tonight', ar: 'بداية النوم — إشارة لهذه الليلة' }, mins: 6, pinned: true },
    { kind: 'video',   title: { en: 'Desk mobility flow',               ar: 'حركات مكتبية' }, mins: 4, pinned: true },
    { kind: 'article', title: { en: 'Build an evening wind-down',      ar: 'بناء روتين استرخاء مسائي' }, mins: 5, pinned: false },
  ],
  challenges: [
    { title: { en: 'Move April',         ar: 'تحرَّك أبريل' },       joined: 412, target: '150k steps · team',  end: '8 days left' },
    { title: { en: 'Lights out by 11',   ar: 'النوم قبل الـ11' },     joined: 287, target: '21 days · individual', end: '14 days left' },
    { title: { en: '3-min reset daily',   ar: 'استراحة 3 دقائق يوميًا' }, joined: 198, target: '30 days · team',    end: '20 days left' },
  ],
};

// ── SIDEBAR ──────────────────────────────────────────────────────
function Sidebar({ theme, S, active, onNav, collapsed }) {
  const T = theme;
  const items = [
    { id: 'dashboard', key: 'dashboard' },
    { id: 'teams', key: 'teams' },
    { id: 'people', key: 'people' },
    { id: 'safety', key: 'safety', badge: 7 },
    { id: 'content', key: 'content' },
    { id: 'challenges', key: 'challenges' },
    { id: 'broadcasts', key: 'broadcasts' },
    { id: 'reports', key: 'reports' },
  ];
  const w = collapsed ? 68 : 232;
  return (
    <aside style={{
      width: w, flexShrink: 0, background: T.sidebarBg, color: T.sidebarText,
      display: 'flex', flexDirection: 'column', transition: 'width .2s',
      borderInlineEnd: `1px solid rgba(245,241,232,0.06)`,
      position: 'sticky', top: 0, height: '100vh', zIndex: 10,
    }}>
      <div style={{ padding: collapsed ? '18px 14px' : '18px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="assets/wellness-mark.png" alt="" style={{ height: 22, filter: 'brightness(0) invert(1)' }}/>
        {!collapsed && (
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: T.sidebarMark, letterSpacing: -0.3, lineHeight: 1 }}>
            Wellness<span style={{ color: T.sidebarActive }}>+</span>
          </div>
        )}
      </div>

      <div style={{ padding: collapsed ? '6px 10px' : '6px 14px', marginTop: 10 }}>
        {!collapsed && (
          <div style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(245,241,232,0.42)', padding: '6px 8px 6px', fontWeight: 700 }}>
            {S.overview}
          </div>
        )}
        {items.map(it => {
          const isActive = active === it.id;
          return (
            <button key={it.id} onClick={() => onNav(it.id)} style={{
              width: '100%', padding: collapsed ? '10px 12px' : '9px 12px',
              display: 'flex', alignItems: 'center', gap: 12, justifyContent: collapsed ? 'center' : 'flex-start',
              background: isActive ? 'rgba(245,181,68,0.12)' : 'transparent',
              color: isActive ? T.sidebarActive : T.sidebarText,
              border: 'none', borderRadius: 10, cursor: 'pointer', marginBottom: 2,
              fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
              borderInlineStart: isActive ? `2px solid ${T.sidebarActive}` : '2px solid transparent',
            }}>
              <HRIcon name={it.id} size={18}/>
              {!collapsed && <span style={{ flex: 1, textAlign: 'start' }}>{S[it.key]}</span>}
              {!collapsed && it.badge && (
                <span style={{
                  minWidth: 20, height: 18, padding: '0 6px', borderRadius: 999,
                  background: '#E27F6A', color: '#1a0a06',
                  fontSize: 10, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{it.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }}/>
      <div style={{ padding: collapsed ? '10px' : '10px 14px', borderTop: '1px solid rgba(245,241,232,0.06)' }}>
        <button onClick={() => onNav('settings')} style={{
          width: '100%', padding: collapsed ? '10px 12px' : '9px 12px',
          display: 'flex', alignItems: 'center', gap: 12, justifyContent: collapsed ? 'center' : 'flex-start',
          background: 'transparent', color: T.sidebarText, border: 'none', cursor: 'pointer',
          borderRadius: 10, fontSize: 13, fontWeight: 500,
        }}>
          <HRIcon name="settings" size={18}/>
          {!collapsed && <span>{S.settings}</span>}
        </button>
      </div>
    </aside>
  );
}

// ── TOP BAR ─────────────────────────────────────────────────────
function TopBar({ theme, S, dir, range, onRange, onExport, onTweaks }) {
  const T = theme;
  return (
    <div style={{
      height: 64, borderBottom: `1px solid ${T.border}`, background: T.panel,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 18, position: 'sticky', top: 0, zIndex: 5,
    }}>
      {/* search */}
      <div style={{
        flex: 1, maxWidth: 480, height: 38, background: T.panelSunk, borderRadius: 10,
        border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10,
      }}>
        <HRIcon name="search" size={16} stroke={T.textMuted}/>
        <input placeholder={S.search} style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: T.text, fontSize: 13, textAlign: dir === 'rtl' ? 'right' : 'left',
        }}/>
        <span className="mono" style={{
          padding: '2px 6px', borderRadius: 5, border: `1px solid ${T.border}`,
          fontSize: 10, color: T.textMuted,
        }}>⌘K</span>
      </div>

      <div style={{ flex: 1 }}/>

      {/* range */}
      <div style={{ display: 'flex', background: T.panelSunk, borderRadius: 10, padding: 3, border: `1px solid ${T.border}` }}>
        {[['7d', S.seven], ['30d', S.thirty], ['90d', S.ninety]].map(([k, l]) => (
          <button key={k} onClick={() => onRange(k)} style={{
            padding: '6px 12px', borderRadius: 7,
            background: range === k ? T.panel : 'transparent',
            color: range === k ? T.text : T.textMuted,
            border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            boxShadow: range === k ? T.shadowSm : 'none',
          }}>{l}</button>
        ))}
      </div>

      <HRButton theme={T} variant="secondary" icon="download" onClick={onExport}>{S.exportPdf}</HRButton>

      <div style={{ width: 1, height: 28, background: T.border }}/>

      <button style={{
        background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative',
        color: T.textMid, display: 'flex', alignItems: 'center',
      }}>
        <HRIcon name="bell" size={18}/>
        <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 999, background: T.danger }}/>
      </button>

      <div onClick={onTweaks} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <AvatarMark theme={T} name="Hana El-Masry" size={34}/>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>Hana El-Masry</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>HR Director · {S.tenant}</div>
        </div>
        <HRIcon name="chevDown" size={14} stroke={T.textMuted}/>
      </div>
    </div>
  );
}

// ── KPI STRIP ───────────────────────────────────────────────────
function mapOverviewKpis(overviewKpis) {
  if (!overviewKpis) return null;
  // Map raw RPC keys to the visual KPI cards. Missing keys fall through gracefully.
  const idx    = overviewKpis.wellbeing_index ?? overviewKpis.index ?? null;
  const active = overviewKpis.weekly_active   ?? overviewKpis.active ?? null;
  const risk   = overviewKpis.at_risk_teams   ?? overviewKpis.risk   ?? null;
  const safety = overviewKpis.safety_flags    ?? overviewKpis.safety ?? null;
  return [
    { key: 'index',  label: 'wellbeingIndex', value: idx    ?? 0,   suffix: '/10',   delta: 0, invert: false, spark: [] },
    { key: 'active', label: 'weeklyActive',   value: active ?? 0,   suffix: '',     delta: 0, invert: false, fmt: (v) => Number(v).toLocaleString(), spark: [] },
    { key: 'risk',   label: 'atRiskTeams',    value: risk   ?? 0,   suffix: '',     delta: 0, invert: true,  spark: [] },
    { key: 'safety', label: 'safetyFlags',    value: safety ?? 0,   suffix: ' open', delta: 0, invert: true, spark: [] },
  ];
}

function KpiStrip({ theme, S, density, chartStyle, kpis }) {
  const T = theme;
  const items = (kpis ? mapOverviewKpis(kpis) : null) || HR_DATA.kpis;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: DENSITY[density].gap }}>
      {items.map((k, i) => (
        <Panel key={k.key} theme={T} density={density}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              {S[k.label]}
            </div>
            <Delta theme={T} value={k.delta} suffix={k.key === 'active' ? '%' : ''} invert={k.invert}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div className="display" style={{ fontSize: density === 'compact' ? 34 : 40, color: T.text, letterSpacing: -1, lineHeight: 1, fontWeight: 400 }}>
              {k.fmt ? k.fmt(k.value) : k.value}
              <span style={{ fontSize: 16, color: T.textMuted, marginInlineStart: 4 }}>{k.suffix}</span>
            </div>
            <Spark theme={T} values={k.spark} width={90} height={36} chartStyle={chartStyle}
              color={k.key === 'risk' || k.key === 'safety' ? T.danger : (k.key === 'index' ? T.positive : T.accent)}/>
          </div>
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8 }}>{S.vsPrior}</div>
        </Panel>
      ))}
    </div>
  );
}

// ── TRENDS CHART ────────────────────────────────────────────────
function buildTrendFromOverview(trend) {
  if (!Array.isArray(trend) || trend.length === 0) return null;
  const labels = trend.map(r => {
    const d = new Date(r.week_start);
    return Number.isNaN(d.getTime()) ? String(r.week_start) : `${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}`;
  });
  const labelsAr = trend.map(r => {
    const d = new Date(r.week_start);
    return Number.isNaN(d.getTime()) ? String(r.week_start) : `${d.getDate()}`;
  });
  const series = [
    { key: 'mood',   name: 'Mood',   values: trend.map(r => Number(r.avg_mood)   || 0) },
    { key: 'stress', name: 'Stress', values: trend.map(r => Number(r.avg_stress) || 0) },
  ];
  return { labels, labelsAr, series };
}

function TrendsCard({ theme, S, lang, chartStyle, density, trend }) {
  const T = theme;
  const overviewTrend = buildTrendFromOverview(trend);
  const trendData = overviewTrend || HR_DATA.trends;
  const initialKeys = trendData.series.map(s => s.key);
  const [active, setActive] = React.useState(new Set(initialKeys));
  React.useEffect(() => { setActive(new Set(trendData.series.map(s => s.key))); /* eslint-disable-next-line */ }, [overviewTrend ? 'live' : 'mock']);
  const series = trendData.series.map((s, i) => ({ ...s, color: T.series[i % T.series.length] }));
  const toggle = (k) => {
    const n = new Set(active); n.has(k) ? n.delete(k) : n.add(k); setActive(n);
  };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.wellbeingTrends} subtitle={`${S.vsPrior} · ${lang==='ar'?'الفترة السابقة':'prior 30d'}`}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            {series.map(s => (
              <button key={s.key} onClick={() => toggle(s.key)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 999,
                background: active.has(s.key) ? T.panelSunk : 'transparent',
                border: `1px solid ${active.has(s.key) ? T.border : 'transparent'}`,
                color: active.has(s.key) ? T.text : T.textFaint,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, opacity: active.has(s.key) ? 1 : 0.3 }}/>
                {S[s.key] || s.name}
              </button>
            ))}
          </div>
        }/>
      <div style={{ padding: '8px 12px 18px' }}>
        <TrendChart theme={T} series={series} labels={lang==='ar'?trendData.labelsAr:trendData.labels}
          height={260} chartStyle={chartStyle} activeKeys={[...active]}/>
      </div>
    </Panel>
  );
}

// ── AT-RISK TEAMS (right rail) ──────────────────────────────────
function AtRisk({ theme, S, lang, density, onOpenTeam }) {
  const T = theme;
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.atRiskTeams} subtitle={lang==='ar'?'بحاجة لاهتمام':'Needs attention'}
        right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{S.viewAll}</HRButton>}/>
      <div>
        {HR_DATA.atRisk.map((t, i) => (
          <div key={i} onClick={() => onOpenTeam(t)} style={{
            padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
            display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: i < HR_DATA.atRisk.length - 1 ? `1px solid ${T.divider}` : 'none',
            cursor: 'pointer',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t.team}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{t.reason[lang]} · {t.size} {lang==='ar'?'أعضاء':'members'}</div>
            </div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{t.index}</div>
            <Badge theme={T} tone={t.risk === 'high' ? 'danger' : 'caution'} dot>
              {t.risk === 'high' ? S.high : S.med}
            </Badge>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── TEAM BREAKDOWN TABLE ────────────────────────────────────────
function TeamTable({ theme, S, lang, density, chartStyle, onOpenTeam }) {
  const T = theme;
  const d = DENSITY[density];
  const [filter, setFilter] = React.useState('all');
  const [sort, setSort] = React.useState('index');
  const depts = ['all', ...Array.from(new Set(HR_DATA.teams.map(t => t.dept)))];
  const filtered = HR_DATA.teams.filter(t => filter === 'all' || t.dept === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'index') return a.index - b.index;
    if (sort === 'size')  return b.size - a.size;
    if (sort === 'trend') return a.trend - b.trend;
    return 0;
  });
  const riskTone = { low: 'positive', med: 'caution', high: 'danger' };
  const riskLabel = { low: S.low, med: S.med, high: S.high };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.teamBreakdown} subtitle={`${filtered.length} ${lang==='ar'?'فرق':'teams'}`}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={{
              height: 32, padding: '0 10px', borderRadius: 8,
              background: T.panelSunk, border: `1px solid ${T.border}`,
              color: T.text, fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer',
            }}>
              {depts.map(dp => <option key={dp} value={dp}>{dp === 'all' ? S.filterAll : dp}</option>)}
            </select>
            <HRButton theme={T} variant="secondary" size="sm" icon="filter"/>
          </div>
        }/>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
              {[
                { key: 'team', label: S.team, align: 'start' },
                { key: 'head', label: S.head, align: 'start' },
                { key: 'size', label: S.size, align: 'end',   sortable: true },
                { key: 'sleep', label: S.sleep, align: 'center' },
                { key: 'stress', label: S.stress, align: 'center' },
                { key: 'energy', label: S.energy, align: 'center' },
                { key: 'mood', label: S.mood, align: 'center' },
                { key: 'index', label: S.index, align: 'end', sortable: true },
                { key: 'trend', label: S.trend, align: 'end',  sortable: true },
                { key: 'risk', label: S.risk, align: 'end' },
              ].map(h => (
                <th key={h.key} onClick={() => h.sortable && setSort(h.key)} style={{
                  fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase',
                  color: sort === h.key ? T.text : T.textMuted, fontWeight: 700,
                  textAlign: h.align, padding: `10px ${d.cardPad}px 10px`,
                  cursor: h.sortable ? 'pointer' : 'default',
                  position: 'sticky', top: 0, background: T.panel,
                }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={i} onClick={() => onOpenTeam(t)} style={{
                borderBottom: `1px solid ${T.divider}`, cursor: 'pointer',
              }}
                  onMouseEnter={e => e.currentTarget.style.background = T.panelAlt}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, fontSize: 13, color: T.text, fontWeight: 600 }}>
                  {t.team}
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400, marginTop: 2 }}>{t.dept}</div>
                </td>
                <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AvatarMark theme={T} name={t.head} size={26}/>
                    <span style={{ color: T.textMid, fontSize: 12 }}>{t.head}</span>
                  </div>
                </td>
                <td className="mono" style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end', color: T.textMid, fontSize: 12 }}>{t.size}</td>
                {['sleep','stress','energy','mood'].map(m => (
                  <td key={m} style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span className="mono" style={{ fontSize: 11, color: T.textMid, fontWeight: 600 }}>{t[m].toFixed(1)}</span>
                      <div style={{ width: 58 }}><Bullet theme={T} value={t[m]} max={10}
                        color={t[m] >= 6.5 ? T.positive : t[m] >= 5 ? T.caution : T.danger}/></div>
                    </div>
                  </td>
                ))}
                <td className="mono" style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end', fontSize: 14, color: T.text, fontWeight: 700 }}>{t.index}</td>
                <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end' }}>
                  <Delta theme={T} value={t.trend}/>
                </td>
                <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end' }}>
                  <Badge theme={T} tone={riskTone[t.risk]} dot>{riskLabel[t.risk]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── SAFETY QUEUE ────────────────────────────────────────────────
function SafetyQueue({ theme, S, lang, density }) {
  const T = theme;
  const sevTone = { high: 'danger', med: 'caution', low: 'info' };
  const sevLabel = { high: S.high, med: S.med, low: S.low };
  const statusLabel = { open: S.open, review: S.review, resolved: S.resolved };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.safetyQueue} subtitle={`${HR_DATA.safety.filter(s=>s.status!=='resolved').length} ${lang==='ar'?'مفتوحة':'open'}`}
        right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{S.viewAll}</HRButton>}/>
      <div>
        {HR_DATA.safety.map((s, i) => (
          <div key={s.id} style={{
            padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
            borderBottom: i < HR_DATA.safety.length - 1 ? `1px solid ${T.divider}` : 'none',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: s.severity === 'high' ? (T.isDark ? 'rgba(226,127,106,0.15)' : 'rgba(162,67,43,0.10)') : (T.isDark ? 'rgba(245,181,68,0.15)' : 'rgba(180,134,31,0.10)'),
              color: s.severity === 'high' ? T.danger : T.caution,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><HRIcon name="flag" size={16}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span className="mono" style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{s.id}</span>
                <Badge theme={T} tone={sevTone[s.severity]} dot>{sevLabel[s.severity]}</Badge>
                <Badge theme={T} tone="neutral">{statusLabel[s.status]}</Badge>
                <span style={{ fontSize: 11, color: T.textFaint, marginInlineStart: 'auto' }}>{s.opened}</span>
              </div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.4 }}>{s.note[lang]}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{s.who}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── BROADCASTS ──────────────────────────────────────────────────
function Broadcasts({ theme, S, lang, density }) {
  const T = theme;
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.activeBroadcasts} subtitle={lang==='ar'?'حملات نشطة':'Last 30 days'}
        right={<HRButton theme={T} size="sm" icon="plus">{S.draftPost}</HRButton>}/>
      <div>
        {HR_DATA.broadcasts.map((b, i) => (
          <div key={b.id} style={{
            padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
            borderBottom: i < HR_DATA.broadcasts.length - 1 ? `1px solid ${T.divider}` : 'none',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{b.title[lang]}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{b.segment[lang]} · {b.sent}</div>
            </div>
            <div style={{ textAlign: 'end' }}>
              <div className="mono" style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{b.opens}</div>
              <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>{lang==='ar'?'معدل الفتح':'open rate'}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── CONTENT + CHALLENGES ────────────────────────────────────────
function ContentPins({ theme, S, lang, density }) {
  const T = theme;
  const iconFor = { audio: 'headphones', video: 'play', article: 'book' };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.contentPins} subtitle={lang==='ar'?'محتوى مختار':'Curated for all staff'}
        right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{S.viewAll}</HRButton>}/>
      <div style={{ padding: `${DENSITY[density].cardPad - 4}px ${DENSITY[density].cardPad}px`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {HR_DATA.content.map((c, i) => (
          <div key={i} style={{
            background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 12,
            padding: 14, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, marginBottom: 10,
              background: T.accentSoft, color: T.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><HRIcon name={iconFor[c.kind]} size={16}/></div>
            <div style={{ fontSize: 12, color: T.text, fontWeight: 600, lineHeight: 1.35, marginBottom: 6 }}>{c.title[lang]}</div>
            <div style={{ fontSize: 11, color: T.textMuted, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{c.kind}</span>
              · {c.mins} {lang==='ar'?'د':'min'}
              {c.pinned && <Badge theme={T} tone="caution" style={{ marginInlineStart: 'auto' }}>{lang==='ar'?'مثبَّت':'Pinned'}</Badge>}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ChallengesCard({ theme, S, lang, density }) {
  const T = theme;
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.activeChallenges} subtitle={`${HR_DATA.challenges.length} ${lang==='ar'?'نشطة':'running'}`}
        right={<HRButton theme={T} size="sm" icon="plus">{S.newChallenge}</HRButton>}/>
      <div>
        {HR_DATA.challenges.map((c, i) => (
          <div key={i} style={{
            padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
            borderBottom: i < HR_DATA.challenges.length - 1 ? `1px solid ${T.divider}` : 'none',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: T.warmSoft, color: T.warm, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><HRIcon name="challenges" size={18}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{c.title[lang]}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{c.target} · {c.end}</div>
            </div>
            <div className="mono" style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{c.joined}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── PEOPLE YOU MANAGE ───────────────────────────────────────────
function PeopleYouManage({ theme, S, lang, density }) {
  const T = theme;
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.peopleYouManage}
        subtitle={lang==='ar'?'أشخاص مسؤول عنهم مباشرةً':'Direct reports (permission scope)'}
        right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{S.viewAll}</HRButton>}/>
      <div>
        {HR_DATA.people.map((p, i) => {
          const tone = p.index >= 6.5 ? 'positive' : p.index >= 5 ? 'caution' : 'danger';
          return (
            <div key={i} style={{
              padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
              borderBottom: i < HR_DATA.people.length - 1 ? `1px solid ${T.divider}` : 'none',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <AvatarMark theme={T} name={p.name} size={36}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{p.name}</span>
                  {p.flag && <Badge theme={T} tone="danger" dot>{lang==='ar'?'تنبيه':'Flagged'}</Badge>}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{p.role} · {p.team}</div>
              </div>
              <div style={{ textAlign: 'end', minWidth: 60 }}>
                <div className="mono" style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{p.index}</div>
                <Delta theme={T} value={p.trend}/>
              </div>
              <Badge theme={T} tone={tone} dot>{lang==='ar' ? (p.index>=6.5?S.low:p.index>=5?S.med:S.high) : (p.index>=6.5?'Stable':p.index>=5?'Watch':'At risk')}</Badge>
              <HRButton theme={T} variant="ghost" size="sm" icon="more"/>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

Object.assign(window, {
  HR_DATA, Sidebar, TopBar, KpiStrip, TrendsCard, AtRisk, TeamTable,
  SafetyQueue, Broadcasts, ContentPins, ChallengesCard, PeopleYouManage,
});

export { HR_DATA, Sidebar, TopBar, KpiStrip, TrendsCard, AtRisk, TeamTable, SafetyQueue, Broadcasts, ContentPins, ChallengesCard, PeopleYouManage };
