import { useState, useEffect } from 'react';
import { typeStyles, Icon, Button } from '../design-system.jsx';
import { TopBack } from './onboarding.jsx';

export function ScreenBreathe({ theme, t, dir, go }) {
  const T = theme;
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const PHASE_DUR = 4;
  const TOTAL = 120;

  useEffect(() => {
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

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: 999, border: `1px solid ${T.border}` }}/>
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: 999, border: `1px dashed ${T.border}` }}/>
        <div style={{
          width: 160, height: 160, borderRadius: 999,
          background: `radial-gradient(circle at 30% 30%, ${T.accent}, ${T.accentSoft})`,
          transform: `scale(${scale})`,
          transition: 'transform .8s cubic-bezier(.4,0,.2,1)',
          boxShadow: `0 0 80px ${T.accentSoft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', color: T.accentInk, transform: `scale(${1 / scale})`, transition: 'transform .8s' }}>
            <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 28, letterSpacing: -0.4 }}>
              {running ? phaseLabel : t('startBreathing')}
            </div>
            {running && (
              <div style={{ fontFamily: typeStyles(T).monoFont, fontSize: 14, opacity: 0.7, marginTop: 2 }}>
                {Math.ceil(phaseSecLeft)}
              </div>
            )}
          </div>
        </div>
      </div>

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
          {running ? t('done') : t('startBreathing')}
        </Button>
      </div>
    </div>
  );
}
