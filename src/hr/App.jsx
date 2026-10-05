import React from 'react';
import { HR_THEMES, DENSITY, HR_STRINGS } from '../shared/tokens.jsx';
import { Sidebar, TopBar } from './sections.jsx';
import { HRDashboard } from './views/dashboard.jsx';
import { TweaksPanel } from './tweaks-panel.jsx';
import { HRPeoplePage }     from './views/people.jsx';
import { HRContentPage }    from './views/content.jsx';
import { HRChallengesPage } from './views/challenges.jsx';
import { HRGiftsRoot }      from './views/gifts-root.jsx';
import { HRBroadcastsPage } from './views/broadcasts.jsx';
import { HRSettingsPage }   from './views/settings.jsx';
import { HRAppConfigProvider, useHRAppConfig } from './state/app-config-context.jsx';
import { HRAuthProvider, useHRAuth } from './state/auth-context.jsx';
import { SignIn } from './views/sign-in.jsx';
import { AccessDenied } from './views/access-denied.jsx';
import { isSuperadminEmail } from '../lib/superadmin';

function AppInner() {
  const { cfg, setCfg } = useHRAppConfig();
  const { session, role, profile, loading: authLoading, company } = useHRAuth();
  const companyName = company?.name;
  const userEmail = session?.user?.email || '';
  const userName = profile?.display_name || userEmail.split('@')[0] || '';
  const firstName = userName ? userName.split(/\s+/)[0] : '';
  const roleLabel = role === 'company_admin' ? 'Company admin'
                  : role === 'hr_admin'      ? 'HR admin'
                  : isSuperadminEmail(userEmail) ? 'Platform admin'
                  : (role || '');
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [range, setRange] = React.useState('30d');
  const [nav, setNav] = React.useState('dashboard');

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
  const density = DENSITY[cfg.density] ? cfg.density : 'comfortable';
  const gap = DENSITY[density].gap;


  if (authLoading) {
    return <div style={{ minHeight: '100vh', background: T.bg }}/>;
  }
  if (!session) {
    return <SignIn theme={T} S={S} dir={dir}/>;
  }
  if (!['hr_admin', 'company_admin'].includes(role) && !isSuperadminEmail(session?.user?.email)) {
    return <AccessDenied theme={T} dir={dir}/>;
  }

  return (
    <div data-rtl={dir === 'rtl'} style={{
      minHeight: '100vh', background: T.bg, color: T.text, display: 'flex',
      direction: dir, animation: 'dashIn .3s ease both',
    }}>
      <Sidebar theme={T} S={S} active={nav} onNav={setNav}/>

      <div style={{ flex: 1, minWidth: 0, background: T.page }}>
        <TopBar theme={T} S={S} dir={dir} range={range} onRange={setRange} onTweaks={tweaksAvailable ? () => setTweaksOpen(!tweaksOpen) : undefined} userName={userName} userEmail={userEmail} userRoleLabel={roleLabel} companyName={companyName}/>

        <div style={{ padding: `24px ${gap + 10}px ${gap + 10}px` }}>
          {nav === 'dashboard' ? (
            <HRDashboard theme={T} S={S} cfg={cfg} density={density} gap={gap} range={range} companyName={companyName} firstName={firstName} setNav={setNav}/>
          ) : nav === 'people' ? (
            <HRPeoplePage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'content' ? (
            <HRContentPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'challenges' ? (
            <HRChallengesPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'gifts' ? (
            <HRGiftsRoot theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'broadcasts' ? (
            <HRBroadcastsPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'settings' ? (
            <HRSettingsPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : (
            <HRDashboard theme={T} S={S} cfg={cfg} density={density} gap={gap} range={range} companyName={companyName} firstName={firstName} setNav={setNav}/>
          )}

          <div style={{ textAlign: 'center', padding: '24px 0 10px', fontSize: 11, color: T.textFaint }}>
            Wellness+ HR Portal{companyName ? ` · ${companyName}` : ''}
          </div>
        </div>
      </div>

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
