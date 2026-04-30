import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { HR_THEMES, DENSITY, HR_STRINGS } from './hr/tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart, Bullet, AvatarMark, Toggle } from './hr/components.jsx';
import { HR_DATA, Sidebar, TopBar, KpiStrip, TrendsCard, AtRisk, TeamTable, SafetyQueue, Broadcasts, ContentPins, ChallengesCard, PeopleYouManage } from './hr/sections.jsx';
import { HRPageHeader }     from './hr/views/_header.jsx';
import { HRTeamsPage }      from './hr/views/teams.jsx';
import { HRPeoplePage }     from './hr/views/people.jsx';
import { HRSafetyPage }     from './hr/views/safety.jsx';
import { HRContentPage }    from './hr/views/content.jsx';
import { HRChallengesPage } from './hr/views/challenges.jsx';
import { HRBroadcastsPage } from './hr/views/broadcasts.jsx';
import { HRReportsPage }    from './hr/views/reports.jsx';
import { HRSettingsPage }   from './hr/views/settings.jsx';
// --- hr-app.jsx ---
// HR Portal — App shell: assembles sidebar + topbar + dashboard, handles Tweaks.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "lang": "en",
  "density": "comfortable",
  "layout": "default",
  "chartStyle": "line"
}/*EDITMODE-END*/;

function TeamDrawer({ theme, team, onClose, S, lang, chartStyle }) {
  const T = theme;
  if (!team) return null;
  // fabricate a 30-day mini-trend for the team
  const trend = [6.4, 6.2, 6.0, 5.9, 5.8, 5.7, 5.6, 5.7, 5.6, 5.5, 5.4, 5.3, 5.2, 5.2, 5.1, 5.0, 5.0, 4.9, 4.8, 4.9, 4.8, 4.7, 4.6, 4.6, 4.7, 4.6, 4.5, 4.5, 4.6, 4.6];
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.36)', zIndex: 50,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: '92vw', height: '100vh', background: T.panel,
        borderInlineStart: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column',
        animation: 'drawerIn .25s ease both',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{team.dept || 'Team'}</div>
            <div style={{ fontSize: 18, color: T.text, fontWeight: 700, letterSpacing: -0.2, marginTop: 2 }}>{team.team}</div>
          </div>
          <HRButton theme={T} variant="secondary" size="sm">{S.message}</HRButton>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: T.textMid, cursor: 'pointer' }}>
            <HRIcon name="close" size={18}/>
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
            <Panel theme={T} density="compact">
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{S.index}</div>
              <div className="display" style={{ fontSize: 32, color: T.text, letterSpacing: -0.8, marginTop: 4 }}>{team.index}</div>
              <Delta theme={T} value={team.trend}/>
            </Panel>
            <Panel theme={T} density="compact">
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{S.size}</div>
              <div className="display" style={{ fontSize: 32, color: T.text, letterSpacing: -0.8, marginTop: 4 }}>{team.size || '—'}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{team.head}</div>
            </Panel>
            <Panel theme={T} density="compact">
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{S.risk}</div>
              <div style={{ marginTop: 8 }}>
                <Badge theme={T} tone={team.risk === 'high' ? 'danger' : team.risk === 'med' ? 'caution' : 'positive'} dot>
                  {team.risk === 'high' ? S.high : team.risk === 'med' ? S.med : S.low}
                </Badge>
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10 }}>
                {(team.reason && team.reason[lang]) || (lang==='ar'?'تتبع الاتجاه':'Watchlist')}
              </div>
            </Panel>
          </div>

          <Panel theme={T} density="comfortable" pad={false} style={{ marginBottom: 18 }}>
            <PanelHeader theme={T} density="comfortable" title={lang==='ar'?'مؤشر الرفاهية · 30 يوماً':'Wellbeing index · 30 days'}/>
            <div style={{ padding: 16 }}>
              <Spark theme={T} values={trend} width={500} height={90} chartStyle={chartStyle === 'bar' ? 'bar' : 'area'} color={T.danger} showDots={false}/>
            </div>
          </Panel>

          {team.sleep !== undefined && (
            <Panel theme={T} density="comfortable" style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 12 }}>
                {lang==='ar'?'تفصيل المقاييس':'Metric breakdown'}
              </div>
              {[['sleep', S.sleep, team.sleep], ['stress', S.stress, team.stress], ['energy', S.energy, team.energy], ['mood', S.mood, team.mood]].map(([k, l, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0' }}>
                  <div style={{ width: 78, fontSize: 12, color: T.textMid, fontWeight: 600 }}>{l}</div>
                  <div style={{ flex: 1 }}>
                    <Bullet theme={T} value={v} max={10}
                      color={v >= 6.5 ? T.positive : v >= 5 ? T.caution : T.danger}/>
                  </div>
                  <div className="mono" style={{ width: 40, textAlign: 'end', fontSize: 13, color: T.text, fontWeight: 600 }}>{v.toFixed(1)}</div>
                </div>
              ))}
            </Panel>
          )}

          <Panel theme={T}>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10 }}>
              {S.actions}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <HRButton theme={T} variant="soft" icon="broadcasts">{S.nudge}</HRButton>
              <HRButton theme={T} variant="secondary" icon="content">{lang==='ar'?'اقتراح محتوى':'Recommend content'}</HRButton>
              <HRButton theme={T} variant="secondary" icon="challenges">{lang==='ar'?'إطلاق تحدٍّ':'Launch challenge'}</HRButton>
              <HRButton theme={T} variant="secondary" icon="reports">{lang==='ar'?'تصدير':'Export'}</HRButton>
            </div>
          </Panel>
        </div>
      </div>
      <style>{`@keyframes drawerIn { from { transform: translateX(100%); } to { transform: none; } }`}</style>
    </div>
  );
}

function TweaksPanel({ theme, open, onClose, cfg, setCfg, S }) {
  const T = theme;
  if (!open) return null;
  const Row = ({ label, children }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
  const Seg = ({ opts, value, onChange }) => (
    <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 10, border: `1px solid ${T.border}` }}>
      {opts.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          flex: 1, padding: '7px 10px', borderRadius: 7,
          background: value === k ? T.panel : 'transparent',
          color: value === k ? T.text : T.textMuted,
          border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          boxShadow: value === k ? T.shadowSm : 'none',
          whiteSpace: 'nowrap',
        }}>{l}</button>
      ))}
    </div>
  );
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, width: 300, zIndex: 200, direction: 'ltr',
      background: T.panel, border: `1px solid ${T.borderStrong}`, borderRadius: 14,
      boxShadow: '0 24px 60px rgba(0,0,0,0.35)', padding: 18,
      color: T.text, fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="display" style={{ fontSize: 20, letterSpacing: -0.3 }}>{S.tweaks}</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}>
          <HRIcon name="close" size={16}/>
        </button>
      </div>
      <Row label={S.theme}>
        <Seg opts={[['dark','Dark'],['light','Light']]} value={cfg.theme} onChange={v => setCfg({ ...cfg, theme: v })}/>
      </Row>
      <Row label={S.language}>
        <Seg opts={[['en','English'],['ar','العربية']]} value={cfg.lang} onChange={v => setCfg({ ...cfg, lang: v })}/>
      </Row>
      <Row label={S.density}>
        <Seg opts={[['compact','Compact'],['comfortable','Comfortable']]} value={cfg.density} onChange={v => setCfg({ ...cfg, density: v })}/>
      </Row>
      <Row label={S.chartStyle}>
        <Seg opts={[['line','Line'],['area','Area'],['bar','Bar']]} value={cfg.chartStyle} onChange={v => setCfg({ ...cfg, chartStyle: v })}/>
      </Row>
      <Row label={S.layout}>
        <Seg opts={[['default','Default'],['wide','Wide chart'],['split','Split']]} value={cfg.layout} onChange={v => setCfg({ ...cfg, layout: v })}/>
      </Row>
    </div>
  );
}

function Dashboard({ theme, S, cfg, density, gap, layout, range, setDrawerTeam }) {
  const T = theme;
  return (
    <>
      {/* Greeting row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div className="display" style={{ fontSize: 38, color: T.text, letterSpacing: -0.8, lineHeight: 1 }}>
            {S.greeting}
          </div>
          <div style={{ fontSize: 14, color: T.textMuted, marginTop: 8 }}>
            {S.subGreet} <strong style={{ color: T.textMid }}>{S.tenant}</strong> · {range.toUpperCase()} · {S.lastUpdated}: 09:42
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <HRButton theme={T} variant="secondary" icon="calendar">Apr 1 – Apr 30</HRButton>
          <HRButton theme={T} variant="primary" icon="plus">{S.newChallenge}</HRButton>
        </div>
      </div>

      <div style={{ marginBottom: gap }}>
        <KpiStrip theme={T} S={S} density={density} chartStyle={cfg.chartStyle}/>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: layout === 'wide' ? '1fr' : layout === 'split' ? '1fr 1fr' : 'minmax(0, 2fr) minmax(320px, 1fr)',
        gap, marginBottom: gap,
      }}>
        <TrendsCard theme={T} S={S} lang={cfg.lang} chartStyle={cfg.chartStyle} density={density}/>
        {layout !== 'wide' && <AtRisk theme={T} S={S} lang={cfg.lang} density={density} onOpenTeam={setDrawerTeam}/>}
      </div>

      {layout === 'wide' && (
        <div style={{ marginBottom: gap }}>
          <AtRisk theme={T} S={S} lang={cfg.lang} density={density} onOpenTeam={setDrawerTeam}/>
        </div>
      )}

      <div style={{ marginBottom: gap }}>
        <TeamTable theme={T} S={S} lang={cfg.lang} density={density} chartStyle={cfg.chartStyle} onOpenTeam={setDrawerTeam}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap, marginBottom: gap }}>
        <SafetyQueue theme={T} S={S} lang={cfg.lang} density={density}/>
        <Broadcasts theme={T} S={S} lang={cfg.lang} density={density}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr', gap, marginBottom: gap }}>
        <PeopleYouManage theme={T} S={S} lang={cfg.lang} density={density}/>
        <ContentPins theme={T} S={S} lang={cfg.lang} density={density}/>
        <ChallengesCard theme={T} S={S} lang={cfg.lang} density={density}/>
      </div>
    </>
  );
}

function HRApp() {
  const [cfg, setCfg] = React.useState(() => {
    try {
      const saved = localStorage.getItem('hr-portal-cfg');
      return saved ? { ...TWEAK_DEFAULTS, ...JSON.parse(saved) } : { ...TWEAK_DEFAULTS };
    } catch { return { ...TWEAK_DEFAULTS }; }
  });
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [range, setRange] = React.useState('30d');
  const [nav, setNav] = React.useState('dashboard');
  const [drawerTeam, setDrawerTeam] = React.useState(null);

  React.useEffect(() => {
    try { localStorage.setItem('hr-portal-cfg', JSON.stringify(cfg)); } catch {}
  }, [cfg]);

  React.useEffect(() => {
    const handler = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}
    return () => window.removeEventListener('message', handler);
  }, []);

  const T = HR_THEMES[cfg.theme] || HR_THEMES.dark;
  const S = HR_STRINGS[cfg.lang] || HR_STRINGS.en;
  const dir = cfg.lang === 'ar' ? 'rtl' : 'ltr';
  const density = cfg.density;
  const gap = DENSITY[density].gap;

  const layout = cfg.layout;
  // layouts differ in how the main dashboard is arranged

  return (
    <div data-rtl={dir === 'rtl'} style={{
      minHeight: '100vh', background: T.bg, color: T.text, display: 'flex',
      direction: dir, animation: 'dashIn .3s ease both',
    }}>
      <Sidebar theme={T} S={S} active={nav} onNav={setNav}/>

      <div style={{ flex: 1, minWidth: 0, background: T.page }}>
        <TopBar theme={T} S={S} dir={dir} range={range} onRange={setRange} onExport={() => {}} onTweaks={() => setTweaksOpen(!tweaksOpen)}/>

        <div style={{ padding: `24px ${gap + 10}px ${gap + 10}px` }}>
          {nav === 'dashboard' ? (
            <Dashboard theme={T} S={S} cfg={cfg} density={density} gap={gap} layout={layout} range={range} setDrawerTeam={setDrawerTeam}/>
          ) : nav === 'teams' ? (
            <HRTeamsPage theme={T} S={S} lang={cfg.lang} density={density} chartStyle={cfg.chartStyle} onOpenTeam={setDrawerTeam}/>
          ) : nav === 'people' ? (
            <HRPeoplePage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'safety' ? (
            <HRSafetyPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'content' ? (
            <HRContentPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'challenges' ? (
            <HRChallengesPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'broadcasts' ? (
            <HRBroadcastsPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'reports' ? (
            <HRReportsPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'settings' ? (
            <HRSettingsPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : (
            <Dashboard theme={T} S={S} cfg={cfg} density={density} gap={gap} layout={layout} range={range} setDrawerTeam={setDrawerTeam}/>
          )}

          <div style={{ textAlign: 'center', padding: '24px 0 10px', fontSize: 11, color: T.textFaint }}>
            Wellness+ HR Portal · Nile Group · v2.4.1
          </div>
        </div>
      </div>

      <TeamDrawer theme={T} team={drawerTeam} onClose={() => setDrawerTeam(null)} S={S} lang={cfg.lang} chartStyle={cfg.chartStyle}/>
      <TweaksPanel theme={T} open={tweaksOpen} onClose={() => setTweaksOpen(false)} cfg={cfg} setCfg={setCfg} S={S}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<HRApp/>);
