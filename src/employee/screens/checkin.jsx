import React from 'react';
import { typeStyles, Icon, Button, Slider, Ring } from '../design-system.jsx';
import { TopBack } from './onboarding.jsx';
import { useCheckin } from '../hooks/use-checkin.js';

// --- screens-checkin.jsx ---
// Check-in — 3 input-style variants: 'sliders', 'emoji', 'cards'

function ScreenCheckIn({ theme, t, dir, go, variant = 'sliders', state }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const { submit } = useCheckin();
  const [step, setStep] = React.useState(0);
  const [vals, setVals] = React.useState({ stress: 5, sleep: 6.5, energy: 5, mood: 6 });
  const [saved, setSaved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const questions = [
    { id: 'stress', label: t('stress'), sub: t('stressSub'), min: 0, max: 10 },
    { id: 'sleep', label: t('sleep'), sub: t('sleepSub'), min: 3, max: 10, step: 0.5, fmt: v => `${v}h` },
    { id: 'energy', label: t('energy'), sub: t('energySub'), min: 0, max: 10 },
    { id: 'mood', label: t('mood'), sub: t('moodSub'), min: 0, max: 10 },
  ];

  const q = questions[step];
  const v = vals[q.id];
  const set = (nv) => setVals({ ...vals, [q.id]: nv });

  const handleNext = async () => {
    if (step < questions.length - 1) {
      setStep(step + 1);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await submit({
        sleep: vals.sleep,
        stress: vals.stress,
        energy: vals.energy,
        mood: vals.mood,
        note: '',
        variant,
      });
      setSaved(true);
      state.setStreak(state.streak + (state.streak % 1 === 0 ? 0 : 1));
      setTimeout(() => { go('home'); setSaved(false); setStep(0); }, 1800);
    } catch (e) {
      setErr(e?.message || 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <div style={{ height: '100%', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center' }}>
        <Ring theme={T} value={1} size={96} stroke={6}>
          <Icon name="check" size={40} stroke={T.accent}/>
        </Ring>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 30, color: T.text, marginTop: 26, letterSpacing: -0.5 }}>{t('checkInDone')}</div>
        <div style={{ color: T.textMuted, fontSize: 15, marginTop: 10, maxWidth: 280 }}>{t('checkInDoneSub')}</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', background: T.bg, paddingTop: 54, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ padding: '14px 22px 0', display: 'flex', alignItems: 'center', gap: 14 }}>
        <TopBack theme={T} onBack={() => step > 0 ? setStep(step - 1) : go('home')} dir={dir}/>
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          {questions.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= step ? T.accent : T.track, transition: 'background .3s',
            }}/>
          ))}
        </div>
      </div>

      <div style={{ padding: '32px 22px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: T.textMuted, fontWeight: 600 }}>
          {t('checkInTitle')}
        </div>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 36, color: T.text, marginTop: 6, marginBottom: 4, letterSpacing: -0.5, lineHeight: 1.1 }}>
          {q.label}
        </div>
        <div style={{ color: T.textMuted, fontSize: 14, marginBottom: 30 }}>{q.sub}</div>

        {variant === 'sliders' && <VarSliders theme={T} q={q} v={v} set={set}/>}
        {variant === 'emoji' && <VarEmoji theme={T} q={q} v={v} set={set} lang={lang}/>}
        {variant === 'cards' && <VarCards theme={T} q={q} v={v} set={set} lang={lang}/>}

        <div style={{ flex: 1 }}/>
        <div style={{ paddingBottom: 22 }}>
          {err && (
            <div style={{
              fontSize: 13, color: T.negative || '#c0392b',
              padding: '10px 14px', marginBottom: 10,
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
            }}>{err}</div>
          )}
          <Button theme={T} onClick={handleNext} iconR="arrow" disabled={busy} style={{ width: '100%', opacity: busy ? 0.6 : 1 }}>
            {step < questions.length - 1 ? t('next') : (busy ? (lang === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : t('saveCheckIn'))}
          </Button>
        </div>
      </div>
    </div>
  );
}

function VarSliders({ theme, q, v, set }) {
  const T = theme;
  return (
    <>
      <div style={{ textAlign: 'center', padding: '30px 0 10px' }}>
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 96, color: T.text,
          lineHeight: 1, letterSpacing: -3, fontWeight: 400,
        }}>
          {q.fmt ? q.fmt(v) : v}
          {!q.fmt && <span style={{ color: T.textFaint, fontSize: 32 }}> / {q.max}</span>}
        </div>
      </div>
      <div style={{ padding: '30px 0 0' }}>
        <Slider theme={T} value={v} onChange={set} min={q.min} max={q.max} step={q.step || 1}
          labels={(q.sub.includes('→') ? q.sub.split('→').map(s=>s.trim()) : null)}/>
      </div>
    </>
  );
}

function VarEmoji({ theme, q, v, set, lang }) {
  const T = theme;
  // 5-point emoji scale mapped to q.min..q.max
  const emojis = q.id === 'stress'
    ? ['😌','🙂','😐','😟','😣']
    : q.id === 'sleep'
    ? ['😴','🙂','😐','😑','🥱']
    : q.id === 'energy'
    ? ['🥱','😐','🙂','😊','⚡️']
    : ['😞','😐','🙂','😊','😁'];
  const mapIn = (val) => Math.round(((val - q.min) / (q.max - q.min)) * 4);
  const mapOut = (i) => q.min + (i / 4) * (q.max - q.min);
  const active = mapIn(v);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
      <div style={{
        width: 180, height: 180, borderRadius: 999, background: T.surface,
        border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 92, marginBottom: 28, boxShadow: `0 0 0 8px ${T.accentSoft}`,
      }}>{emojis[active]}</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {emojis.map((e, i) => (
          <button key={i} onClick={() => set(mapOut(i))} style={{
            width: 54, height: 54, borderRadius: 16,
            background: i === active ? T.accent : T.surface,
            border: `1px solid ${i === active ? 'transparent' : T.border}`,
            fontSize: 28, cursor: 'pointer',
            transition: 'all .15s',
          }}>{e}</button>
        ))}
      </div>
    </div>
  );
}

function VarCards({ theme, q, v, set, lang }) {
  const T = theme;
  // 4-level card scale
  const scales = {
    stress: [
      { label: { en: 'Calm', ar: 'هادئ' }, val: 2, icon: 'leaf' },
      { label: { en: 'Mild', ar: 'خفيف' }, val: 4, icon: 'wind' },
      { label: { en: 'Tense', ar: 'متوتر' }, val: 7, icon: 'bolt' },
      { label: { en: 'Overwhelmed', ar: 'مرهق' }, val: 9, icon: 'flame' },
    ],
    sleep: [
      { label: { en: '< 5 h', ar: '< 5 س' }, val: 4.5, icon: 'moon' },
      { label: { en: '5–6 h', ar: '5–6 س' }, val: 5.5, icon: 'moon' },
      { label: { en: '7–8 h', ar: '7–8 س' }, val: 7.5, icon: 'moon' },
      { label: { en: '> 8 h', ar: '> 8 س' }, val: 9, icon: 'moon' },
    ],
    energy: [
      { label: { en: 'Flat', ar: 'خامل' }, val: 1, icon: 'moon' },
      { label: { en: 'Okay', ar: 'مقبول' }, val: 4, icon: 'smile' },
      { label: { en: 'Good', ar: 'جيد' }, val: 7, icon: 'sparkle' },
      { label: { en: 'Energised', ar: 'نشيط' }, val: 9, icon: 'bolt' },
    ],
    mood: [
      { label: { en: 'Low', ar: 'منخفض' }, val: 1, icon: 'moon' },
      { label: { en: 'Meh', ar: 'متوسط' }, val: 4, icon: 'smile' },
      { label: { en: 'Good', ar: 'جيد' }, val: 7, icon: 'smile' },
      { label: { en: 'Bright', ar: 'مشرق' }, val: 9, icon: 'sparkle' },
    ],
  };
  const opts = scales[q.id];
  const activeIdx = opts.reduce((best, o, i) => Math.abs(o.val - v) < Math.abs(opts[best].val - v) ? i : best, 0);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 10 }}>
      {opts.map((o, i) => {
        const active = i === activeIdx;
        return (
          <button key={i} onClick={() => set(o.val)} style={{
            padding: 20, background: active ? T.accent : T.surface,
            border: `1px solid ${active ? 'transparent' : T.border}`,
            color: active ? T.accentInk : T.text,
            borderRadius: 18, cursor: 'pointer', textAlign: 'left',
            display: 'flex', flexDirection: 'column', gap: 14, minHeight: 110,
            transition: 'all .2s',
          }}>
            <Icon name={o.icon} size={22}/>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: typeStyles(T).sansFont }}>{o.label[lang]}</div>
          </button>
        );
      })}
    </div>
  );
}

export { ScreenCheckIn };
