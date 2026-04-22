import { useState } from 'react';
import { typeStyles, Icon, Button, Card } from '../design-system.jsx';
import { Confetti } from '../confetti.jsx';

export function ScreenChallenges({ theme, t, dir, go, variant = 'podium', state }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const [tab, setTab] = useState('team');
  const [joined, setJoined] = useState(state.joined);
  const [confetti, setConfetti] = useState(false);

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
        <div style={{ color: T.textMuted, fontSize: 12 }}>{lang === 'ar' ? 'أبريل ٢٠٢٦' : 'April 2026'}</div>
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
            <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 30, lineHeight: 1.1, marginTop: 6, letterSpacing: -0.5 }}>
              {challenge.title[lang]}
            </div>
            <div style={{ fontSize: 13, marginTop: 8, opacity: 0.85, lineHeight: 1.4 }}>{challenge.sub[lang]}</div>
            <div style={{ marginTop: 18, height: 6, borderRadius: 6, background: 'rgba(0,0,0,0.15)', overflow: 'hidden' }}>
              <div style={{ width: `${challenge.progress * 100}%`, height: '100%', background: T.accentInk, borderRadius: 6 }}/>
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, opacity: 0.8 }}>
              <span>{Math.round(challenge.progress * 100)}%</span>
              <span>{challenge.daysLeft} {lang === 'ar' ? 'يوماً متبقياً' : 'days left'}</span>
            </div>
          </div>
          <div style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', gap: 16, fontSize: 12, color: T.textMuted }}>
              <div><span style={{ color: T.text, fontWeight: 700, fontSize: 16 }}>584</span> <span>pts</span></div>
              <div><span style={{ color: T.text, fontWeight: 700, fontSize: 16 }}>14</span> <span>{lang === 'ar' ? 'يوماً' : 'days'}</span></div>
              <div><span style={{ color: T.text, fontWeight: 700, fontSize: 16 }}>3</span> <span>{lang === 'ar' ? 'شارات' : 'badges'}</span></div>
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

function LBPodium({ theme, rows, lang, kind }) {
  const T = theme;
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const order = [1, 0, 2];
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
                {idx === 0 && (
                  <div style={{ position: 'absolute', top: -6, background: T.accent, color: T.accentInk, borderRadius: 999, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>1</div>
                )}
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
            }}>{String(row.rank).padStart(2, '0')}</div>
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
