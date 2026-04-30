import React from 'react';
import { HR_THEMES, DENSITY, HR_STRINGS } from '../shared/tokens.jsx';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from '../shared/components.jsx';
import {
  Sidebar, TopBar, KpiStrip, TrendsCard, AtRisk, TeamTable, SafetyQueue,
  Broadcasts, ContentPins, ChallengesCard, PeopleYouManage,
} from './sections.jsx';
import { TweaksPanel } from './tweaks-panel.jsx';
import { TeamDrawer } from './views/teams-drawer.jsx';
import { HRPageHeader }     from './views/_header.jsx';
import { HRTeamsPage }      from './views/teams.jsx';
import { HRPeoplePage }     from './views/people.jsx';
import { HRSafetyPage }     from './views/safety.jsx';
import { HRContentPage }    from './views/content.jsx';
import { HRChallengesPage } from './views/challenges.jsx';
import { HRBroadcastsPage } from './views/broadcasts.jsx';
import { HRReportsPage }    from './views/reports.jsx';
import { HRSettingsPage }   from './views/settings.jsx';
import { HRAppConfigProvider, useHRAppConfig } from './state/app-config-context.jsx';
import { HRAuthProvider, useHRAuth } from './state/auth-context.jsx';
import { SignIn } from './views/sign-in.jsx';
import { AccessDenied } from './views/access-denied.jsx';
import { useOverview } from './hooks/use-overview.js';

function Dashboard({ theme, S, cfg, density, gap, layout, range, setDrawerTeam }) {
  const T = theme;
  const { data: overview, loading: overviewLoading } = useOverview(range);

  if (overviewLoading && !overview) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        {cfg.lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}
      </div>
    );
  }

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
        <KpiStrip theme={T} S={S} density={density} chartStyle={cfg.chartStyle} kpis={overview?.kpis}/>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: layout === 'wide' ? '1fr' : layout === 'split' ? '1fr 1fr' : 'minmax(0, 2fr) minmax(320px, 1fr)',
        gap, marginBottom: gap,
      }}>
        <TrendsCard theme={T} S={S} lang={cfg.lang} chartStyle={cfg.chartStyle} density={density} trend={overview?.trend}/>
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

function AppInner() {
  const { cfg, setCfg } = useHRAppConfig();
  const { session, role, loading: authLoading } = useHRAuth();
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [range, setRange] = React.useState('30d');
  const [nav, setNav] = React.useState('dashboard');
  const [drawerTeam, setDrawerTeam] = React.useState(null);

  const tweaksAvailable = import.meta.env.DEV ||
    new URLSearchParams(window.location.search).get('tweaks') === '1';

  React.useEffect(() => {
    if (!tweaksAvailable) return;
    const handler = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}
    return () => window.removeEventListener('message', handler);
  }, [tweaksAvailable]);

  const T = HR_THEMES[cfg.theme] || HR_THEMES.dark;
  const S = HR_STRINGS[cfg.lang] || HR_STRINGS.en;
  const dir = cfg.lang === 'ar' ? 'rtl' : 'ltr';
  const density = cfg.density;
  const gap = DENSITY[density].gap;

  const layout = cfg.layout;
  // layouts differ in how the main dashboard is arranged

  if (authLoading) {
    return <div style={{ minHeight: '100vh', background: T.bg }}/>;
  }
  if (!session) {
    return <SignIn theme={T} S={S} dir={dir}/>;
  }
  if (!['hr_admin', 'company_admin'].includes(role)) {
    return <AccessDenied theme={T} dir={dir}/>;
  }

  return (
    <div data-rtl={dir === 'rtl'} style={{
      minHeight: '100vh', background: T.bg, color: T.text, display: 'flex',
      direction: dir, animation: 'dashIn .3s ease both',
    }}>
      <Sidebar theme={T} S={S} active={nav} onNav={setNav}/>

      <div style={{ flex: 1, minWidth: 0, background: T.page }}>
        <TopBar theme={T} S={S} dir={dir} range={range} onRange={setRange} onExport={() => {}} onTweaks={tweaksAvailable ? () => setTweaksOpen(!tweaksOpen) : undefined}/>

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
      {tweaksAvailable && <TweaksPanel theme={T} open={tweaksOpen} onClose={() => setTweaksOpen(false)} cfg={cfg} setCfg={setCfg} S={S}/>}
    </div>
  );
}

export default function App() {
  return (
    <HRAppConfigProvider>
      <HRAuthProvider>
        <AppInner />
      </HRAuthProvider>
    </HRAppConfigProvider>
  );
}
