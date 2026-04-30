import React from 'react';
import {
  typeStyles, Icon, AvatarDisplay, AVATAR_OPTIONS, Button, Card, SectionLabel,
} from '../design-system.jsx';
import { useAuth } from '../state/auth-context.jsx';
import { useProfile } from '../hooks/use-profile.js';

function ScreenProfile({ theme, t, dir, go, lang, setLang, themeKey, setThemeKey, state }) {
  const T = theme;
  const { signOut, company } = useAuth();
  const { profile, update } = useProfile();
  const [anon, setAnon] = React.useState(true);
  const [share, setShare] = React.useState(true);
  const [notifs, setNotifs] = React.useState(true);
  const [picker, setPicker] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  if (!profile) return <ProfileLoading theme={T} dir={dir}/>;

  const name = profile.display_name || (state && state.name) || '';
  const avatar = profile.avatar_kind || (state && state.avatar) || 'monogram';
  const companyName = company?.name || '';

  const handleAvatarPick = async (opt) => {
    setPicker(false);
    if (state?.setAvatar) state.setAvatar(opt);
    try { await update({ avatar_kind: opt }); }
    catch (e) { console.warn('[profile] avatar update failed', e); }
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try { await signOut(); }
    catch (e) { console.warn('[profile] signOut failed', e); setSigningOut(false); }
  };

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
          {companyName ? (
            <div style={{ color: T.textMuted, fontSize: 13, marginTop: 4 }}>{companyName}</div>
          ) : null}
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
        <Button theme={T} variant="secondary" style={{ width: '100%' }} onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? (lang==='ar'?'…':'…') : t('signOut')}
        </Button>
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
                <button key={opt} onClick={() => handleAvatarPick(opt)}
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

function ProfileLoading({ theme, dir }) {
  const T = theme;
  const text = dir === 'rtl' ? 'جارٍ التحميل…' : 'Loading…';
  return (
    <div style={{
      height: '100%', background: T.bg, paddingTop: 54, paddingBottom: 100,
      boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color: T.textMuted, fontSize: 14, letterSpacing: 0.5 }}>{text}</div>
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

export { ScreenProfile };
