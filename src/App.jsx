import { useState, useEffect } from 'react';
import { THEMES, typeStyles, Icon } from './design-system.jsx';
import { useT } from './i18n.js';
import { IOSDevice } from './ios-device.jsx';

import { ScreenJoin, ScreenOTP, ScreenConsent, ScreenName, ScreenBaseline, ScreenGoals, ScreenWelcome } from './screens/onboarding.jsx';
import { ScreenHome } from './screens/home.jsx';
import { ScreenCheckIn } from './screens/checkin.jsx';
import { ScreenBreathe } from './screens/breathe.jsx';
import { ScreenChallenges } from './screens/challenges.jsx';
import { ScreenProgress, ScreenProfile } from './screens/progress-profile.jsx';
import { ScreenLibrary, ScreenPlayer, ScreenNotifs } from './screens/content.jsx';

// ── Tab Bar ───────────────────────────────────────────────────
function TabBar({ theme, t, dir, active, onTab }) {
  const T = theme;
  const tabs = [
    { id: 'home',       icon: 'home',    label: t('tabToday') },
    { id: 'library',    icon: 'library', label: dir === 'rtl' ? 'مكتبة' : 'Library' },
    { id: 'checkin',    icon: 'sparkle', label: t('tabCheckIn') },
    { id: 'challenges', icon: 'trophy',  label: t('tabChallenges') },
    { id: 'progress',   icon: 'chart',   label: t('tabProgress') },
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

// ── Tweaks Panel ──────────────────────────────────────────────
function TweaksPanel({ theme, open, onClose, cfg, setCfg }) {
  const T = theme;
  if (!open) return null;

  const Row = ({ label, children }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: T.textMuted, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
  const OptRow = ({ opts, value, onChange }) => (
    <div style={{ display: 'flex', gap: 6 }}>
      {opts.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          flex: 1, height: 34, borderRadius: 10,
          background: value === k ? T.accent : T.chipBg,
          color: value === k ? T.accentInk : T.text,
          border: `1px solid ${value === k ? 'transparent' : T.border}`,
          fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>{l}</button>
      ))}
    </div>
  );

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, width: 300, zIndex: 100,
      background: T.surface, border: `1px solid ${T.borderStrong}`,
      borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      padding: 18, direction: 'ltr', fontFamily: typeStyles(T).sansFont, color: T.text,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 20, letterSpacing: -0.3 }}>Tweaks</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}>
          <Icon name="close" size={18}/>
        </button>
      </div>
      <Row label="Theme">
        <OptRow opts={[['brand', 'Brand (Dark)'], ['light', 'Light']]} value={cfg.theme} onChange={v => setCfg({ ...cfg, theme: v })}/>
      </Row>
      <Row label="Language">
        <OptRow opts={[['en', 'English'], ['ar', 'العربية']]} value={cfg.lang} onChange={v => setCfg({ ...cfg, lang: v })}/>
      </Row>
      <Row label="Home layout">
        <OptRow opts={[['list', 'List'], ['stack', 'Stack'], ['agenda', 'Agenda']]} value={cfg.homeVariant} onChange={v => setCfg({ ...cfg, homeVariant: v })}/>
      </Row>
      <Row label="Check-in style">
        <OptRow opts={[['sliders', 'Sliders'], ['emoji', 'Emoji'], ['cards', 'Cards']]} value={cfg.checkinVariant} onChange={v => setCfg({ ...cfg, checkinVariant: v })}/>
      </Row>
      <Row label="Leaderboard">
        <OptRow opts={[['podium', 'Podium'], ['list', 'List']]} value={cfg.leaderboardVariant} onChange={v => setCfg({ ...cfg, leaderboardVariant: v })}/>
      </Row>
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 8 }}>Tap Profile to re-run onboarding.</div>
      <button onClick={() => setCfg({ ...cfg, screen: 'join', onboarded: false })} style={{
        marginTop: 10, width: '100%', height: 36, borderRadius: 10,
        background: T.chipBg, border: `1px solid ${T.border}`, color: T.text,
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>Restart onboarding</button>
    </div>
  );
}

const TWEAK_DEFAULTS = {
  theme: 'brand',
  lang: 'en',
  homeVariant: 'stack',
  checkinVariant: 'sliders',
  leaderboardVariant: 'podium',
};

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const [cfg, setCfg] = useState(() => {
    const saved = localStorage.getItem('wellness-plus-cfg');
    return saved ? { ...TWEAK_DEFAULTS, ...JSON.parse(saved), screen: null } : { ...TWEAK_DEFAULTS };
  });
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [screen, setScreen] = useState(() => {
    return localStorage.getItem('wellness-plus-screen') || 'join';
  });
  const [doneActions, setDoneActions] = useState(new Set());
  const [streak] = useState(21);
  const [joined, setJoined] = useState(false);
  const [playerItem, setPlayerItem] = useState(null);
  const [avatar, setAvatar] = useState(() => localStorage.getItem('wellness-plus-avatar') || 'monogram');
  const [name, setName] = useState(() => localStorage.getItem('wellness-plus-name') || 'Layla');

  useEffect(() => {
    const { screen: _, ...persist } = cfg;
    localStorage.setItem('wellness-plus-cfg', JSON.stringify(persist));
  }, [cfg]);
  useEffect(() => { localStorage.setItem('wellness-plus-screen', screen); }, [screen]);
  useEffect(() => { localStorage.setItem('wellness-plus-avatar', avatar); }, [avatar]);
  useEffect(() => { localStorage.setItem('wellness-plus-name', name); }, [name]);

  const theme = THEMES[cfg.theme] || THEMES.brand;
  const lang = cfg.lang;
  const t = useT(lang);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const go = (s, extra) => {
    if (s === 'player' && extra) {
      const items = {
        'sleep-onset': { id: 'sleep-onset', kind: 'audio',   mins: 6, title: { en: 'Sleep onset — a cue for tonight', ar: 'بداية النوم — إشارة لهذه الليلة' } },
        'box-breath':  { id: 'box-breath',  kind: 'audio',   mins: 2, title: { en: 'Box breathing, guided', ar: 'تنفس مربع، موجَّه' } },
        'desk-mob':    { id: 'desk-mob',    kind: 'video',   mins: 4, title: { en: 'Desk mobility flow', ar: 'حركات مكتبية' } },
        'reset':       { id: 'reset',       kind: 'audio',   mins: 3, title: { en: 'A 3-minute reset between meetings', ar: 'استراحة 3 دقائق بين الاجتماعات' } },
        'wind-down':   { id: 'wind-down',   kind: 'article', mins: 5, title: { en: 'Build an evening wind-down', ar: 'بناء روتين استرخاء مسائي' } },
        'caffeine':    { id: 'caffeine',    kind: 'article', mins: 4, title: { en: 'Caffeine cut-off, in plain terms', ar: 'الكافيين بلغة واضحة' } },
      };
      setPlayerItem(items[extra.id] || items['sleep-onset']);
    }
    setScreen(s);
  };

  const state = {
    doneActions,
    toggleAction: (id) => {
      const n = new Set(doneActions);
      n.has(id) ? n.delete(id) : n.add(id);
      setDoneActions(n);
    },
    streak,
    joined, setJoined,
    playerItem, setPlayerItem,
    avatar, setAvatar,
    name, setName,
  };

  const setLang = (l) => setCfg({ ...cfg, lang: l });
  const setThemeKey = (k) => setCfg({ ...cfg, theme: k });

  let content;
  let showTabs = false;

  switch (screen) {
    case 'join':       content = <ScreenJoin theme={theme} t={t} dir={dir} onNext={() => go('otp')}/>; break;
    case 'otp':        content = <ScreenOTP theme={theme} t={t} dir={dir} onNext={() => go('consent')} onBack={() => go('join')}/>; break;
    case 'consent':    content = <ScreenConsent theme={theme} t={t} dir={dir} onNext={() => go('name')} onBack={() => go('otp')}/>; break;
    case 'name':       content = <ScreenName theme={theme} t={t} dir={dir} state={state} onNext={() => go('baseline')} onBack={() => go('consent')}/>; break;
    case 'baseline':   content = <ScreenBaseline theme={theme} t={t} dir={dir} onNext={() => go('goals')} onBack={() => go('name')}/>; break;
    case 'goals':      content = <ScreenGoals theme={theme} t={t} dir={dir} onNext={() => go('welcome')} onBack={() => go('baseline')}/>; break;
    case 'welcome':    content = <ScreenWelcome theme={theme} t={t} dir={dir} state={state} onNext={() => go('home')}/>; break;
    case 'home':       content = <ScreenHome theme={theme} t={t} dir={dir} go={go} variant={cfg.homeVariant} state={state}/>; showTabs = true; break;
    case 'library':    content = <ScreenLibrary theme={theme} t={t} dir={dir} go={go}/>; showTabs = true; break;
    case 'player':     content = <ScreenPlayer theme={theme} t={t} dir={dir} go={go} state={state}/>; break;
    case 'notifs':     content = <ScreenNotifs theme={theme} t={t} dir={dir} go={go}/>; break;
    case 'checkin':    content = <ScreenCheckIn theme={theme} t={t} dir={dir} go={go} variant={cfg.checkinVariant} state={state}/>; showTabs = true; break;
    case 'breathe':    content = <ScreenBreathe theme={theme} t={t} dir={dir} go={go}/>; break;
    case 'challenges': content = <ScreenChallenges theme={theme} t={t} dir={dir} go={go} variant={cfg.leaderboardVariant} state={state}/>; showTabs = true; break;
    case 'progress':   content = <ScreenProgress theme={theme} t={t} dir={dir} go={go}/>; showTabs = true; break;
    case 'profile':    content = <ScreenProfile theme={theme} t={t} dir={dir} go={go} lang={lang} setLang={setLang} themeKey={cfg.theme} setThemeKey={setThemeKey} state={state}/>; showTabs = true; break;
    default:           content = <ScreenHome theme={theme} t={t} dir={dir} go={go} variant={cfg.homeVariant} state={state}/>; showTabs = true;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.isDark ? '#0a1615' : '#EAE4D5',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, boxSizing: 'border-box',
    }}>
      <div style={{ direction: dir, transition: 'all .3s ease' }}>
        <IOSDevice width={402} height={874} dark={theme.isDark}>
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, fontFamily: typeStyles(theme).sansFont }}>
            <div key={screen + cfg.theme + cfg.lang + cfg.homeVariant + cfg.checkinVariant + cfg.leaderboardVariant}
              style={{ position: 'absolute', inset: 0, animation: 'screenIn .35s ease both' }}>
              {content}
            </div>
            {showTabs && <TabBar theme={theme} t={t} dir={dir} active={screen} onTab={go}/>}
          </div>
        </IOSDevice>
      </div>

      {/* Tweaks toggle button */}
      <button onClick={() => setTweaksOpen(!tweaksOpen)} style={{
        position: 'fixed', bottom: 20, left: 20,
        width: 44, height: 44, borderRadius: 999,
        background: theme.surface, border: `1px solid ${theme.border}`,
        color: theme.text, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 99,
      }}>
        <Icon name="settings" size={18}/>
      </button>

      <TweaksPanel theme={theme} open={tweaksOpen} onClose={() => setTweaksOpen(false)} cfg={cfg} setCfg={setCfg}/>

      <style>{`
        @keyframes screenIn { 0%{opacity:0;transform:translateY(6px);} 100%{opacity:1;transform:translateY(0);} }
        html, body { margin: 0; padding: 0; background: ${theme.isDark ? '#0a1615' : '#EAE4D5'}; }
        * { box-sizing: border-box; }
        input, button, textarea { font-family: inherit; }
        *::-webkit-scrollbar { display: none; }
        * { -webkit-tap-highlight-color: transparent; }
        [dir="rtl"] { font-family: 'IBM Plex Sans Arabic', 'Plus Jakarta Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}
