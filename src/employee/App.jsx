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
  ScreenJoin, ScreenConsent, ScreenName, ScreenBaseline,
  ScreenGoals, ScreenWelcome,
} from './screens/onboarding.jsx';
import { ScreenHome } from './screens/home.jsx';
import { ScreenCheckIn } from './screens/checkin.jsx';
import { ScreenBreathe } from './screens/breathe.jsx';
import { ScreenHabitChallenge } from './screens/habit-challenge.jsx';
import { ScreenProgress } from './screens/progress.jsx';
import { ScreenProfile }  from './screens/profile.jsx';
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

const ONBOARDING_SCREENS = ['join', 'consent', 'name', 'baseline', 'goals', 'welcome'];
const MAIN_SCREENS = ['home', 'library', 'checkin', 'challenges', 'progress', 'profile', 'mine', 'breathe', 'player', 'notifs', 'competition-path'];

// --- app.jsx ---
// Main app — state, routing, Tweaks, nav

// Small unread-count badge overlaid on the bell icon in the home header.
// Positioned to track the IconBtn at top-right of the home screen header
// (54px status-bar offset + 18px header padding + ~28px above bell center).
function BellBadge({ theme, count, dir }) {
  const T = theme;
  const display = count > 99 ? '99+' : String(count);
  // The home header lays out: [logo]                  [bell] [avatar]
  // bell IconBtn is 40x40, avatar 38px, gap 8, padding 22px from edge.
  // RTL flips so badge sticks to the leading-edge instead.
  const horizontal = dir === 'rtl'
    ? { left: 22 + 38 + 8 + 26 } // align over bell on the left side
    : { right: 22 + 38 + 8 + 26 };
  return (
    <div style={{
      position: 'absolute',
      top: 'calc(var(--wp-top) + 14px)', // safe-area / status-bar offset + header padding-top, nudge upward
      ...horizontal,
      minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box',
      borderRadius: 999,
      background: T.danger || T.accent,
      color: T.accentInk || '#fff',
      fontSize: 10, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `2px solid ${T.bg}`,
      pointerEvents: 'none',
      zIndex: 5,
    }}>{display}</div>
  );
}

function TabBar({ theme, t, dir, active, onTab }) {
  const T = theme;
  const tabs = [
    { id: 'home', icon: 'home', label: t('tabToday') },
    { id: 'library', icon: 'library', label: dir==='rtl'?'مكتبة':'Library' },
    { id: 'checkin', icon: 'sparkle', label: t('tabCheckIn') },
    { id: 'challenges', icon: 'trophy', label: t('tabChallenges') },
    { id: 'progress', icon: 'chart', label: t('tabProgress') },
    { id: 'mine', icon: 'star', label: t('tabMine') },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      paddingBottom: 'var(--wp-bottom)', paddingTop: 8,
      background: `linear-gradient(to top, ${T.bg} 70%, transparent)`,
    }}>
      <div style={{
        margin: '0 16px', background: T.surface,
        border: `1px solid ${T.border}`, borderRadius: 22,
        padding: 6, display: 'flex',
        boxShadow: T.isDark ? '0 10px 30px rgba(0,0,0,0.35)' : '0 10px 30px rgba(0,0,0,0.08)',
      }}>
        {tabs.map(tab => {
          const isActive = active === tab.id;
          return (
            <button key={tab.id} onClick={() => onTab(tab.id)}
              aria-label={tab.label} aria-current={isActive ? 'page' : undefined} style={{
              flex: 1, height: 52, borderRadius: 14,
              background: isActive ? T.accent : 'transparent',
              color: isActive ? T.accentInk : T.textMuted,
              border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              transition: 'background .2s',
            }}>
              <Icon name={tab.icon} size={19}/>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.2, whiteSpace: 'nowrap' }}>{tab.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const { session, profile, loading: authLoading, profileLoaded } = useAuth();
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
    if (session && !profileLoaded) return;
    if (!session) {
      // Unauthenticated users only sit on join.
      if (screen !== 'join') {
        setScreen('join');
      }
    } else if (!(profile?.onboarded || profile?.onboarded_at)) {
      // Authenticated but not onboarded — must be on consent/name/baseline/goals/welcome.
      // If they're on join/null/main, jump them to consent.
      if (screen === null || screen === 'join' || MAIN_SCREENS.includes(screen)) {
        setScreen('consent');
      }
    } else {
      // Fully onboarded — never show onboarding screens again.
      if (screen === null || ONBOARDING_SCREENS.includes(screen)) {
        setScreen('home');
      }
    }
  }, [authLoading, session, profile, profileLoaded, screen]);
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
  };

  const setLang = (l) => setCfg({ ...cfg, lang: l });
  const setThemeKey = (k) => setCfg({ ...cfg, theme: k });

  // Splash while auth bootstraps, or while the routing effect is still resolving the initial screen.
  if (authLoading || (session && !profileLoaded) || screen === null) {
    return <Splash theme={theme}/>;
  }

  let content, showTabs = false;
  switch (screen) {
    case 'join':     content = <ScreenJoin theme={theme} t={t} dir={dir} onNext={() => go('consent')}/>; break;
    case 'consent':  content = <ScreenConsent theme={theme} t={t} dir={dir} onNext={() => go('name')} onBack={() => go('join')}/>; break;
    case 'name':     content = <ScreenName theme={theme} t={t} dir={dir} state={state} onNext={() => go('baseline')} onBack={() => go('consent')}/>; break;
    case 'baseline': content = <ScreenBaseline theme={theme} t={t} dir={dir} onNext={() => go('goals')} onBack={() => go('name')}/>; break;
    case 'goals':    content = <ScreenGoals theme={theme} t={t} dir={dir} onNext={() => go('welcome')} onBack={() => go('baseline')}/>; break;
    case 'welcome':  content = <ScreenWelcome theme={theme} t={t} dir={dir} state={state} onNext={() => go('home')}/>; break;
    case 'home':     content = <ScreenHome theme={theme} t={t} dir={dir} go={go} variant={cfg.homeVariant} state={state}/>; showTabs = true; break;
    case 'library':  content = <ScreenLibrary theme={theme} t={t} dir={dir} go={go}/>; showTabs = true; break;
    case 'player':   content = <ScreenPlayer theme={theme} t={t} dir={dir} go={go} state={state}/>; break;
    case 'notifs':   content = <ScreenNotifs theme={theme} t={t} dir={dir} go={go}/>; break;
    case 'checkin':  content = <ScreenCheckIn theme={theme} t={t} dir={dir} go={go} variant={cfg.checkinVariant} state={state}/>; showTabs = true; break;
    case 'breathe':  content = <ScreenBreathe theme={theme} t={t} dir={dir} go={go}/>; break;
    case 'challenges': content = <ScreenHabitChallenge theme={theme} dir={dir} go={go}/>; showTabs = true; break;
    case 'progress': content = <ScreenProgress theme={theme} t={t} dir={dir} go={go}/>; showTabs = true; break;
    case 'mine':     content = <ScreenMine theme={theme} t={t} dir={dir} go={go}/>; showTabs = true; break;
    case 'competition-path': content = <ScreenCompetitionPath theme={theme} t={t} dir={dir} go={go} challengeId={competitionId}/>; break;
    case 'profile':  content = <ScreenProfile theme={theme} t={t} dir={dir} go={go} lang={lang} setLang={setLang} themeKey={cfg.theme} setThemeKey={setThemeKey} state={state}/>; showTabs = true; break;
    default:         content = <ScreenHome theme={theme} t={t} dir={dir} go={go} variant={cfg.homeVariant} state={state}/>; showTabs = true;
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
            <div key={screen + cfg.theme + cfg.lang + cfg.homeVariant + cfg.checkinVariant + cfg.leaderboardVariant}
                 style={{ position: 'absolute', inset: 0, animation: 'screenIn .35s ease both' }}>
              {content}
            </div>
            {/* Realtime unread-notification badge over the home-screen bell. */}
            {screen === 'home' && unreadCount > 0 && (
              <BellBadge theme={theme} count={unreadCount} dir={dir}/>
            )}
            {showTabs && <TabBar theme={theme} t={t} dir={dir} active={screen} onTab={go}/>}
            <OfflineBanner theme={theme} lang={lang}/>
            {showTabs && <InstallBanner theme={theme} lang={lang}/>}
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
