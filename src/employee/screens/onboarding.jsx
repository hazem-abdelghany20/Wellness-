import React from 'react';
import {
  typeStyles, Icon, AvatarDisplay, AVATAR_OPTIONS, Button, Card,
  WellnessMark, Ring, Slider,
} from '../design-system.jsx';

// --- screens-onboarding.jsx ---
// Onboarding flow: code → OTP → consent → baseline → goals → welcome

function ScreenJoin({ theme, t, onNext, dir }) {
  const [code, setCode] = React.useState('WH-4782');
  const T = theme;
  return (
    <ScreenFrame theme={T}>
      <div style={{ padding: '30px 22px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <WellnessMark theme={T} size={26} />
        <div style={{ flex: 1 }} />
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 38, lineHeight: 1.05,
          color: T.text, fontWeight: 400, letterSpacing: -0.8, marginBottom: 14,
        }}>{t('joinTitle')}</div>
        <div style={{
          fontFamily: typeStyles(T).sansFont, fontSize: 15, lineHeight: 1.45,
          color: T.textMuted, marginBottom: 30,
        }}>{t('joinSubtitle')}</div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: T.textMuted, marginBottom: 8, fontWeight: 600 }}>{t('companyCode')}</div>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            style={{
              width: '100%', height: 58, padding: '0 18px',
              background: T.surface, border: `1px solid ${T.borderStrong}`,
              borderRadius: 14, color: T.text, fontSize: 22, fontWeight: 600,
              letterSpacing: 2, fontFamily: typeStyles(T).monoFont, boxSizing: 'border-box',
              textAlign: dir === 'rtl' ? 'right' : 'left',
            }}/>
        </div>

        <Button theme={T} onClick={onNext} iconR="arrow">{t('continue')}</Button>
        <button onClick={onNext} style={{
          marginTop: 14, background: 'transparent', border: 'none',
          color: T.textMuted, fontFamily: typeStyles(T).sansFont, fontSize: 14,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          height: 44, cursor: 'pointer',
        }}>
          <Icon name="qr" size={18}/>{t('scanQR')}
        </button>
        <div style={{ flex: 0.6 }} />
      </div>
    </ScreenFrame>
  );
}

function ScreenOTP({ theme, t, onNext, onBack, dir }) {
  const T = theme;
  const [digits, setDigits] = React.useState(['4','7','2','0','','']);
  const refs = React.useRef([]);
  const allFilled = digits.every(d => d !== '');
  const setDigit = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const nd = [...digits]; nd[i] = v; setDigits(nd);
    if (v && i < 5) refs.current[i+1]?.focus();
  };
  React.useEffect(() => {
    if (allFilled) { const tm = setTimeout(onNext, 400); return () => clearTimeout(tm); }
  }, [allFilled]);
  return (
    <ScreenFrame theme={T}>
      <div style={{ padding: '30px 22px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBack theme={T} onBack={onBack} dir={dir} />
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 34, lineHeight: 1.1,
          color: T.text, fontWeight: 400, letterSpacing: -0.6, marginTop: 28, marginBottom: 12,
        }}>{t('verifyTitle')}</div>
        <div style={{ color: T.textMuted, fontSize: 15, lineHeight: 1.45, marginBottom: 30 }}>
          {t('verifySub', { dest: 'a.mostafa@nilegroup.eg' })}
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 26, direction: 'ltr' }}>
          {digits.map((d, i) => (
            <input key={i} ref={el => refs.current[i] = el}
              value={d} onChange={e => setDigit(i, e.target.value)}
              inputMode="numeric" maxLength={1}
              style={{
                flex: 1, height: 62, background: T.surface, border: `1px solid ${d ? T.accent : T.borderStrong}`,
                borderRadius: 14, color: T.text, fontSize: 26, fontWeight: 600,
                textAlign: 'center', fontFamily: typeStyles(T).sansFont,
                outline: 'none', transition: 'border .2s',
              }}/>
          ))}
        </div>
        <button style={{
          alignSelf: dir === 'rtl' ? 'flex-end' : 'flex-start',
          background: 'transparent', border: 'none', color: T.accent,
          fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0,
          fontFamily: typeStyles(T).sansFont,
        }}>{t('resend')}</button>
        <div style={{ flex: 1 }}/>
      </div>
    </ScreenFrame>
  );
}

function ScreenConsent({ theme, t, onNext, onBack, dir }) {
  const T = theme;
  const items = [
    { icon: 'shield', text: t('consentBullet1') },
    { icon: 'lock',   text: t('consentBullet2') },
    { icon: 'user',   text: t('consentBullet3') },
  ];
  return (
    <ScreenFrame theme={T}>
      <div style={{ padding: '30px 22px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBack theme={T} onBack={onBack} dir={dir} />
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 34, lineHeight: 1.1,
          color: T.text, fontWeight: 400, letterSpacing: -0.6, marginTop: 28, marginBottom: 20,
        }}>{t('consentTitle')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {items.map((it, i) => (
            <Card key={i} theme={T} pad={16} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: T.accentSoft, color: T.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Icon name={it.icon} size={20}/></div>
              <div style={{ color: T.text, fontSize: 15, lineHeight: 1.5, flex: 1 }}>{it.text}</div>
            </Card>
          ))}
        </div>
        <div style={{ flex: 1 }}/>
        <Button theme={T} onClick={onNext}>{t('iAgree')}</Button>
      </div>
    </ScreenFrame>
  );
}

function ScreenBaseline({ theme, t, onNext, onBack, dir }) {
  const T = theme;
  const questions = [
    { id: 'stress',  label: t('stress'),  labels: [t('stressSub').split('→')[0].trim(), t('stressSub').split('→')[1].trim()] },
    { id: 'sleep',   label: t('sleep'),   labels: [t('sleepSub'), ''] , min: 3, max: 10, step: 0.5, fmt: (v)=>`${v}h` },
    { id: 'energy',  label: t('energy'),  labels: [t('energySub').split('→')[0].trim(), t('energySub').split('→')[1].trim()] },
    { id: 'mood',    label: t('mood'),    labels: [t('moodSub').split('→')[0].trim(), t('moodSub').split('→')[1].trim()] },
  ];
  const [idx, setIdx] = React.useState(0);
  const [vals, setVals] = React.useState({ stress: 5, sleep: 6.5, energy: 5, mood: 6 });
  const q = questions[idx];
  const v = vals[q.id];
  return (
    <ScreenFrame theme={T}>
      <div style={{ padding: '30px 22px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBack theme={T} onBack={idx === 0 ? onBack : () => setIdx(idx - 1)} dir={dir} />
        <div style={{ marginTop: 22, display: 'flex', gap: 5 }}>
          {questions.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= idx ? T.accent : T.track,
              transition: 'background .3s',
            }}/>
          ))}
        </div>
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 32, lineHeight: 1.1,
          color: T.text, fontWeight: 400, letterSpacing: -0.5, marginTop: 30, marginBottom: 8,
        }}>{t('baselineTitle')}</div>
        <div style={{ color: T.textMuted, fontSize: 14, marginBottom: 36 }}>{t('baselineSub')}</div>

        <Card theme={T} pad={22} radius={22}>
          <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: T.textMuted, fontWeight: 600, marginBottom: 6 }}>
            {q.label}
          </div>
          <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 56, lineHeight: 1, color: T.text, marginBottom: 26, letterSpacing: -1 }}>
            {q.fmt ? q.fmt(v) : v}<span style={{ color: T.textFaint, fontSize: 22 }}>{q.fmt ? '' : ` / ${q.max || 10}`}</span>
          </div>
          <Slider theme={T} value={v}
            onChange={(nv) => setVals({ ...vals, [q.id]: nv })}
            min={q.min || 0} max={q.max || 10} step={q.step || 1}
            labels={q.labels}/>
        </Card>

        <div style={{ flex: 1 }}/>
        <Button theme={T} onClick={() => idx < questions.length - 1 ? setIdx(idx + 1) : onNext()} iconR="arrow">
          {idx < questions.length - 1 ? t('next') : t('continue')}
        </Button>
      </div>
    </ScreenFrame>
  );
}

function ScreenGoals({ theme, t, onNext, onBack, dir }) {
  const T = theme;
  const goals = [
    { id: 'sleep',     icon: 'moon',     label: { en: 'Better sleep', ar: 'نوم أفضل' } },
    { id: 'stress',    icon: 'leaf',     label: { en: 'Manage stress', ar: 'إدارة التوتر' } },
    { id: 'energy',    icon: 'bolt',     label: { en: 'More energy', ar: 'طاقة أكثر' } },
    { id: 'pain',      icon: 'activity', label: { en: 'Reduce pain', ar: 'تقليل الألم' } },
    { id: 'focus',     icon: 'target',   label: { en: 'Focus', ar: 'التركيز' } },
    { id: 'move',      icon: 'wind',     label: { en: 'Move more', ar: 'الحركة أكثر' } },
  ];
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const [sel, setSel] = React.useState(new Set(['stress', 'sleep']));
  const toggle = (id) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else if (n.size < 3) n.add(id);
    setSel(n);
  };
  return (
    <ScreenFrame theme={T}>
      <div style={{ padding: '30px 22px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBack theme={T} onBack={onBack} dir={dir} />
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 32, lineHeight: 1.1,
          color: T.text, fontWeight: 400, letterSpacing: -0.5, marginTop: 28, marginBottom: 8,
        }}>{t('goalsTitle')}</div>
        <div style={{ color: T.textMuted, fontSize: 14, marginBottom: 22 }}>{t('goalsSub')}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {goals.map(g => {
            const active = sel.has(g.id);
            return (
              <button key={g.id} onClick={() => toggle(g.id)} style={{
                padding: '18px 14px', background: active ? T.accent : T.surface,
                border: `1px solid ${active ? 'transparent' : T.border}`,
                borderRadius: 18, textAlign: dir === 'rtl' ? 'right' : 'left',
                color: active ? T.accentInk : T.text, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 10, minHeight: 96,
                transition: 'all .2s',
              }}>
                <Icon name={g.icon} size={22}/>
                <div style={{ fontSize: 15, fontWeight: 600, fontFamily: typeStyles(T).sansFont }}>{g.label[lang]}</div>
              </button>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 14, color: T.textMuted, fontSize: 12 }}>
          {sel.size} / 3
        </div>
        <div style={{ flex: 1 }}/>
        <Button theme={T} onClick={onNext} disabled={sel.size === 0}>{t('finish')}</Button>
      </div>
    </ScreenFrame>
  );
}

function ScreenWelcome({ theme, t, state, onNext, dir }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const name = state && state.name ? state.name.split(' ')[0] : '';
  return (
    <ScreenFrame theme={T}>
      <div style={{ padding: '30px 22px 14px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <Ring theme={T} value={1} size={100} stroke={6}>
          <Icon name="check" size={44} stroke={T.accent}/>
        </Ring>
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 38, lineHeight: 1.05,
          color: T.text, fontWeight: 400, letterSpacing: -0.8, marginTop: 30, marginBottom: 12,
        }}>{name ? (lang==='ar'?`أهلاً، ${name}`:`Welcome, ${name}`) : t('welcome')}</div>
        <div style={{ color: T.textMuted, fontSize: 16, marginBottom: 40, maxWidth: 280 }}>{t('welcomeSub')}</div>
        <Button theme={T} onClick={onNext} iconR="arrow">{t('startApp')}</Button>
      </div>
    </ScreenFrame>
  );
}

// Shared
function ScreenFrame({ theme, children }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: theme.bg,
      display: 'flex', flexDirection: 'column',
      paddingTop: 54, // status bar space
      boxSizing: 'border-box',
    }}>{children}</div>
  );
}
function TopBack({ theme, onBack, dir }) {
  return (
    <button onClick={onBack} style={{
      width: 40, height: 40, borderRadius: 999,
      background: theme.chipBg, border: `1px solid ${theme.border}`,
      color: theme.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', marginTop: 6,
      transform: dir === 'rtl' ? 'scaleX(-1)' : 'none',
    }}>
      <Icon name="arrowL" size={20}/>
    </button>
  );
}

Object.assign(window, {
  ScreenJoin, ScreenOTP, ScreenConsent, ScreenName, ScreenBaseline, ScreenGoals, ScreenWelcome,
  ScreenFrame, TopBack,
});

function ScreenName({ theme, t, dir, state, onNext, onBack }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const [val, setVal] = React.useState(state.name || '');
  const [avatar, setAvatar] = React.useState(state.avatar || 'monogram');
  const options = AVATAR_OPTIONS;
  const canContinue = val.trim().length >= 2;
  const submit = () => {
    state.setName(val.trim());
    state.setAvatar(avatar);
    onNext();
  };
  return (
    <ScreenFrame theme={T}>
      <div style={{ padding: '30px 22px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBack theme={T} onBack={onBack} dir={dir} />
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 34, lineHeight: 1.1,
          color: T.text, fontWeight: 400, letterSpacing: -0.6, marginTop: 28, marginBottom: 10,
        }}>{lang==='ar'?'كيف ننادي عليك؟':"What should we call you?"}</div>
        <div style={{ color: T.textMuted, fontSize: 14, lineHeight: 1.5, marginBottom: 26 }}>
          {lang==='ar'?'اسمك يظهر فقط لك. فريقك يراك كـ "عضو مجهول" في لوحة المتصدرين.':'Your name is only visible to you. On leaderboards, your team sees "Anonymous member".'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <AvatarDisplay theme={T} kind={avatar} name={val || '?'} size={96}/>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: T.textMuted, marginBottom: 8, fontWeight: 600 }}>{lang==='ar'?'الاسم':'Name'}</div>
          <input value={val} onChange={e => setVal(e.target.value)} placeholder={lang==='ar'?'اكتب اسمك':'Your name'}
            style={{
              width: '100%', height: 54, padding: '0 16px',
              background: T.surface, border: `1px solid ${T.borderStrong}`,
              borderRadius: 14, color: T.text, fontSize: 17, fontWeight: 500,
              fontFamily: typeStyles(T).sansFont, boxSizing: 'border-box', outline: 'none',
              textAlign: dir === 'rtl' ? 'right' : 'left',
            }}/>
        </div>

        <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: T.textMuted, marginBottom: 10, fontWeight: 600 }}>{lang==='ar'?'الصورة الرمزية':'Avatar'}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {options.map(opt => (
            <button key={opt} onClick={() => setAvatar(opt)} style={{
              padding: 0, border: `2px solid ${avatar === opt ? T.accent : 'transparent'}`,
              borderRadius: 999, background: 'transparent', cursor: 'pointer',
            }}>
              <AvatarDisplay theme={T} kind={opt} name={val || '?'} size={48}/>
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }}/>
        <Button theme={T} onClick={submit} disabled={!canContinue} iconR="arrow">{t('continue')}</Button>
      </div>
    </ScreenFrame>
  );
}

Object.assign(window, { ScreenName });

export {
  ScreenJoin, ScreenOTP, ScreenConsent, ScreenBaseline, ScreenGoals,
  ScreenWelcome, ScreenName, ScreenFrame, TopBack,
};
