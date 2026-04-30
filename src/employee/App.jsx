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
  ScreenJoin, ScreenOTP, ScreenConsent, ScreenName, ScreenBaseline,
  ScreenGoals, ScreenWelcome,
} from './screens/onboarding.jsx';
import { ScreenHome } from './screens/home.jsx';
import { ScreenCheckIn } from './screens/checkin.jsx';
import { ScreenBreathe } from './screens/breathe.jsx';
import { ScreenChallenges } from './screens/challenges.jsx';
import { ScreenProgress } from './screens/progress.jsx';
import { ScreenProfile }  from './screens/profile.jsx';
import { ScreenLibrary, ScreenPlayer } from './screens/content.jsx';
import { ScreenNotifs } from './screens/notifications.jsx';
import { TweaksPanel } from './tweaks-panel.jsx';
import { AppConfigProvider, useAppConfig } from './state/app-config-context.jsx';

// --- app.jsx ---
// Main app — state, routing, Tweaks, nav

function TabBar({ theme, t, dir, active, onTab }) {
  const T = theme;
  const tabs = [
    { id: 'home', icon: 'home', label: t('tabToday') },
    { id: 'library', icon: 'library', label: dir==='rtl'?'مكتبة':'Library' },
    { id: 'checkin', icon: 'sparkle', label: t('tabCheckIn') },
    { id: 'challenges', icon: 'trophy', label: t('tabChallenges') },
    { id: 'progress', icon: 'chart', label: t('tabProgress') },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      paddingBottom: 24, paddingTop: 8,
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
            <button key={tab.id} onClick={() => onTab(tab.id)} style={{
              flex: 1, height: 52, borderRadius: 14,
              background: isActive ? T.accent : 'transparent',
              color: isActive ? T.accentInk : T.textMuted,
              border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              transition: 'background .2s',
            }}>
              <Icon name={tab.icon} size={19}/>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.2 }}>{tab.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AppInner() {
  const { cfg, setCfg } = useAppConfig();
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [screen, setScreen] = React.useState(() => {
    return localStorage.getItem('wellness-plus-screen') || 'join';
  });
  const [doneActions, setDoneActions] = React.useState(new Set());
  const [streak, setStreak] = React.useState(21);
  const [joined, setJoined] = React.useState(false);
  const [playerItem, setPlayerItem] = React.useState(null);
  const [avatar, setAvatar] = React.useState(() => localStorage.getItem('wellness-plus-avatar') || 'monogram');
  const [name, setName] = React.useState(() => localStorage.getItem('wellness-plus-name') || 'Layla');

  const tweaksAvailable = import.meta.env.DEV ||
    new URLSearchParams(window.location.search).get('tweaks') === '1';

  React.useEffect(() => {
    localStorage.setItem('wellness-plus-screen', screen);
  }, [screen]);
  React.useEffect(() => { localStorage.setItem('wellness-plus-avatar', avatar); }, [avatar]);
  React.useEffect(() => { localStorage.setItem('wellness-plus-name', name); }, [name]);

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

  const go = (s, extra) => {
    if (s === 'player' && extra) {
      const items = {
        'sleep-onset': { id: 'sleep-onset', kind: 'audio', mins: 6, title: { en: 'Sleep onset — a cue for tonight', ar: 'بداية النوم — إشارة لهذه الليلة' } },
        'box-breath': { id: 'box-breath', kind: 'audio', mins: 2, title: { en: 'Box breathing, guided', ar: 'تنفس مربع، موجَّه' } },
        'desk-mob': { id: 'desk-mob', kind: 'video', mins: 4, title: { en: 'Desk mobility flow', ar: 'حركات مكتبية' } },
        'reset': { id: 'reset', kind: 'audio', mins: 3, title: { en: 'A 3-minute reset between meetings', ar: 'استراحة 3 دقائق بين الاجتماعات' } },
        'wind-down': { id: 'wind-down', kind: 'article', mins: 5, title: { en: 'Build an evening wind-down', ar: 'بناء روتين استرخاء مسائي' } },
        'caffeine': { id: 'caffeine', kind: 'article', mins: 4, title: { en: 'Caffeine cut-off, in plain terms', ar: 'الكافيين بلغة واضحة' } },
      };
      setPlayerItem(items[extra.id] || items['sleep-onset']);
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

  let content, showTabs = false;
  switch (screen) {
    case 'join':     content = <ScreenJoin theme={theme} t={t} dir={dir} onNext={() => go('otp')}/>; break;
    case 'otp':      content = <ScreenOTP theme={theme} t={t} dir={dir} onNext={() => go('consent')} onBack={() => go('join')}/>; break;
    case 'consent':  content = <ScreenConsent theme={theme} t={t} dir={dir} onNext={() => go('name')} onBack={() => go('otp')}/>; break;
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
    case 'challenges': content = <ScreenChallenges theme={theme} t={t} dir={dir} go={go} variant={cfg.leaderboardVariant} state={state}/>; showTabs = true; break;
    case 'progress': content = <ScreenProgress theme={theme} t={t} dir={dir} go={go}/>; showTabs = true; break;
    case 'profile':  content = <ScreenProfile theme={theme} t={t} dir={dir} go={go} lang={lang} setLang={setLang} themeKey={cfg.theme} setThemeKey={setThemeKey} state={state}/>; showTabs = true; break;
    default:         content = <ScreenHome theme={theme} t={t} dir={dir} go={go} variant={cfg.homeVariant} state={state}/>; showTabs = true;
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.bg === '#F6F3EC' ? '#EAE4D5' : '#0a1615', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, boxSizing: 'border-box' }}>
      <div style={{ direction: dir, transition: 'all .3s ease' }}>
        <IOSDevice width={402} height={874} dark={theme.isDark}>
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            fontFamily: typeStyles(theme).sansFont,
          }}>
            <div key={screen + cfg.theme + cfg.lang + cfg.homeVariant + cfg.checkinVariant + cfg.leaderboardVariant}
                 style={{ position: 'absolute', inset: 0, animation: 'screenIn .35s ease both' }}>
              {content}
            </div>
            {showTabs && <TabBar theme={theme} t={t} dir={dir} active={screen} onTab={go}/>}
          </div>
        </IOSDevice>
      </div>
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
      <AppInner />
    </AppConfigProvider>
  );
}
