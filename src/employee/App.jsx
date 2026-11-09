import React from 'react';
import { Confetti } from './confetti.jsx';
import {
  IOSStatusBar, IOSGlassPill, IOSNavBar, IOSListRow, IOSList,
  IOSDevice, IOSKeyboard,
} from './ios-frame.jsx';
import {
  THEMES, typeStyles, Icon, AvatarDisplay, Button, Card, Chip,
  SectionLabel, WellnessMark, Sparkline, Ring, Slider,
} from './design-system.jsx';
import { STRINGS, useT } from './i18n.jsx';
import {
  ScreenJoin, ScreenConsent, ScreenName, ScreenWelcome,
} from './screens/onboarding.jsx';
import { ScreenHabitChallenge } from './screens/habit-challenge.jsx';
import { ScreenToday } from './screens/today.jsx';
import { ScreenProfile }  from './screens/profile.jsx';
import { ScreenScorecard } from './screens/scorecard.jsx';
import { ScreenLibrary, ScreenPlayer } from './screens/content.jsx';
import { ScreenNotifs } from './screens/notifications.jsx';
import { ScreenMine } from './screens/mine.jsx';
import { ScreenCompetitionPath } from './screens/competition-path.jsx';
import { InstallBanner } from './components/install-banner.jsx';
import { OfflineBanner } from './components/offline-banner.jsx';
import { TweaksPanel } from './tweaks-panel.jsx';
import { AppConfigProvider, useAppConfig } from './state/app-config-context.jsx';
import { AuthProvider, useAuth } from './state/auth-context.jsx';
import { Splash } from './screens/splash.jsx';
import { useNotifications } from './hooks/use-notifications.js';
import { useRoutineToday } from './hooks/use-routine-today.js';
import { useWalkthrough, WalkthroughCard } from '../shared/walkthrough.jsx';
import { employeeTourSteps } from './lib/tour-steps.js';
import { TabBar } from './components/tab-bar.jsx';

const TOUR_SCREENS = ['today', 'challenges', 'library', 'score', 'profile'];

const ONBOARDING_SCREENS = ['join', 'consent', 'name', 'welcome'];
const MAIN_SCREENS = ['today', 'challenges', 'library', 'score', 'profile', 'mine', 'player', 'notifs', 'competition-path'];
// Screens removed when the app went to Challenge / Library / Score / Me; a saved one lands on Challenges.
const RETIRED_SCREENS = ['home', 'checkin', 'breathe', 'progress', 'baseline', 'goals'];
// How long the splash waits for today's routine before landing anyway.
const LANDING_WAIT_MS = 4000;

// --- app.jsx ---
// Main app — state, routing, Tweaks, nav

// Real phones get the app full-screen (respecting the notch / home bar);
// wider screens keep the iPhone frame, which is handy for demos.
function useIsPhone() {
  const q = '(max-width: 600px)';
  const [isPhone, setIsPhone] = React.useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false);
  React.useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia(q);
    const on = () => setIsPhone(m.matches);
    m.addEventListener ? m.addEventListener('change', on) : m.addListener(on);
    return () => { m.removeEventListener ? m.removeEventListener('change', on) : m.removeListener(on); };
  }, []);
  return isPhone;
}

const FRAME_VARS = { '--wp-top': '54px', '--wp-bottom': '24px', '--wp-tabpad': '100px' };
const PHONE_VARS = {
  '--wp-top': 'max(env(safe-area-inset-top), 14px)',
  '--wp-bottom': 'max(env(safe-area-inset-bottom), 12px)',
  '--wp-tabpad': 'calc(88px + max(env(safe-area-inset-bottom), 12px))',
};

function AppInner() {
  const { cfg, setCfg } = useAppConfig();
  const { session, profile, loading: authLoading, profileLoaded, joining } = useAuth();
  // App-level subscription — feeds the realtime bell badge.
  const { unreadCount } = useNotifications(session?.user?.id);
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  // Initial screen is resolved by the auth-driven routing effect below
  // (we don't trust the persisted value until we know the session/profile state).
  const [screen, setScreen] = React.useState(null);
  const [doneActions, setDoneActions] = React.useState(new Set());
  const [streak, setStreak] = React.useState(21);
  const [joined, setJoined] = React.useState(false);
  const [playerItem, setPlayerItem] = React.useState(null);
  const [competitionId, setCompetitionId] = React.useState(null);
  const [avatar, setAvatar] = React.useState(() => localStorage.getItem('wellness-plus-avatar') || 'monogram');
  const [name, setName] = React.useState(() => localStorage.getItem('wellness-plus-name') || '');
  const onboarded = !!(profile?.onboarded || profile?.onboarded_at);
  // Today's routine: decides whether there is a Today tab, and feeds it.
  const routine = useRoutineToday(!!session && onboarded);
  const hasRoutine = routine.ready && routine.assigned;
  const [landingTimedOut, setLandingTimedOut] = React.useState(false);
  // True while the person sits on a screen the app picked (not one they tapped),
  // so a routine that loads late can still move them to Today.
  const autoLanded = React.useRef(false);
  React.useEffect(() => {
    if (!onboarded || routine.ready) return undefined;
    const id = setTimeout(() => setLandingTimedOut(true), LANDING_WAIT_MS);
    return () => clearTimeout(id);
  }, [onboarded, routine.ready]);

  const tweaksAvailable = import.meta.env.DEV ||
    new URLSearchParams(window.location.search).get('tweaks') === '1';

  React.useEffect(() => {
    if (screen) localStorage.setItem('wellness-plus-screen', screen);
  }, [screen]);

  // Auth-driven routing gate.
  // - No session: route to onboarding (start at 'join').
  // - Session but no completed onboarding flag: route to onboarding (start at 'consent').
  // - Fully onboarded: route to main app.
  React.useEffect(() => {
    if (authLoading) return;
    // Sign-in is still placing the account (invite / company lookup) — stay
    // on the join screen so a "no invite found" error is shown there.
    if (joining) return;
    if (session && !profileLoaded) return;
    if (!session) {
      // Unauthenticated users only sit on join.
      if (screen !== 'join') {
        setScreen('join');
      }
    } else if (!(profile?.onboarded || profile?.onboarded_at)) {
      // Authenticated but not onboarded — must be on consent/name/welcome.
      // If they're on join/null/main, jump them to consent.
      if (screen === null || screen === 'join' || MAIN_SCREENS.includes(screen) || RETIRED_SCREENS.includes(screen)) {
        setScreen('consent');
      }
    } else {
      // Fully onboarded — never show onboarding screens again. Land on Today
      // when HR gave a routine (wait a moment for it), else on Challenge.
      if (screen === null || ONBOARDING_SCREENS.includes(screen) || RETIRED_SCREENS.includes(screen)) {
        if (!routine.ready && !landingTimedOut && screen === null) return;
        autoLanded.current = true;
        setScreen(hasRoutine ? 'today' : 'challenges');
      }
    }
  }, [authLoading, session, profile, profileLoaded, screen, joining, routine.ready, hasRoutine, landingTimedOut]);

  // The routine arrived after we landed: move to Today once. A Today screen
  // with no routine (HR ended it) falls back to Challenge.
  React.useEffect(() => {
    if (!routine.ready || !screen) return;
    if (hasRoutine && autoLanded.current && screen === 'challenges') setScreen('today');
    if (!hasRoutine && screen === 'today') setScreen('challenges');
    autoLanded.current = false;
  }, [routine.ready, hasRoutine, screen]);
  React.useEffect(() => { localStorage.setItem('wellness-plus-avatar', avatar); }, [avatar]);
  React.useEffect(() => { localStorage.setItem('wellness-plus-name', name); }, [name]);
  React.useEffect(() => {
    if (!profile) return;
    setStreak(profile.streak_current ?? 0);
    setName(profile.display_name || session?.user?.email?.split('@')[0] || '');
    setAvatar(profile.avatar_kind || 'monogram');
  }, [profile, session?.user?.email]);

  // Tweaks edit mode contract
  React.useEffect(() => {
    if (!tweaksAvailable) return;
    const handler = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch(_) {}
    return () => window.removeEventListener('message', handler);
  }, [tweaksAvailable]);

  const theme = THEMES[cfg.theme] || THEMES.brand;
  const lang = cfg.lang;
  const t = useT(lang);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const isPhone = useIsPhone();
  React.useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const go = (s, extra) => {
    autoLanded.current = false;
    if (s === 'competition-path' && extra?.id) {
      setCompetitionId(extra.id);
    }
    if (s === 'player' && extra?.item) {
      // Library + featured-rec card both pass a fully-shaped DB row.
      // Legacy id-only callers were dropped in the Phase 3 sweep.
      setPlayerItem(extra.item);
    }
    setScreen(s);
  };

  const state = {
    doneActions, toggleAction: (id) => {
      const n = new Set(doneActions);
      n.has(id) ? n.delete(id) : n.add(id); setDoneActions(n);
    },
    streak, setStreak,
    joined, setJoined,
    playerItem, setPlayerItem,
    avatar, setAvatar,
    name, setName,
    unreadCount,
  };

  const setLang = (l) => setCfg({ ...cfg, lang: l });
  const setThemeKey = (k) => setCfg({ ...cfg, theme: k });

  const tourSteps = React.useMemo(() => employeeTourSteps(hasRoutine), [hasRoutine]);
  const tour = useWalkthrough({
    key: 'employee',
    user: session?.user,
    steps: tourSteps,
    onNavigate: go,
    autoStart: onboarded && TOUR_SCREENS.includes(screen) && (routine.ready || landingTimedOut),
  });

  // Splash while auth bootstraps, or while the routing effect is still resolving the initial screen.
  const holdJoin = joining && screen === 'join';
  if (!holdJoin && (authLoading || (session && !profileLoaded) || screen === null)) {
    return <Splash theme={theme}/>;
  }

  let content, showTabs = false;
  switch (screen) {
    case 'join':     content = <ScreenJoin theme={theme} t={t} dir={dir} onNext={() => go('consent')}/>; break;
    case 'consent':  content = <ScreenConsent theme={theme} t={t} dir={dir} onNext={() => go('name')} onBack={() => go('join')}/>; break;
    case 'name':     content = <ScreenName theme={theme} t={t} dir={dir} state={state} onNext={() => go('welcome')} onBack={() => go('consent')}/>; break;
    case 'welcome':  content = <ScreenWelcome theme={theme} t={t} dir={dir} state={state} onNext={() => { go(hasRoutine ? 'today' : 'challenges'); autoLanded.current = true; }}/>; break;
    case 'library':  content = <ScreenLibrary theme={theme} t={t} dir={dir} go={go}/>; showTabs = true; break;
    case 'player':   content = <ScreenPlayer theme={theme} t={t} dir={dir} go={go} state={state}/>; break;
    case 'notifs':   content = <ScreenNotifs theme={theme} t={t} dir={dir} go={go} backTo={hasRoutine ? 'today' : 'challenges'}/>; break;
    case 'mine':     content = <ScreenMine theme={theme} t={t} dir={dir} go={go}/>; break;
    case 'competition-path': content = <ScreenCompetitionPath theme={theme} t={t} dir={dir} go={go} challengeId={competitionId}/>; break;
    case 'score':    content = <ScreenScorecard theme={theme} dir={dir} go={go} hasRoutine={hasRoutine}/>; showTabs = true; break;
    case 'profile':  content = <ScreenProfile theme={theme} t={t} dir={dir} go={go} lang={lang} setLang={setLang} themeKey={cfg.theme} setThemeKey={setThemeKey} state={state} onReplayTour={tour.start}/>; showTabs = true; break;
    case 'today':
      content = hasRoutine
        ? <ScreenToday theme={theme} dir={dir} go={go} state={state} routine={routine}/>
        : <ScreenHabitChallenge theme={theme} dir={dir} go={go} state={state}/>;
      showTabs = true; break;
    case 'challenges':
    default:         content = <ScreenHabitChallenge theme={theme} dir={dir} go={go} state={state}/>; showTabs = true;
  }

  return (
    <div style={isPhone
      ? { position: 'fixed', inset: 0, background: theme.bg }
      : { minHeight: '100vh', background: theme.bg === '#F6F3EC' ? '#EAE4D5' : '#0a1615', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, boxSizing: 'border-box' }}>
      {(() => {
        const screenLayer = (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            fontFamily: typeStyles(theme).sansFont,
          }}>
            <div key={screen + cfg.theme + cfg.lang}
                 style={{ position: 'absolute', inset: 0, animation: 'screenIn .35s ease both' }}>
              {content}
            </div>
            {showTabs && <TabBar theme={theme} t={t} dir={dir} active={hasRoutine || screen !== 'today' ? screen : 'challenges'} onTab={go} hasToday={hasRoutine}/>}
            <WalkthroughCard tour={tour} lang={lang} placement="sheet"
              bottomOffset={showTabs ? 'calc(var(--wp-tabpad) + 4px)' : 24}
              colors={{ panel: theme.surface, text: theme.text, muted: theme.textMuted, border: theme.border, accent: theme.accent, accentInk: theme.accentInk }}/>
            <OfflineBanner theme={theme} lang={lang}/>
            {showTabs && !window.Capacitor?.isNativePlatform?.() && <InstallBanner theme={theme} lang={lang}/>}
          </div>
        );
        return isPhone ? (
          <div style={{ ...PHONE_VARS, direction: dir, position: 'absolute', inset: 0, overflow: 'hidden', background: theme.bg }}>
            {screenLayer}
          </div>
        ) : (
          <div style={{ ...FRAME_VARS, direction: dir, transition: 'all .3s ease' }}>
            <IOSDevice width={402} height={874} dark={theme.isDark}>
              {screenLayer}
            </IOSDevice>
          </div>
        );
      })()}
      {tweaksAvailable && <TweaksPanel theme={theme} open={tweaksOpen} onClose={() => setTweaksOpen(false)} cfg={cfg} setCfg={setCfg}/>}
      <style>{`
        @keyframes screenIn { 0%{opacity:0;transform:translateY(6px);} 100%{opacity:1;transform:translateY(0);} }
        input, button, textarea { font-family: inherit; }
        *::-webkit-scrollbar { display: none; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <AppConfigProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </AppConfigProvider>
  );
}
