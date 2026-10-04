import React from 'react';
import {
  typeStyles, Icon, AvatarDisplay, AVATAR_OPTIONS, Button, Card,
  WellnessMark, Ring, Slider,
} from '../design-system.jsx';
import { useAuth } from '../state/auth-context.jsx';
import { useProfile } from '../hooks/use-profile.js';

// --- screens-onboarding.jsx ---
// Onboarding flow: code → consent → name → welcome

function ScreenJoin({ theme, t, onNext, dir }) {
  const [code, setCode] = React.useState('WH-4782');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
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
    if (password.length < 6) {
      setErr(lang === 'ar' ? 'كلمة المرور ٦ أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }
    setErr(null); setBusy(true);
    try {
      await signInWithCode(code, email.trim(), password);
      // Auth-driven routing in App.jsx will redirect to the next onboarding
      // step (or home) once the session lands; onNext is now a no-op.
      onNext?.();
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

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: T.textMuted, marginBottom: 8, fontWeight: 600 }}>{lang === 'ar' ? 'كلمة المرور' : 'Password'}</div>
          <input value={password} onChange={e => setPassword(e.target.value)}
            type="password" autoComplete="current-password"
            placeholder={lang === 'ar' ? '٦ أحرف على الأقل' : 'At least 6 characters'}
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
        {/* "Scan QR instead" was a duplicate of Continue (no QR scanner
            exists). Dropped in the Phase 3 sweep — onboarding via QR is
            a future feature that needs its own screen. */}
        <div style={{ flex: 0.6 }} />
      </div>
    </ScreenFrame>
  );
}

function ScreenOTP({ theme, t, onNext, onBack, dir }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const maxCodeLength = 8;
  const minCodeLength = 6;
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const inputRef = React.useRef(null);
  const { verifyOtp, pendingEmail } = useAuth();
  const digits = React.useMemo(() => {
    const chars = code.split('');
    return Array.from({ length: maxCodeLength }, (_, i) => chars[i] || '');
  }, [code]);
  const canVerify = code.length >= minCodeLength;

  const setCodeFromInput = (value) => {
    const next = value.replace(/\D/g, '').slice(0, maxCodeLength);
    setCode(next);
  };

  const handleVerify = React.useCallback(async () => {
    if (!canVerify || busy) return;
    setErr(null); setBusy(true);
    try {
      await verifyOtp(code);
      onNext();
    } catch (e) {
      setErr(e?.message || (lang === 'ar' ? 'رمز غير صالح' : 'Invalid code'));
      setCode('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }, [canVerify, busy, verifyOtp, code, onNext, lang]);

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
        <div
          onClick={() => inputRef.current?.focus()}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${maxCodeLength}, minmax(0, 1fr))`,
            gap: 6,
            marginBottom: 14,
            direction: 'ltr',
            position: 'relative',
          }}
        >
          <input
            ref={inputRef}
            value={code}
            onChange={e => setCodeFromInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleVerify();
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={maxCodeLength}
            disabled={busy}
            aria-label={lang === 'ar' ? 'رمز التحقق' : 'Verification code'}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              border: 0,
              width: '100%',
              height: '100%',
              cursor: busy ? 'default' : 'text',
            }}
          />
          {digits.map((d, i) => (
            <div key={i} style={{
              minWidth: 0,
              height: 52,
              background: T.surface,
              border: `1px solid ${d ? T.accent : T.borderStrong}`,
              borderRadius: 12,
              color: T.text,
              fontSize: 22,
              fontWeight: 600,
              textAlign: 'center',
              fontFamily: typeStyles(T).sansFont,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'border .2s',
              opacity: busy ? 0.6 : 1,
              boxSizing: 'border-box',
            }}>{d}</div>
          ))}
        </div>
        {err && (
          <div style={{
            color: '#c0392b', background: 'rgba(192,57,43,0.08)',
            padding: '10px 12px', borderRadius: 10, fontSize: 13,
            marginBottom: 12, fontFamily: typeStyles(T).sansFont,
          }}>{err}</div>
        )}
        <Button theme={T} onClick={handleVerify} disabled={busy || !canVerify}>
          {busy ? (lang === 'ar' ? 'جارٍ…' : 'Verifying…') : t('continue')}
        </Button>
        <button disabled={busy} style={{
          alignSelf: dir === 'rtl' ? 'flex-end' : 'flex-start',
          background: 'transparent', border: 'none', color: T.accent,
          fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer', padding: 0,
          marginTop: 16, fontFamily: typeStyles(T).sansFont, opacity: busy ? 0.5 : 1,
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
      await update({ consented_at: new Date().toISOString() });
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
      await update({ onboarded: true });
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
      paddingTop: 'var(--wp-top)', // status bar space
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

function ScreenName({ theme, t, dir, state, onNext, onBack }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const [val, setVal] = React.useState((state && state.name) || '');
  const [valAr, setValAr] = React.useState('');
  const [avatar, setAvatar] = React.useState((state && state.avatar) || 'monogram');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const { update } = useProfile();
  const options = AVATAR_OPTIONS;
  const canContinue = val.trim().length >= 2 && !busy;
  const submit = async () => {
    const trimmed = val.trim();
    const trimmedAr = valAr.trim();
    setErr(null); setBusy(true);
    try {
      await update({
        display_name: trimmed,
        display_name_ar: trimmedAr || null,
        avatar_kind: avatar,
      });
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

        <div style={{ marginBottom: 14 }}>
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

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: T.textMuted, marginBottom: 8, fontWeight: 600 }}>
            {lang==='ar'?'الاسم بالعربية (اختياري)':'Name in Arabic (optional)'}
          </div>
          <input value={valAr} onChange={e => setValAr(e.target.value)} placeholder="اكتب اسمك" dir="rtl"
            style={{
              width: '100%', height: 54, padding: '0 16px',
              background: T.surface, border: `1px solid ${T.borderStrong}`,
              borderRadius: 14, color: T.text, fontSize: 17, fontWeight: 500,
              fontFamily: typeStyles(T).sansFont, boxSizing: 'border-box', outline: 'none',
              textAlign: 'right',
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

export {
  ScreenJoin, ScreenOTP, ScreenConsent,
  ScreenWelcome, ScreenName, ScreenFrame, TopBack,
};
