import React from 'react';
import {
  typeStyles, Icon, AvatarDisplay, AVATAR_OPTIONS, Button, Card,
  WellnessMark, Ring, Slider,
} from '../design-system.jsx';
import { useAuth } from '../state/auth-context.jsx';
import { useProfile } from '../hooks/use-profile.js';

// --- screens-onboarding.jsx ---
// Onboarding flow: code → OTP → consent → baseline → goals → welcome

function ScreenJoin({ theme, t, onNext, dir }) {
  const [code, setCode] = React.useState('WH-4782');
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const { signInWithCode } = useAuth();
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';

  const handleSubmit = async () => {
    if (!email.trim()) {
      setErr(lang === 'ar' ? 'البريد الإلكتروني مطلوب' : 'Email is required');
      return;
    }
    setErr(null); setBusy(true);
    try {
      await signInWithCode(code, email.trim());
      onNext();
    } catch (e) {
      setErr(e?.message || (lang === 'ar' ? 'فشل تسجيل الدخول' : 'Sign-in failed'));
    } finally {
      setBusy(false);
    }
  };

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
            disabled={busy}
            style={{
              width: '100%', height: 58, padding: '0 18px',
              background: T.surface, border: `1px solid ${T.borderStrong}`,
              borderRadius: 14, color: T.text, fontSize: 22, fontWeight: 600,
              letterSpacing: 2, fontFamily: typeStyles(T).monoFont, boxSizing: 'border-box',
              textAlign: dir === 'rtl' ? 'right' : 'left',
            }}/>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: T.textMuted, marginBottom: 8, fontWeight: 600 }}>{lang === 'ar' ? 'البريد الإلكتروني' : 'Work email'}</div>
          <input value={email} onChange={e => setEmail(e.target.value)}
            type="email" inputMode="email" autoComplete="email"
            placeholder={lang === 'ar' ? 'name@company.com' : 'name@company.com'}
            disabled={busy}
            style={{
              width: '100%', height: 54, padding: '0 16px',
              background: T.surface, border: `1px solid ${T.borderStrong}`,
              borderRadius: 14, color: T.text, fontSize: 17, fontWeight: 500,
              fontFamily: typeStyles(T).sansFont, boxSizing: 'border-box', outline: 'none',
              textAlign: dir === 'rtl' ? 'right' : 'left',
            }}/>
        </div>

        {err && (
          <div style={{
            color: '#c0392b', background: 'rgba(192,57,43,0.08)',
            padding: '10px 12px', borderRadius: 10, fontSize: 13,
            marginBottom: 12, fontFamily: typeStyles(T).sansFont,
          }}>{err}</div>
        )}

        <Button theme={T} onClick={handleSubmit} iconR="arrow" disabled={busy}>
          {busy ? (lang === 'ar' ? 'جارٍ…' : 'Working…') : t('continue')}
        </Button>
        <button onClick={() => !busy && handleSubmit()} disabled={busy} style={{
          marginTop: 14, background: 'transparent', border: 'none',
          color: T.textMuted, fontFamily: typeStyles(T).sansFont, fontSize: 14,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          height: 44, cursor: busy ? 'default' : 'pointer',
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
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const [digits, setDigits] = React.useState(['', '', '', '', '', '']);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const refs = React.useRef([]);
  const { verifyOtp, pendingEmail } = useAuth();
  const allFilled = digits.every(d => d !== '');

  const setDigit = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const nd = [...digits]; nd[i] = v; setDigits(nd);
    if (v && i < 5) refs.current[i+1]?.focus();
  };

  const handleVerify = React.useCallback(async (token) => {
    setErr(null); setBusy(true);
    try {
      await verifyOtp(token);
      onNext();
    } catch (e) {
      setErr(e?.message || (lang === 'ar' ? 'رمز غير صالح' : 'Invalid code'));
      setDigits(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }, [verifyOtp, onNext, lang]);

  React.useEffect(() => {
    if (allFilled && !busy) {
      const token = digits.join('');
      const tm = setTimeout(() => handleVerify(token), 200);
      return () => clearTimeout(tm);
    }
  }, [allFilled, busy, digits, handleVerify]);

  return (
    <ScreenFrame theme={T}>
      <div style={{ padding: '30px 22px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBack theme={T} onBack={onBack} dir={dir} />
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 34, lineHeight: 1.1,
          color: T.text, fontWeight: 400, letterSpacing: -0.6, marginTop: 28, marginBottom: 12,
        }}>{t('verifyTitle')}</div>
        <div style={{ color: T.textMuted, fontSize: 15, lineHeight: 1.45, marginBottom: 30 }}>
          {t('verifySub', { dest: pendingEmail || 'a.mostafa@nilegroup.eg' })}
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, direction: 'ltr' }}>
          {digits.map((d, i) => (
            <input key={i} ref={el => refs.current[i] = el}
              value={d} onChange={e => setDigit(i, e.target.value)}
              inputMode="numeric" maxLength={1} disabled={busy}
              style={{
                flex: 1, height: 62, background: T.surface, border: `1px solid ${d ? T.accent : T.borderStrong}`,
                borderRadius: 14, color: T.text, fontSize: 26, fontWeight: 600,
                textAlign: 'center', fontFamily: typeStyles(T).sansFont,
                outline: 'none', transition: 'border .2s',
                opacity: busy ? 0.6 : 1,
              }}/>
          ))}
        </div>
        {err && (
          <div style={{
            color: '#c0392b', background: 'rgba(192,57,43,0.08)',
            padding: '10px 12px', borderRadius: 10, fontSize: 13,
            marginBottom: 12, fontFamily: typeStyles(T).sansFont,
          }}>{err}</div>
        )}
        <button disabled={busy} style={{
          alignSelf: dir === 'rtl' ? 'flex-end' : 'flex-start',
          background: 'transparent', border: 'none', color: T.accent,
          fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer', padding: 0,
          fontFamily: typeStyles(T).sansFont, opacity: busy ? 0.5 : 1,
        }}>{t('resend')}</button>
        <div style={{ flex: 1 }}/>
      </div>
    </ScreenFrame>
  );
}

function ScreenConsent({ theme, t, onNext, onBack, dir }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const { update } = useProfile();
  const items = [
    { icon: 'shield', text: t('consentBullet1') },
    { icon: 'lock',   text: t('consentBullet2') },
    { icon: 'user',   text: t('consentBullet3') },
  ];
  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      await update({ consent_at: new Date().toISOString() });
      onNext();
    } catch (e) {
      setErr(e?.message || (lang === 'ar' ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setBusy(false);
    }
  };
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
        {err && (
          <div style={{
            color: '#c0392b', background: 'rgba(192,57,43,0.08)',
            padding: '10px 12px', borderRadius: 10, fontSize: 13,
            marginBottom: 12, fontFamily: typeStyles(T).sansFont,
          }}>{err}</div>
        )}
        <div style={{ flex: 1 }}/>
        <Button theme={T} onClick={submit} disabled={busy}>
          {busy ? (lang === 'ar' ? 'جارٍ…' : 'Saving…') : t('iAgree')}
        </Button>
      </div>
    </ScreenFrame>
  );
}

function ScreenBaseline({ theme, t, onNext, onBack, dir }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const questions = [
    { id: 'stress',  label: t('stress'),  labels: [t('stressSub').split('→')[0].trim(), t('stressSub').split('→')[1].trim()] },
    { id: 'sleep',   label: t('sleep'),   labels: [t('sleepSub'), ''] , min: 3, max: 10, step: 0.5, fmt: (v)=>`${v}h` },
    { id: 'energy',  label: t('energy'),  labels: [t('energySub').split('→')[0].trim(), t('energySub').split('→')[1].trim()] },
    { id: 'mood',    label: t('mood'),    labels: [t('moodSub').split('→')[0].trim(), t('moodSub').split('→')[1].trim()] },
  ];
  const [idx, setIdx] = React.useState(0);
  const [vals, setVals] = React.useState({ stress: 5, sleep: 6.5, energy: 5, mood: 6 });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const { update } = useProfile();
  const q = questions[idx];
  const v = vals[q.id];

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      await update({
        baseline_sleep: vals.sleep,
        baseline_stress: vals.stress,
        baseline_energy: vals.energy,
        baseline_mood: vals.mood,
      });
      onNext();
    } catch (e) {
      setErr(e?.message || (lang === 'ar' ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setBusy(false);
    }
  };

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

        {err && (
          <div style={{
            color: '#c0392b', background: 'rgba(192,57,43,0.08)',
            padding: '10px 12px', borderRadius: 10, fontSize: 13,
            marginTop: 12, fontFamily: typeStyles(T).sansFont,
          }}>{err}</div>
        )}

        <div style={{ flex: 1 }}/>
        <Button theme={T}
          onClick={() => idx < questions.length - 1 ? setIdx(idx + 1) : submit()}
          disabled={busy} iconR="arrow">
          {busy ? (lang === 'ar' ? 'جارٍ…' : 'Saving…')
            : idx < questions.length - 1 ? t('next') : t('continue')}
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
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const { update } = useProfile();
  const toggle = (id) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else if (n.size < 3) n.add(id);
    setSel(n);
  };
  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      await update({ goals: Array.from(sel) });
      onNext();
    } catch (e) {
      setErr(e?.message || (lang === 'ar' ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setBusy(false);
    }
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
        {err && (
          <div style={{
            color: '#c0392b', background: 'rgba(192,57,43,0.08)',
            padding: '10px 12px', borderRadius: 10, fontSize: 13,
            marginTop: 10, fontFamily: typeStyles(T).sansFont,
          }}>{err}</div>
        )}
        <div style={{ flex: 1 }}/>
        <Button theme={T} onClick={submit} disabled={sel.size === 0 || busy}>
          {busy ? (lang === 'ar' ? 'جارٍ…' : 'Saving…') : t('finish')}
        </Button>
      </div>
    </ScreenFrame>
  );
}

function ScreenWelcome({ theme, t, state, onNext, dir }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const { profile, update } = useProfile();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const fallbackName = state && state.name ? state.name.split(' ')[0] : '';
  const profileName = profile && profile.display_name ? String(profile.display_name).split(' ')[0] : '';
  const name = profileName || fallbackName;
  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      await update({ onboarded_at: new Date().toISOString() });
      onNext();
    } catch (e) {
      setErr(e?.message || (lang === 'ar' ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setBusy(false);
    }
  };
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
        {err && (
          <div style={{
            color: '#c0392b', background: 'rgba(192,57,43,0.08)',
            padding: '10px 12px', borderRadius: 10, fontSize: 13,
            marginBottom: 12, fontFamily: typeStyles(T).sansFont,
          }}>{err}</div>
        )}
        <Button theme={T} onClick={submit} disabled={busy} iconR="arrow">
          {busy ? (lang === 'ar' ? 'جارٍ…' : 'Saving…') : t('startApp')}
        </Button>
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
  const [val, setVal] = React.useState((state && state.name) || '');
  const [avatar, setAvatar] = React.useState((state && state.avatar) || 'monogram');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const { update } = useProfile();
  const options = AVATAR_OPTIONS;
  const canContinue = val.trim().length >= 2 && !busy;
  const submit = async () => {
    const trimmed = val.trim();
    setErr(null); setBusy(true);
    try {
      await update({ display_name: trimmed, avatar_kind: avatar });
      if (state) {
        state.setName && state.setName(trimmed);
        state.setAvatar && state.setAvatar(avatar);
      }
      onNext();
    } catch (e) {
      setErr(e?.message || (lang === 'ar' ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setBusy(false);
    }
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

        {err && (
          <div style={{
            color: '#c0392b', background: 'rgba(192,57,43,0.08)',
            padding: '10px 12px', borderRadius: 10, fontSize: 13,
            marginTop: 6, fontFamily: typeStyles(T).sansFont,
          }}>{err}</div>
        )}
        <div style={{ flex: 1 }}/>
        <Button theme={T} onClick={submit} disabled={!canContinue} iconR="arrow">
          {busy ? (lang === 'ar' ? 'جارٍ…' : 'Saving…') : t('continue')}
        </Button>
      </div>
    </ScreenFrame>
  );
}

Object.assign(window, { ScreenName });

export {
  ScreenJoin, ScreenOTP, ScreenConsent, ScreenBaseline, ScreenGoals,
  ScreenWelcome, ScreenName, ScreenFrame, TopBack,
};
