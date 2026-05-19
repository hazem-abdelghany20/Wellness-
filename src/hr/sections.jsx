import React from 'react';
import { DENSITY } from '../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart, Bullet, AvatarMark, Toggle } from '../shared/components.jsx';
// --- hr-sections.jsx ---
// HR Portal sections: KPI strip, trends chart, at-risk teams, team breakdown, safety queue,
// broadcasts, content pins, active challenges, sidebar, topbar, people drawer.

// ── EMPTY-STATE HELPER ───────────────────────────────────────────
function EmptyRow({ theme, density, text }) {
  return (
    <div style={{
      padding: `${DENSITY[density].cardPad}px`,
      fontSize: 12, color: theme.textMuted, textAlign: 'center',
    }}>{text}</div>
  );
}

// Derive a wellbeing index from per-metric averages (0–10 each, stress inverted).
function deriveIndex(row) {
  if (!row || !row.has_signal) return null;
  const { avg_mood: m, avg_stress: s, avg_sleep: sl, avg_energy: e } = row;
  if (m == null || s == null || sl == null || e == null) return null;
  return Math.round(((m + (10 - s) + sl + e) / 4) * 10) / 10;
}

function deriveRisk(row) {
  if (!row || !row.has_signal) return 'low';
  const s = row.avg_stress;
  if (s == null) return 'low';
  if (s >= 7) return 'high';
  if (s >= 6) return 'med';
  return 'low';
}

// ── SIDEBAR ──────────────────────────────────────────────────────
function Sidebar({ theme, S, active, onNav, collapsed, safetyCount = 0 }) {
  const T = theme;
  const items = [
    { id: 'dashboard', key: 'dashboard' },
    { id: 'teams', key: 'teams' },
    { id: 'people', key: 'people' },
    { id: 'safety', key: 'safety', badge: safetyCount > 0 ? safetyCount : undefined },
    { id: 'content', key: 'content' },
    { id: 'challenges', key: 'challenges' },
    { id: 'gifts', key: 'gifts' },
    { id: 'broadcasts', key: 'broadcasts' },
    { id: 'reports', key: 'reports' },
    { id: 'settings', key: 'settings' },
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
        <img src="/wellness-mark.png" alt="" style={{ height: 22, filter: 'brightness(0) invert(1)' }}/>
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
    </aside>
  );
}

// ── TOP BAR ─────────────────────────────────────────────────────
function TopBar({ theme, S, dir, range, onRange, onExport, onTweaks, userName, userEmail, userRoleLabel, companyName }) {
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
        <AvatarMark theme={T} name={userName || userEmail || '?'} size={34}/>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{userName || userEmail || '—'}</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>{userRoleLabel || ''}{userRoleLabel && companyName ? ' · ' : ''}{companyName || ''}</div>
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
  const active = overviewKpis.active_users    ?? overviewKpis.weekly_active ?? overviewKpis.active ?? null;
  const risk   = overviewKpis.at_risk_teams   ?? overviewKpis.risk   ?? null;
  const safety = overviewKpis.safety_flags    ?? overviewKpis.safety ?? null;
  const dash = (v) => v == null ? '—' : v;
  return [
    { key: 'index',  label: 'wellbeingIndex', value: dash(idx),    suffix: idx == null ? '' : '/10',   delta: 0, invert: false, spark: [] },
    { key: 'active', label: 'weeklyActive',   value: dash(active), suffix: '',                         delta: 0, invert: false, fmt: (v) => v === '—' ? v : Number(v).toLocaleString(), spark: [] },
    { key: 'risk',   label: 'atRiskTeams',    value: dash(risk),   suffix: '',                         delta: 0, invert: true,  spark: [] },
    { key: 'safety', label: 'safetyFlags',    value: dash(safety), suffix: safety == null ? '' : ' open', delta: 0, invert: true,  spark: [] },
  ];
}

function KpiStrip({ theme, S, density, chartStyle, kpis }) {
  const T = theme;
  // Real RPC data only — no HR_DATA fallback. Empty state shows "—".
  const items = mapOverviewKpis(kpis) || mapOverviewKpis({});
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
  // New RPC returns daily { date, mood, stress, sleep, energy }; legacy
  // returns weekly { week_start, avg_mood, avg_stress }. Accept both.
  const getDate = (r) => r.date ?? r.week_start;
  const labels = trend.map(r => {
    const d = new Date(getDate(r));
    return Number.isNaN(d.getTime()) ? String(getDate(r)) : `${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}`;
  });
  const labelsAr = trend.map(r => {
    const d = new Date(getDate(r));
    return Number.isNaN(d.getTime()) ? String(getDate(r)) : `${d.getDate()}`;
  });
  const series = [
    { key: 'mood',   name: 'Mood',   values: trend.map(r => Number(r.mood   ?? r.avg_mood)   || 0) },
    { key: 'stress', name: 'Stress', values: trend.map(r => Number(r.stress ?? r.avg_stress) || 0) },
    { key: 'sleep',  name: 'Sleep',  values: trend.map(r => Number(r.sleep  ?? r.avg_sleep)  || 0) },
    { key: 'energy', name: 'Energy', values: trend.map(r => Number(r.energy ?? r.avg_energy) || 0) },
  ];
  return { labels, labelsAr, series };
}

function TrendsCard({ theme, S, lang, chartStyle, density, trend, range = '30d' }) {
  const T = theme;
  const overviewTrend = buildTrendFromOverview(trend);
  // Empty-state placeholder when no real data — no mock fallback.
  const trendData = overviewTrend || { labels: [], labelsAr: [], series: [
    { key: 'mood', name: 'Mood', values: [] },
    { key: 'stress', name: 'Stress', values: [] },
  ] };
  const initialKeys = trendData.series.map(s => s.key);
  const [active, setActive] = React.useState(new Set(initialKeys));
  React.useEffect(() => { setActive(new Set(trendData.series.map(s => s.key))); /* eslint-disable-next-line */ }, [overviewTrend ? 'live' : 'mock']);
  const series = trendData.series.map((s, i) => ({ ...s, color: T.series[i % T.series.length] }));
  const toggle = (k) => {
    const n = new Set(active); n.has(k) ? n.delete(k) : n.add(k); setActive(n);
  };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.wellbeingTrends} subtitle={`${S.vsPrior} · ${lang==='ar'?`الفترة السابقة ${range}`:`prior ${range}`}`}
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
function AtRisk({ theme, S, lang, density, onOpenTeam, teams = [] }) {
  const T = theme;
  const rows = teams
    .filter(t => t.has_signal)
    .map(t => ({ ...t, _idx: deriveIndex(t), _risk: deriveRisk(t) }))
    .filter(t => t._risk === 'high' || t._risk === 'med')
    .sort((a, b) => (a._idx ?? 99) - (b._idx ?? 99))
    .slice(0, 4);
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.atRiskTeams} subtitle={lang==='ar'?'بحاجة لاهتمام':'Needs attention'}
        right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{S.viewAll}</HRButton>}/>
      <div>
        {rows.length === 0 ? (
          <EmptyRow theme={T} density={density} text={lang==='ar'?'لا توجد فرق بحاجة لاهتمام':'No teams need attention'}/>
        ) : rows.map((t, i) => (
          <div key={t.team_id || i} onClick={() => onOpenTeam && onOpenTeam(t)} style={{
            padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
            display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: i < rows.length - 1 ? `1px solid ${T.divider}` : 'none',
            cursor: 'pointer',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t.team_name}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{t.department || ''} · {t.member_count} {lang==='ar'?'أعضاء':'members'}</div>
            </div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{t._idx ?? '—'}</div>
            <Badge theme={T} tone={t._risk === 'high' ? 'danger' : 'caution'} dot>
              {t._risk === 'high' ? S.high : S.med}
            </Badge>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── TEAM BREAKDOWN TABLE ────────────────────────────────────────
function TeamTable({ theme, S, lang, density, chartStyle, onOpenTeam, teams: rawTeams = [] }) {
  const T = theme;
  const d = DENSITY[density];
  const [filter, setFilter] = React.useState('all');
  const [sort, setSort] = React.useState('index');
  const teams = React.useMemo(() => rawTeams.map(t => ({
    team_id: t.team_id,
    team: t.team_name,
    dept: t.department || '—',
    head: t.head_display_name || '—',
    size: t.member_count ?? 0,
    sleep:  t.has_signal ? t.avg_sleep  : null,
    stress: t.has_signal ? t.avg_stress : null,
    energy: t.has_signal ? t.avg_energy : null,
    mood:   t.has_signal ? t.avg_mood   : null,
    index:  deriveIndex(t),
    trend:  0,
    risk:   deriveRisk(t),
    suppressed: !t.has_signal,
  })), [rawTeams]);
  const depts = ['all', ...Array.from(new Set(teams.map(t => t.dept).filter(d => d && d !== '—')))];
  const filtered = teams.filter(t => filter === 'all' || t.dept === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'index') return (a.index ?? 99) - (b.index ?? 99);
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
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: `${d.cardPad}px`, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>
                  {lang==='ar'?'لا توجد فرق':'No teams yet'}
                </td>
              </tr>
            )}
            {sorted.map((t, i) => (
              <tr key={t.team_id || i} onClick={() => onOpenTeam && onOpenTeam(t)} style={{
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
                    {t[m] == null ? (
                      <span className="mono" style={{ fontSize: 11, color: T.textFaint }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <span className="mono" style={{ fontSize: 11, color: T.textMid, fontWeight: 600 }}>{t[m].toFixed(1)}</span>
                        <div style={{ width: 58 }}><Bullet theme={T} value={t[m]} max={10}
                          color={t[m] >= 6.5 ? T.positive : t[m] >= 5 ? T.caution : T.danger}/></div>
                      </div>
                    )}
                  </td>
                ))}
                <td className="mono" style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end', fontSize: 14, color: T.text, fontWeight: 700 }}>{t.index ?? '—'}</td>
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
// Displays high-stress teams as a proxy for escalation queue while the
// safety_flags table is still on the v2 roadmap. Each "item" is one team
// over the privacy floor with elevated stress.
function SafetyQueue({ theme, S, lang, density, teams = [] }) {
  const T = theme;
  const sevTone = { high: 'danger', med: 'caution' };
  const sevLabel = { high: S.high, med: S.med };
  const rows = teams
    .filter(t => t.has_signal && t.avg_stress != null && t.avg_stress >= 6)
    .map(t => ({
      id: t.team_id,
      severity: t.avg_stress >= 7 ? 'high' : 'med',
      team_name: t.team_name,
      department: t.department,
      avg_stress: t.avg_stress,
      group_size: t.group_size,
    }))
    .sort((a, b) => b.avg_stress - a.avg_stress)
    .slice(0, 6);
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.safetyQueue} subtitle={`${rows.length} ${lang==='ar'?'مفتوحة':'open'}`}
        right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{S.viewAll}</HRButton>}/>
      <div>
        {rows.length === 0 ? (
          <EmptyRow theme={T} density={density} text={lang==='ar'?'لا توجد تنبيهات':'No open escalations'}/>
        ) : rows.map((s, i) => (
          <div key={s.id} style={{
            padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
            borderBottom: i < rows.length - 1 ? `1px solid ${T.divider}` : 'none',
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
                <Badge theme={T} tone={sevTone[s.severity]} dot>{sevLabel[s.severity]}</Badge>
                <span style={{ fontSize: 11, color: T.textFaint, marginInlineStart: 'auto' }}>{lang==='ar'?'الآن':'now'}</span>
              </div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.4 }}>
                {s.team_name} — {lang==='ar'?'متوسط توتر':'avg stress'} {s.avg_stress.toFixed(1)}
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{s.department || ''} · {s.group_size} {lang==='ar'?'مشاركين':'reporting'}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── BROADCASTS ──────────────────────────────────────────────────
function Broadcasts({ theme, S, lang, density, onNew, list = [] }) {
  const T = theme;
  const rows = list.slice(0, 4);
  const statusLabel = (st) => st === 'sent' ? (lang==='ar'?'مُرسل':'Sent')
                       : st === 'scheduled' ? (lang==='ar'?'مجدول':'Scheduled')
                       : st === 'cancelled' ? (lang==='ar'?'ملغي':'Cancelled')
                       : st;
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.activeBroadcasts} subtitle={lang==='ar'?'حملات نشطة':'Last 30 days'}
        right={<HRButton theme={T} size="sm" icon="plus" onClick={onNew}>{S.draftPost}</HRButton>}/>
      <div>
        {rows.length === 0 ? (
          <EmptyRow theme={T} density={density} text={lang==='ar'?'لا توجد إعلانات':'No broadcasts yet'}/>
        ) : rows.map((b, i) => {
          const when = b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString(lang==='ar'?'ar-EG':'en-GB', { month: 'short', day: 'numeric' }) : '';
          const title = (lang==='ar' && b.title_ar) ? b.title_ar : b.title_en;
          return (
            <div key={b.id || i} style={{
              padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
              borderBottom: i < rows.length - 1 ? `1px solid ${T.divider}` : 'none',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                  {b.scope === 'team' ? (lang==='ar'?'فريق':'Team') : (lang==='ar'?'كل الموظفين':'All staff')} · {when}
                </div>
              </div>
              <Badge theme={T} tone={b.status === 'sent' ? 'positive' : b.status === 'cancelled' ? 'neutral' : 'info'}>{statusLabel(b.status)}</Badge>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── CONTENT + CHALLENGES ────────────────────────────────────────
function ContentPins({ theme, S, lang, density, items = [] }) {
  const T = theme;
  const iconFor = { audio: 'headphones', video: 'play', article: 'book' };
  // Prefer pinned items first, fall back to published library when nothing
  // is pinned, then take up to 3.
  const pinned = items.filter(i => i.pinned);
  const rows = (pinned.length > 0 ? pinned : items.filter(i => i.status === 'published')).slice(0, 3);
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.contentPins} subtitle={lang==='ar'?'محتوى مختار':'Curated for all staff'}
        right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{S.viewAll}</HRButton>}/>
      <div style={{ padding: `${DENSITY[density].cardPad - 4}px ${DENSITY[density].cardPad}px`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {rows.length === 0 ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <EmptyRow theme={T} density={density} text={lang==='ar'?'لا يوجد محتوى':'Library is empty'}/>
          </div>
        ) : rows.map((c, i) => {
          const title = (lang==='ar' && c.title_ar) ? c.title_ar : c.title_en;
          const kind = c.kind || 'article';
          const isPinned = !!c.pinned;
          return (
            <div key={c.id || i} style={{
              background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 12,
              padding: 14, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, marginBottom: 10,
                background: T.accentSoft, color: T.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><HRIcon name={iconFor[kind] || 'book'} size={16}/></div>
              <div style={{ fontSize: 12, color: T.text, fontWeight: 600, lineHeight: 1.35, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 11, color: T.textMuted, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{kind}</span>
                {c.duration_mins != null && <>· {c.duration_mins} {lang==='ar'?'د':'min'}</>}
                {isPinned && <Badge theme={T} tone="caution" style={{ marginInlineStart: 'auto' }}>{lang==='ar'?'مثبَّت':'Pinned'}</Badge>}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function ChallengesCard({ theme, S, lang, density, onNew, items = [] }) {
  const T = theme;
  // Filter to ones that look active: start_date <= today <= end_date.
  const today = new Date().toISOString().slice(0, 10);
  const active = items.filter(c => {
    if (!c.start_date || !c.end_date) return false;
    return c.start_date <= today && c.end_date >= today;
  }).slice(0, 4);
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.activeChallenges} subtitle={`${active.length} ${lang==='ar'?'نشطة':'running'}`}
        right={<HRButton theme={T} size="sm" icon="plus" onClick={onNew}>{S.newChallenge}</HRButton>}/>
      <div>
        {active.length === 0 ? (
          <EmptyRow theme={T} density={density} text={lang==='ar'?'لا توجد تحديات نشطة':'No active challenges'}/>
        ) : active.map((c, i) => {
          const title = (lang==='ar' && c.title_ar) ? c.title_ar : c.title_en;
          const end = new Date(c.end_date);
          const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
          return (
            <div key={c.id || i} style={{
              padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
              borderBottom: i < active.length - 1 ? `1px solid ${T.divider}` : 'none',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: T.warmSoft, color: T.warm, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><HRIcon name="challenges" size={18}/></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                  {c.metric || ''} · {daysLeft} {lang==='ar'?'يوم متبقي':'days left'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── PEOPLE YOU MANAGE ───────────────────────────────────────────
function PeopleYouManage({ theme, S, lang, density, people = [] }) {
  const T = theme;
  const rows = people.slice(0, 5);
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.peopleYouManage}
        subtitle={lang==='ar'?'أشخاص مسؤول عنهم مباشرةً':'Direct reports (permission scope)'}
        right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{S.viewAll}</HRButton>}/>
      <div>
        {rows.length === 0 ? (
          <EmptyRow theme={T} density={density} text={lang==='ar'?'لا يوجد موظفون':'No employees yet'}/>
        ) : rows.map((p, i) => {
          const teamLabel = p.teams?.name || (lang==='ar'?'بدون فريق':'No team');
          const roleLabel = (p.role || 'employee').replace(/_/g, ' ');
          return (
            <div key={p.id || i} style={{
              padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
              borderBottom: i < rows.length - 1 ? `1px solid ${T.divider}` : 'none',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <AvatarMark theme={T} name={p.display_name || ''} size={36}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{p.display_name || '—'}</span>
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, textTransform: 'capitalize' }}>{roleLabel} · {teamLabel}</div>
              </div>
              <Badge theme={T} tone="neutral">{roleLabel}</Badge>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export { Sidebar, TopBar, KpiStrip, TrendsCard, AtRisk, TeamTable, SafetyQueue, Broadcasts, ContentPins, ChallengesCard, PeopleYouManage };
