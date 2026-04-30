import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { Confetti } from './employee/confetti.jsx';
import {
  IOSStatusBar, IOSGlassPill, IOSNavBar, IOSListRow, IOSList,
  IOSDevice, IOSKeyboard,
} from './employee/ios-frame.jsx';
import {
  THEMES, typeStyles, Icon, AvatarDisplay, Button, Card, Chip,
  SectionLabel, WellnessMark, Sparkline, Ring, Slider,
} from './employee/design-system.jsx';
import { STRINGS, useT } from './employee/i18n.jsx';
import {
  ScreenJoin, ScreenOTP, ScreenConsent, ScreenName, ScreenBaseline,
  ScreenGoals, ScreenWelcome,
  // `TopBack` is still referenced by checkin/breathe/content screens that
  // live in this bundle. Re-imported here so those JSX references resolve.
  TopBack,
} from './employee/screens/onboarding.jsx';
import { ScreenHome, IconBtn } from './employee/screens/home.jsx';
import { ScreenCheckIn } from './employee/screens/checkin.jsx';
// --- screens-checkin.jsx ---
// (extracted to ./employee/screens/checkin.jsx)

// --- screens-breathe.jsx ---
// Animated box-breathing exercise

function ScreenBreathe({ theme, t, dir, go }) {
  const T = theme;
  const [running, setRunning] = React.useState(false);
  const [phase, setPhase] = React.useState(0); // 0 inhale, 1 hold, 2 exhale, 3 hold
  const [elapsed, setElapsed] = React.useState(0);
  const PHASE_DUR = 4; // seconds
  const TOTAL = 120;  // 2 min

  React.useEffect(() => {
    if (!running) return;
    const start = Date.now() - elapsed * 1000;
    const id = setInterval(() => {
      const e = (Date.now() - start) / 1000;
      if (e >= TOTAL) { setRunning(false); setElapsed(TOTAL); clearInterval(id); return; }
      setElapsed(e);
      setPhase(Math.floor(e / PHASE_DUR) % 4);
    }, 80);
    return () => clearInterval(id);
  }, [running]);

  const phaseLabel = [t('inhale'), t('hold'), t('exhale'), t('hold')][phase];
  const phaseSecLeft = PHASE_DUR - (elapsed % PHASE_DUR);
  // circle size breathes — inhale 1→1.6, hold 1.6, exhale 1.6→1, hold 1
  const t01 = (elapsed % PHASE_DUR) / PHASE_DUR;
  const scale = phase === 0 ? 1 + t01 * 0.6
             : phase === 1 ? 1.6
             : phase === 2 ? 1.6 - t01 * 0.6
             : 1;

  const timeLeft = Math.max(0, TOTAL - elapsed);
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(Math.floor(timeLeft % 60)).padStart(2, '0');

  return (
    <div style={{ height: '100%', background: T.bg, paddingTop: 54, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <TopBack theme={T} onBack={() => go('home')} dir={dir}/>
        <div style={{
          fontFamily: typeStyles(T).monoFont, fontSize: 14, color: T.textMuted,
          background: T.chipBg, padding: '6px 12px', borderRadius: 999, letterSpacing: 1,
        }}>{mm}:{ss}</div>
      </div>

      <div style={{ padding: '10px 22px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: T.textMuted, fontWeight: 600 }}>
          {t('breathingTitle')}
        </div>
        <div style={{ color: T.textMuted, fontSize: 13, marginTop: 4 }}>{t('breathingSub')}</div>
      </div>

      {/* Breathing visual */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {/* outer rings */}
        <div style={{
          position: 'absolute', width: 280, height: 280, borderRadius: 999,
          border: `1px solid ${T.border}`,
        }}/>
        <div style={{
          position: 'absolute', width: 220, height: 220, borderRadius: 999,
          border: `1px dashed ${T.border}`,
        }}/>
        {/* breathing orb */}
        <div style={{
          width: 160, height: 160, borderRadius: 999,
          background: `radial-gradient(circle at 30% 30%, ${T.accent}, ${T.accentSoft})`,
          transform: `scale(${scale})`,
          transition: 'transform .8s cubic-bezier(.4,0,.2,1)',
          boxShadow: `0 0 80px ${T.accentSoft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', color: T.accentInk, transform: `scale(${1/scale})`, transition: 'transform .8s' }}>
            <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 28, letterSpacing: -0.4 }}>{running ? phaseLabel : t('startBreathing')}</div>
            {running && <div style={{ fontFamily: typeStyles(T).monoFont, fontSize: 14, opacity: 0.7, marginTop: 2 }}>{Math.ceil(phaseSecLeft)}</div>}
          </div>
        </div>
      </div>

      {/* phase dots */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '12px 0' }}>
        {[t('inhale'), t('hold'), t('exhale'), t('hold')].map((p, i) => (
          <div key={i} style={{
            padding: '6px 12px', borderRadius: 999,
            background: running && phase === i ? T.accent : T.chipBg,
            color: running && phase === i ? T.accentInk : T.textMuted,
            fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
          }}>{p}</div>
        ))}
      </div>

      <div style={{ padding: '14px 22px 26px' }}>
        <Button theme={T} onClick={() => setRunning(!running)} icon={running ? 'pause' : 'play'} style={{ width: '100%' }}>
          {running ? (t('done')) : t('startBreathing')}
        </Button>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenBreathe });
// --- screens-challenge.jsx ---
// Challenges + leaderboard (2 styles) + join confetti

function ScreenChallenges({ theme, t, dir, go, variant = 'podium', state }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const [tab, setTab] = React.useState('team'); // team | individual
  const [joined, setJoined] = React.useState(state.joined);
  const [confetti, setConfetti] = React.useState(false);

  const joinChallenge = () => {
    if (joined) return;
    setJoined(true); state.setJoined(true);
    setConfetti(true);
    setTimeout(() => setConfetti(false), 2400);
  };

  const challenge = {
    title: { en: 'Move April', ar: 'تحرك أبريل' },
    sub: { en: '30 minutes of movement, any way you like. 21 days.', ar: '30 دقيقة من الحركة بأي طريقة. 21 يوماً.' },
    progress: 0.42,
    daysLeft: 12,
  };

  const teams = [
    { rank: 1, name: { en: 'People Ops', ar: 'الموارد البشرية' }, pts: 4820, delta: '+12%', members: 14 },
    { rank: 2, name: { en: 'Commercial', ar: 'المبيعات' },        pts: 4510, delta: '+8%',  members: 22 },
    { rank: 3, name: { en: 'Finance',    ar: 'المالية' },          pts: 4260, delta: '+3%',  members: 11, you: true },
    { rank: 4, name: { en: 'Engineering',ar: 'الهندسة' },          pts: 3980, delta: '-2%',  members: 18 },
    { rank: 5, name: { en: 'Marketing',  ar: 'التسويق' },          pts: 3510, delta: '+1%',  members: 9 },
  ];
  const people = [
    { rank: 1, name: 'Y.R.', pts: 612, streak: 18 },
    { rank: 2, name: 'A.M.', pts: 584, streak: 14, you: true },
    { rank: 3, name: 'L.S.', pts: 512, streak: 9 },
    { rank: 4, name: 'F.K.', pts: 488, streak: 7 },
    { rank: 5, name: 'N.H.', pts: 441, streak: 12 },
    { rank: 6, name: 'M.O.', pts: 402, streak: 5 },
  ];

  return (
    <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 54, paddingBottom: 100, boxSizing: 'border-box', position: 'relative' }}>
      <Confetti theme={T} run={confetti}/>
      <div style={{ padding: '16px 22px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 30, letterSpacing: -0.5, color: T.text }}>{t('challengesTitle')}</div>
        <div style={{ color: T.textMuted, fontSize: 12 }}>{lang==='ar'?'أبريل ٢٠٢٦':'April 2026'}</div>
      </div>

      {/* Active challenge card */}
      <div style={{ padding: '6px 16px' }}>
        <Card theme={T} pad={0} radius={24} style={{ overflow: 'hidden' }}>
          <div style={{
            padding: 20, background: `linear-gradient(135deg, ${T.accent}, ${T.accent}dd)`,
            color: T.accentInk, position: 'relative',
          }}>
            <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700, opacity: 0.7 }}>
              {t('activeChallenge')}
            </div>
            <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 30, lineHeight: 1.1, marginTop: 6, letterSpacing: -0.5 }}>{challenge.title[lang]}</div>
            <div style={{ fontSize: 13, marginTop: 8, opacity: 0.85, lineHeight: 1.4 }}>{challenge.sub[lang]}</div>

            {/* progress bar */}
            <div style={{ marginTop: 18, height: 6, borderRadius: 6, background: 'rgba(0,0,0,0.15)', overflow: 'hidden' }}>
              <div style={{ width: `${challenge.progress * 100}%`, height: '100%', background: T.accentInk, borderRadius: 6 }}/>
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, opacity: 0.8 }}>
              <span>{Math.round(challenge.progress * 100)}%</span>
              <span>{challenge.daysLeft} {lang==='ar'?'يوماً متبقياً':'days left'}</span>
            </div>
          </div>
          <div style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', gap: 16, fontSize: 12, color: T.textMuted }}>
              <div><span style={{ color: T.text, fontWeight: 700, fontSize: 16 }}>584</span> <span>pts</span></div>
              <div><span style={{ color: T.text, fontWeight: 700, fontSize: 16 }}>14</span> <span>{lang==='ar'?'يوماً':'days'}</span></div>
              <div><span style={{ color: T.text, fontWeight: 700, fontSize: 16 }}>3</span> <span>{lang==='ar'?'شارات':'badges'}</span></div>
            </div>
            <Button theme={T} size="md" variant={joined ? 'secondary' : 'primary'} onClick={joinChallenge}>
              {joined ? t('joined') : t('joinNow')}
            </Button>
          </div>
        </Card>
      </div>

      {/* Leaderboard */}
      <div style={{ padding: '22px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: T.textMuted, fontWeight: 600 }}>
            {t('leaderboard')}
          </div>
          <div style={{ display: 'flex', background: T.chipBg, borderRadius: 999, padding: 3, border: `1px solid ${T.border}` }}>
            {[['team', t('team')], ['individual', t('individual')]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                background: tab === k ? T.accent : 'transparent',
                color: tab === k ? T.accentInk : T.text,
                border: 'none', borderRadius: 999, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
        </div>

        {variant === 'podium'
          ? <LBPodium theme={T} rows={tab === 'team' ? teams : people} lang={lang} kind={tab}/>
          : <LBList theme={T} rows={tab === 'team' ? teams : people} lang={lang} kind={tab}/>}
      </div>

      {/* Confetti toast */}
      {confetti && (
        <div style={{
          position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: '14px 20px', textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)', animation: 'toast 2.4s ease forwards',
          zIndex: 5, minWidth: 240,
        }}>
          <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 22, color: T.text, letterSpacing: -0.3 }}>{t('joinedConfetti')}</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>{t('confettiSub')}</div>
          <style>{`@keyframes toast { 0%{opacity:0;transform:translate(-50%,-10px);} 15%{opacity:1;transform:translate(-50%,0);} 85%{opacity:1;} 100%{opacity:0;} }`}</style>
        </div>
      )}
    </div>
  );
}

// Style A — podium top-3 + list rest
function LBPodium({ theme, rows, lang, kind }) {
  const T = theme;
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const order = [1, 0, 2]; // 2nd, 1st, 3rd
  const heights = [92, 118, 76];
  return (
    <Card theme={T} pad={0} radius={22} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10 }}>
        {order.map((idx, i) => {
          const row = top[idx];
          if (!row) return <div key={i} style={{ flex: 1 }}/>;
          const label = kind === 'team' ? row.name[lang] : row.name;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: idx === 0 ? 56 : 44, height: idx === 0 ? 56 : 44,
                borderRadius: 999, background: T.surfaceAlt,
                border: `2px solid ${idx === 0 ? T.accent : T.border}`,
                color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: typeStyles(T).displayFont, fontSize: idx === 0 ? 20 : 16,
                position: 'relative',
              }}>
                {kind === 'team' ? <Icon name="users" size={20}/> : label}
                {idx === 0 && <div style={{ position: 'absolute', top: -6, background: T.accent, color: T.accentInk, borderRadius: 999, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>1</div>}
              </div>
              <div style={{ fontSize: 11, color: T.text, fontWeight: 600, textAlign: 'center', maxWidth: 90, lineHeight: 1.2 }}>{label}</div>
              <div style={{
                width: '70%', height: heights[i], background: idx === 0 ? T.accent : T.accentSoft,
                borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                paddingTop: 8, color: idx === 0 ? T.accentInk : T.accent, fontSize: 13, fontWeight: 700,
              }}>{row.pts}</div>
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          {rest.map((row, i) => (
            <LBRow key={i} row={row} kind={kind} lang={lang} theme={T} last={i === rest.length - 1}/>
          ))}
        </div>
      )}
    </Card>
  );
}

// Style B — dense list with bars
function LBList({ theme, rows, lang, kind }) {
  const T = theme;
  const max = rows[0].pts;
  return (
    <Card theme={T} pad={0} radius={22}>
      {rows.map((row, i) => {
        const w = (row.pts / max) * 100;
        const label = kind === 'team' ? row.name[lang] : row.name;
        return (
          <div key={i} style={{
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : 'none',
            background: row.you ? T.accentSoft : 'transparent',
          }}>
            <div style={{
              width: 22, fontFamily: typeStyles(T).monoFont, fontSize: 13,
              color: row.rank <= 3 ? T.accent : T.textMuted, fontWeight: 700, textAlign: 'center',
            }}>{String(row.rank).padStart(2,'0')}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>
                  {label}{row.you && <span style={{ marginLeft: 6, fontSize: 10, color: T.accent, fontWeight: 700 }}>YOU</span>}
                </div>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{row.pts}</div>
              </div>
              <div style={{ height: 4, background: T.track, borderRadius: 3 }}>
                <div style={{ width: `${w}%`, height: '100%', background: row.you ? T.accent : T.textMuted, borderRadius: 3, opacity: row.you ? 1 : 0.4 }}/>
              </div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function LBRow({ theme, row, kind, lang, last }) {
  const T = theme;
  const label = kind === 'team' ? row.name[lang] : row.name;
  return (
    <div style={{
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: last ? 'none' : `1px solid ${T.border}`,
      background: row.you ? T.accentSoft : 'transparent',
    }}>
      <div style={{ width: 22, fontFamily: typeStyles(T).monoFont, fontSize: 12, color: T.textMuted, fontWeight: 700, textAlign: 'center' }}>{row.rank}</div>
      <div style={{ flex: 1, fontSize: 14, color: T.text, fontWeight: 500 }}>
        {label}{row.you && <span style={{ marginLeft: 6, fontSize: 10, color: T.accent, fontWeight: 700 }}>YOU</span>}
      </div>
      <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{row.pts}</div>
    </div>
  );
}

Object.assign(window, { ScreenChallenges });
// --- screens-progress-profile.jsx ---
// Progress / insights screen + Profile

function ScreenProgress({ theme, t, dir, go }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const [metric, setMetric] = React.useState('sleep');
  const metrics = [
    { id: 'sleep', label: t('sleep'), icon: 'moon', values: [6.2,6.8,6.1,7.2,6.9,7.4,7.1,7.0,6.8,7.3,7.5,7.2,7.4,7.6], current: '7.3h', delta: '+0.8h', dir: 'up' },
    { id: 'stress', label: t('stress'), icon: 'leaf', values: [6,7,6,5,6,4,5,4,5,4,3,4,3,3], current: '3.4', delta: '-2.1', dir: 'down' },
    { id: 'energy', label: t('energy'), icon: 'bolt', values: [4,5,4,5,6,6,7,6,7,7,8,7,8,7], current: '7.1', delta: '+2.3', dir: 'up' },
    { id: 'mood', label: t('mood'), icon: 'smile', values: [5,6,5,6,6,7,6,7,7,8,7,8,8,8], current: '7.8', delta: '+1.6', dir: 'up' },
  ];
  const m = metrics.find(x => x.id === metric);

  return (
    <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 54, paddingBottom: 100, boxSizing: 'border-box' }}>
      <div style={{ padding: '16px 22px 10px' }}>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 30, letterSpacing: -0.5, color: T.text }}>{t('progressTitle')}</div>
        <div style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }}>{t('last30')}</div>
      </div>

      {/* Metric chips */}
      <div style={{ padding: '6px 22px 14px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {metrics.map(mm => (
          <Chip key={mm.id} theme={T} active={metric === mm.id} onClick={() => setMetric(mm.id)} icon={mm.icon}>
            {mm.label}
          </Chip>
        ))}
      </div>

      {/* Big chart */}
      <div style={{ padding: '0 16px' }}>
        <Card theme={T} pad={20} radius={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 12, color: T.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>
                {m.label}
              </div>
              <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 46, color: T.text, lineHeight: 1, marginTop: 6, letterSpacing: -1 }}>
                {m.current}
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: T.positive + '22', color: T.positive, padding: '6px 10px', borderRadius: 999,
              fontSize: 12, fontWeight: 600,
            }}>
              <Icon name={m.dir === 'up' ? 'chevUp' : 'chevDown'} size={12}/>
              {m.delta}
            </div>
          </div>
          <Sparkline theme={T} values={m.values} height={120} stroke={T.accent}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: T.textFaint, letterSpacing: 0.5 }}>
            <span>30d</span><span>21d</span><span>14d</span><span>7d</span><span>{lang==='ar'?'اليوم':'today'}</span>
          </div>
        </Card>
      </div>

      {/* Insights */}
      <div style={{ padding: '22px 16px 0' }}>
        <SectionLabel theme={T} style={{ padding: '0 4px' }}>{t('insights')}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <InsightCard theme={T} icon="moon" tone="positive"
            title={lang==='ar' ? 'النوم تحسَّن ٠٫٨ ساعة' : 'Sleep improved 0.8h'}
            body={lang==='ar' ? 'الاتجاه بدأ بعد إضافة تنفس المساء قبل أسبوعين.' : 'The trend started after you added evening breathing 2 weeks ago.'} />
          <InsightCard theme={T} icon="leaf" tone="info"
            title={lang==='ar' ? 'التوتر أقل أيام الخميس' : 'Stress lowest on Thursdays'}
            body={lang==='ar' ? 'أعلى ارتفاع في التوتر يوم الأحد.' : 'Your highest stress spikes consistently land on Sundays.'} />
          <InsightCard theme={T} icon="activity" tone="neutral"
            title={lang==='ar' ? '١٤ تسجيلاً في ١٤ يوماً' : '14 check-ins in 14 days'}
            body={lang==='ar' ? 'العادة استقرت. جرّب أضف ملاحظة هذا الأسبوع.' : 'Your streak is stable. Try adding a note this week.'} />
        </div>
      </div>
    </div>
  );
}

function InsightCard({ theme, icon, tone, title, body }) {
  const T = theme;
  const colorMap = { positive: T.positive, info: T.info, neutral: T.textMuted };
  const c = colorMap[tone];
  return (
    <Card theme={T} pad={16}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: c + '22', color: c,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name={icon} size={18}/></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{body}</div>
        </div>
      </div>
    </Card>
  );
}

function ScreenProfile({ theme, t, dir, go, lang, setLang, themeKey, setThemeKey, state }) {
  const T = theme;
  const [anon, setAnon] = React.useState(true);
  const [share, setShare] = React.useState(true);
  const [notifs, setNotifs] = React.useState(true);
  const [picker, setPicker] = React.useState(false);
  const name = (state && state.name) || 'Amira Mostafa';
  const avatar = (state && state.avatar) || 'monogram';

  return (
    <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 54, paddingBottom: 100, boxSizing: 'border-box' }}>
      <div style={{ padding: '16px 22px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => setPicker(true)} style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          position: 'relative',
        }}>
          <AvatarDisplay theme={T} kind={avatar} name={name} size={72}/>
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 26, height: 26, borderRadius: 999, background: T.accent, color: T.accentInk,
            border: `2px solid ${T.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon name="camera" size={13}/></div>
        </button>
        <div>
          <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 26, color: T.text, letterSpacing: -0.4, lineHeight: 1 }}>
            {name}
          </div>
          <div style={{ color: T.textMuted, fontSize: 13, marginTop: 4 }}>{lang==='ar' ? 'مجموعة النيل · المالية' : 'Nile Group · Finance'}</div>
        </div>
      </div>

      <SectionLabel theme={T}>{t('privacy')}</SectionLabel>
      <div style={{ padding: '0 16px' }}>
        <Card theme={T} pad={0} radius={20}>
          <ToggleRow theme={T} icon="shield" title={t('anonymous')} sub={t('anonymousSub')} value={anon} onChange={setAnon}/>
          <div style={{ height: 1, background: T.border, marginLeft: 62 }}/>
          <ToggleRow theme={T} icon="chart" title={t('shareAgg')} sub={t('shareAggSub')} value={share} onChange={setShare} disabled/>
        </Card>
      </div>

      <div style={{ height: 16 }}/>
      <SectionLabel theme={T}>{t('notifs')}</SectionLabel>
      <div style={{ padding: '0 16px' }}>
        <Card theme={T} pad={0} radius={20}>
          <ToggleRow theme={T} icon="bell" title={lang==='ar'?'تذكير التسجيل اليومي':'Daily check-in reminder'} sub="09:00" value={notifs} onChange={setNotifs}/>
        </Card>
      </div>

      <div style={{ height: 16 }}/>
      <SectionLabel theme={T}>{t('language')} · {lang==='ar'?'المظهر':'Appearance'}</SectionLabel>
      <div style={{ padding: '0 16px' }}>
        <Card theme={T} pad={16} radius={20} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 8 }}>{t('language')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['en','English'],['ar','العربية']].map(([k,l]) => (
                <button key={k} onClick={() => setLang(k)} style={{
                  flex: 1, height: 44, borderRadius: 12,
                  background: lang === k ? T.accent : T.chipBg,
                  color: lang === k ? T.accentInk : T.text,
                  border: `1px solid ${lang === k ? 'transparent' : T.border}`,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 8 }}>{lang==='ar'?'المظهر':'Theme'}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['brand','Brand'],['light','Light']].map(([k,l]) => (
                <button key={k} onClick={() => setThemeKey(k)} style={{
                  flex: 1, height: 44, borderRadius: 12,
                  background: themeKey === k ? T.accent : T.chipBg,
                  color: themeKey === k ? T.accentInk : T.text,
                  border: `1px solid ${themeKey === k ? 'transparent' : T.border}`,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>{l}</button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div style={{ padding: '22px 16px 20px' }}>
        <Button theme={T} variant="secondary" style={{ width: '100%' }}>{t('signOut')}</Button>
      </div>

      {picker && (
        <div onClick={() => setPicker(false)} style={{
          position: 'absolute', inset: 0, background: T.overlay, zIndex: 50,
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', background: T.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: '20px 20px 28px', border: `1px solid ${T.border}`,
            animation: 'sheetUp .25s ease both',
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 18px' }}/>
            <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 22, color: T.text, letterSpacing: -0.3, marginBottom: 6 }}>
              {lang==='ar'?'اختر صورة رمزية':'Choose your avatar'}
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 18 }}>
              {lang==='ar'?'رموز مجردة تحمي خصوصيتك.':'Abstract marks that keep your identity private.'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
              {AVATAR_OPTIONS.map(opt => (
                <button key={opt} onClick={() => { state.setAvatar(opt); setPicker(false); }}
                  style={{
                    padding: 14, background: avatar === opt ? T.accentSoft : T.surfaceAlt,
                    border: `1.5px solid ${avatar === opt ? T.accent : 'transparent'}`,
                    borderRadius: 16, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  }}>
                  <AvatarDisplay theme={T} kind={opt} name={name} size={52}/>
                  <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'capitalize' }}>{opt}</div>
                </button>
              ))}
            </div>
            <Button theme={T} variant="secondary" style={{ width: '100%' }} onClick={() => setPicker(false)}>
              {lang==='ar'?'تم':'Done'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ theme, icon, title, sub, value, onChange, disabled }) {
  const T = theme;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: T.accentSoft, color: T.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}><Icon name={icon} size={18}/></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, color: T.text, fontWeight: 500 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={() => !disabled && onChange(!value)} disabled={disabled}
        style={{
          width: 48, height: 28, borderRadius: 999,
          background: value ? T.accent : T.track,
          border: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer',
          position: 'relative', opacity: disabled ? 0.6 : 1,
          transition: 'background .2s',
        }}>
        <div style={{
          position: 'absolute', top: 3, left: value ? 23 : 3,
          width: 22, height: 22, borderRadius: 999, background: '#fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
          transition: 'left .2s',
        }}/>
      </button>
    </div>
  );
}

Object.assign(window, { ScreenProgress, ScreenProfile });
// --- screens-content.jsx ---
// Content library + audio/video/article player + Notifications

function ScreenLibrary({ theme, t, dir, go }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const [cat, setCat] = React.useState('all');
  const cats = [
    { id: 'all', label: { en: 'All', ar: 'الكل' }, icon: 'sparkle' },
    { id: 'sleep', label: { en: 'Sleep', ar: 'النوم' }, icon: 'moon' },
    { id: 'stress', label: { en: 'Stress', ar: 'التوتر' }, icon: 'leaf' },
    { id: 'move', label: { en: 'Move', ar: 'حركة' }, icon: 'activity' },
    { id: 'focus', label: { en: 'Focus', ar: 'تركيز' }, icon: 'target' },
  ];
  const items = [
    { id: 'sleep-onset', kind: 'audio', mins: 6, cat: 'sleep', title: { en: 'Sleep onset — a cue for tonight', ar: 'بداية النوم — إشارة لهذه الليلة' }, tag: { en: 'Recommended', ar: 'موصى به' } },
    { id: 'box-breath', kind: 'audio', mins: 2, cat: 'stress', title: { en: 'Box breathing, guided', ar: 'تنفس مربع، موجَّه' } },
    { id: 'desk-mob', kind: 'video', mins: 4, cat: 'move', title: { en: 'Desk mobility flow', ar: 'حركات مكتبية' } },
    { id: 'reset', kind: 'audio', mins: 3, cat: 'focus', title: { en: 'A 3-minute reset between meetings', ar: 'استراحة 3 دقائق بين الاجتماعات' } },
    { id: 'wind-down', kind: 'article', mins: 5, cat: 'sleep', title: { en: 'Build an evening wind-down', ar: 'بناء روتين استرخاء مسائي' } },
    { id: 'caffeine', kind: 'article', mins: 4, cat: 'sleep', title: { en: 'Caffeine cut-off, in plain terms', ar: 'الكافيين بلغة واضحة' } },
  ];
  const filtered = cat === 'all' ? items : items.filter(i => i.cat === cat);

  return (
    <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 54, paddingBottom: 100, boxSizing: 'border-box' }}>
      <div style={{ padding: '16px 22px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 30, letterSpacing: -0.5, color: T.text }}>
          {lang==='ar' ? 'المكتبة' : 'Library'}
        </div>
        <IconBtn theme={T} icon="search" onClick={()=>{}}/>
      </div>

      <div style={{ padding: '4px 22px 14px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {cats.map(c => (
          <Chip key={c.id} theme={T} active={cat === c.id} onClick={() => setCat(c.id)} icon={c.icon}>
            {c.label[lang]}
          </Chip>
        ))}
      </div>

      {/* Featured hero */}
      {cat === 'all' && (
        <div style={{ padding: '0 16px 18px' }}>
          <Card theme={T} pad={0} radius={24} style={{ overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => go('player', { id: 'sleep-onset' })}>
            <div style={{
              height: 180, position: 'relative',
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentSoft})`,
            }}>
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
                <defs>
                  <pattern id="wave" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M0 12 Q6 6 12 12 T24 12" stroke={T.accentInk} strokeWidth="1" fill="none" opacity="0.25"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#wave)"/>
              </svg>
              <div style={{
                position: 'absolute', bottom: 16, right: 16,
                width: 56, height: 56, borderRadius: 999,
                background: T.accentInk, color: T.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Icon name="play" size={22}/></div>
            </div>
            <div style={{ padding: '16px 18px 18px' }}>
              <div style={{ fontSize: 10, letterSpacing: 1, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                {lang==='ar'?'صوت · 6 د · موصى به':'AUDIO · 6 MIN · FOR YOU'}
              </div>
              <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 22, color: T.text, marginTop: 6, letterSpacing: -0.3, lineHeight: 1.2 }}>
                {lang==='ar'?'بداية النوم — إشارة لهذه الليلة':'Sleep onset — a cue for tonight'}
              </div>
            </div>
          </Card>
        </div>
      )}

      <SectionLabel theme={T}>{lang==='ar'?'استكشف':'Explore'}</SectionLabel>
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {filtered.map(it => (
          <Card key={it.id} theme={T} pad={0} radius={18} onClick={() => go('player', { id: it.id })}
                style={{ overflow: 'hidden', cursor: 'pointer' }}>
            <div style={{
              height: 100, position: 'relative',
              background: it.kind === 'video'
                ? `linear-gradient(135deg, ${T.accent}44, ${T.surfaceAlt})`
                : it.kind === 'article'
                ? `linear-gradient(135deg, ${T.surfaceAlt}, ${T.surface})`
                : `linear-gradient(135deg, ${T.accentSoft}, ${T.surfaceAlt})`,
            }}>
              <div style={{
                position: 'absolute', top: 10, left: 10,
                padding: '3px 8px', borderRadius: 999,
                background: T.bg + 'cc', color: T.text,
                fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
              }}>{it.kind}</div>
              <div style={{
                position: 'absolute', bottom: 10, right: 10,
                width: 32, height: 32, borderRadius: 999,
                background: T.accent, color: T.accentInk,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={it.kind === 'article' ? 'book' : 'play'} size={14}/>
              </div>
            </div>
            <div style={{ padding: '10px 12px 14px' }}>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 500, lineHeight: 1.3, minHeight: 34 }}>
                {it.title[lang]}
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>{it.mins} {t('minutes')}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ScreenPlayer({ theme, t, dir, go, state }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const item = state.playerItem || { id: 'sleep-onset', kind: 'audio', mins: 6, title: { en: 'Sleep onset — a cue for tonight', ar: 'بداية النوم — إشارة لهذه الليلة' } };
  const [playing, setPlaying] = React.useState(true);
  const [pos, setPos] = React.useState(0);
  const dur = item.mins * 60;

  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setPos(p => {
        if (p + 1 >= dur) { setPlaying(false); return dur; }
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, dur]);

  const fmt = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const isVideo = item.kind === 'video';
  const isArticle = item.kind === 'article';

  if (isArticle) {
    return (
      <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 54, paddingBottom: 40, boxSizing: 'border-box' }}>
        <div style={{ padding: '14px 22px 0' }}>
          <TopBack theme={T} onBack={() => go('library')} dir={dir}/>
        </div>
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
            {lang==='ar'?'مقال · ':'ARTICLE · '}{item.mins} {t('minutes')}
          </div>
          <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 34, color: T.text, marginTop: 10, letterSpacing: -0.5, lineHeight: 1.1 }}>
            {item.title[lang]}
          </div>
          <div style={{ marginTop: 24, color: T.text, fontSize: 16, lineHeight: 1.6, fontFamily: typeStyles(T).sansFont }}>
            {lang==='ar'
              ? 'روتين الاسترخاء المسائي ليس مجرد طقس. إنه إشارة لدماغك بأن اليوم انتهى. ابدأ بخطوات صغيرة: خفّت الأضواء قبل النوم بساعة، ضع الهاتف خارج الغرفة، ودوّن ثلاثة أشياء سارت بشكل جيد.'
              : "An evening wind-down isn't ritual for ritual's sake. It's a signal to your brain that the day is done. Start small: dim the lights an hour before bed, put the phone outside the bedroom, and jot down three things that went well."}
          </div>
          <div style={{ marginTop: 28, padding: '20px 22px', background: T.surface, borderRadius: 18, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, letterSpacing: 1, color: T.accent, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
              {lang==='ar'?'جربه الليلة':'Try tonight'}
            </div>
            <div style={{ fontSize: 16, color: T.text, lineHeight: 1.5 }}>
              {lang==='ar'?'خفّت الأضواء عند الساعة 9:30، وتنفس مربع لدقيقتين قبل النوم.':'Dim lights at 9:30pm and do 2 minutes of box breathing before bed.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', background: T.bg, paddingTop: 54, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <TopBack theme={T} onBack={() => go('library')} dir={dir}/>
        <IconBtn theme={T} icon="plus"/>
      </div>

      {/* Artwork */}
      <div style={{ padding: '20px 30px 10px' }}>
        <div style={{
          aspectRatio: '1/1', width: '100%', borderRadius: 28,
          background: isVideo
            ? `linear-gradient(135deg, ${T.surfaceAlt}, ${T.bg})`
            : `linear-gradient(135deg, ${T.accent}, ${T.accentSoft})`,
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isVideo ? (
            <>
              <svg width="80%" height="80%" viewBox="0 0 100 100" style={{ opacity: 0.4 }}>
                <path d="M20 60 Q30 40 50 50 T80 40" stroke={T.accent} strokeWidth="2" fill="none"/>
                <path d="M20 70 Q30 50 50 60 T80 50" stroke={T.accent} strokeWidth="2" fill="none" opacity="0.6"/>
              </svg>
              <div style={{
                position: 'absolute', width: 80, height: 80, borderRadius: 999,
                background: T.accent, color: T.accentInk,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Icon name={playing ? 'pause' : 'play'} size={32}/></div>
            </>
          ) : (
            <svg width="70%" height="70%" viewBox="0 0 100 100" style={{ opacity: 0.7 }}>
              {[20,35,50,65,80].map((x,i) => {
                const h = 20 + Math.abs(Math.sin((pos + i*3)/4)) * 40;
                return <rect key={i} x={x-4} y={50-h/2} width="8" height={h} rx="4" fill={T.accentInk}/>;
              })}
            </svg>
          )}
        </div>
      </div>

      <div style={{ padding: '22px 30px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
          {(isVideo ? (lang==='ar'?'فيديو':'VIDEO') : (lang==='ar'?'صوت':'AUDIO'))} · {item.mins} {t('minutes')}
        </div>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 26, color: T.text, marginTop: 8, letterSpacing: -0.4, lineHeight: 1.15 }}>
          {item.title[lang]}
        </div>
      </div>

      {/* Scrubber */}
      <div style={{ padding: '24px 30px 0' }}>
        <div style={{ height: 4, borderRadius: 4, background: T.track, position: 'relative' }}>
          <div style={{ width: `${(pos/dur)*100}%`, height: '100%', background: T.accent, borderRadius: 4 }}/>
          <div style={{
            position: 'absolute', left: `calc(${(pos/dur)*100}% - 6px)`, top: -4,
            width: 12, height: 12, borderRadius: 999, background: T.accent,
          }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: typeStyles(T).monoFont, fontSize: 11, color: T.textMuted }}>
          <span>{fmt(pos)}</span><span>-{fmt(dur - pos)}</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: '18px 30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <button onClick={() => setPos(Math.max(0, pos - 15))} style={{
          background: 'transparent', border: 'none', color: T.text, cursor: 'pointer', padding: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>
          </svg>
          <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>15s</div>
        </button>
        <button onClick={() => setPlaying(!playing)} style={{
          width: 72, height: 72, borderRadius: 999, background: T.accent, color: T.accentInk,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 10px 30px ${T.accent}55`,
        }}>
          <Icon name={playing ? 'pause' : 'play'} size={30}/>
        </button>
        <button onClick={() => setPos(Math.min(dur, pos + 30))} style={{
          background: 'transparent', border: 'none', color: T.text, cursor: 'pointer', padding: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>
          </svg>
          <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>30s</div>
        </button>
      </div>
    </div>
  );
}

function ScreenNotifs({ theme, t, dir, go }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const sections = [
    {
      label: lang==='ar'?'اليوم':'Today',
      items: [
        { icon: 'flame', color: T.accent, title: { en: '21 day streak! Keep it going', ar: '21 يوماً متتالياً! حافظ عليها' }, time: '08:30', unread: true },
        { icon: 'trophy', color: T.positive, title: { en: 'You climbed to #2 on your team', ar: 'صعدت إلى المركز الثاني في فريقك' }, time: '07:10', unread: true },
      ],
    },
    {
      label: lang==='ar'?'هذا الأسبوع':'This week',
      items: [
        { icon: 'moon', color: T.info, title: { en: 'Sleep improved 0.8h this week', ar: 'النوم تحسَّن 0.8 ساعة هذا الأسبوع' }, time: 'Mon', unread: false },
        { icon: 'sparkle', color: T.accent, title: { en: 'New content: "Caffeine cut-off, in plain terms"', ar: 'محتوى جديد: "الكافيين بلغة واضحة"' }, time: 'Sun', unread: false },
        { icon: 'users', color: T.info, title: { en: 'Finance team just joined Move April', ar: 'فريق المالية انضم لتحدي تحرَّك أبريل' }, time: 'Sat', unread: false },
      ],
    },
  ];
  return (
    <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 54, paddingBottom: 40, boxSizing: 'border-box' }}>
      <div style={{ padding: '14px 22px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <TopBack theme={T} onBack={() => go('home')} dir={dir}/>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 26, letterSpacing: -0.4, color: T.text, flex: 1 }}>
          {lang==='ar'?'الإشعارات':'Notifications'}
        </div>
        <button style={{ background:'transparent', border:'none', color:T.accent, fontSize:13, fontWeight:600, cursor:'pointer' }}>
          {lang==='ar'?'تعليم الكل':'Mark all read'}
        </button>
      </div>

      {sections.map((sec, si) => (
        <div key={si}>
          <SectionLabel theme={T} style={{ marginTop: 14 }}>{sec.label}</SectionLabel>
          <div style={{ padding: '0 16px' }}>
            <Card theme={T} pad={0} radius={20}>
              {sec.items.map((it, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, padding: '14px 16px', alignItems: 'flex-start',
                  borderBottom: i < sec.items.length - 1 ? `1px solid ${T.border}` : 'none',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: it.color + '22', color: it.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><Icon name={it.icon} size={18}/></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: T.text, lineHeight: 1.4, fontWeight: it.unread ? 600 : 500 }}>
                      {it.title[lang]}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{it.time}</div>
                  </div>
                  {it.unread && <div style={{ width: 8, height: 8, borderRadius: 999, background: T.accent, marginTop: 6 }}/>}
                </div>
              ))}
            </Card>
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { ScreenLibrary, ScreenPlayer, ScreenNotifs });
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
        <OptRow opts={[['brand','Brand (Dark)'],['light','Light']]} value={cfg.theme} onChange={v => setCfg({ ...cfg, theme: v })}/>
      </Row>
      <Row label="Language">
        <OptRow opts={[['en','English'],['ar','العربية']]} value={cfg.lang} onChange={v => setCfg({ ...cfg, lang: v })}/>
      </Row>
      <Row label="Home layout">
        <OptRow opts={[['list','List'],['stack','Stack'],['agenda','Agenda']]} value={cfg.homeVariant} onChange={v => setCfg({ ...cfg, homeVariant: v })}/>
      </Row>
      <Row label="Check-in style">
        <OptRow opts={[['sliders','Sliders'],['emoji','Emoji'],['cards','Cards']]} value={cfg.checkinVariant} onChange={v => setCfg({ ...cfg, checkinVariant: v })}/>
      </Row>
      <Row label="Leaderboard">
        <OptRow opts={[['podium','Podium'],['list','List']]} value={cfg.leaderboardVariant} onChange={v => setCfg({ ...cfg, leaderboardVariant: v })}/>
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

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "brand",
  "lang": "en",
  "homeVariant": "stack",
  "checkinVariant": "sliders",
  "leaderboardVariant": "podium"
}/*EDITMODE-END*/;

function App() {
  const [cfg, setCfg] = React.useState(() => {
    const saved = localStorage.getItem('wellness-plus-cfg');
    return saved ? { ...TWEAK_DEFAULTS, ...JSON.parse(saved), screen: null } : { ...TWEAK_DEFAULTS };
  });
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

  React.useEffect(() => {
    const { screen: _, ...persist } = cfg;
    localStorage.setItem('wellness-plus-cfg', JSON.stringify(persist));
  }, [cfg]);
  React.useEffect(() => {
    localStorage.setItem('wellness-plus-screen', screen);
  }, [screen]);
  React.useEffect(() => { localStorage.setItem('wellness-plus-avatar', avatar); }, [avatar]);
  React.useEffect(() => { localStorage.setItem('wellness-plus-name', name); }, [name]);

  // Tweaks edit mode contract
  React.useEffect(() => {
    const handler = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch(_) {}
    return () => window.removeEventListener('message', handler);
  }, []);

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
      <TweaksPanel theme={theme} open={tweaksOpen} onClose={() => setTweaksOpen(false)} cfg={cfg} setCfg={setCfg}/>
      <style>{`
        @keyframes screenIn { 0%{opacity:0;transform:translateY(6px);} 100%{opacity:1;transform:translateY(0);} }
        input, button, textarea { font-family: inherit; }
        *::-webkit-scrollbar { display: none; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
