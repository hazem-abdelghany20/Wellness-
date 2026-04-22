import { useState } from 'react';
import { typeStyles, Icon, Button, Card, SectionLabel, Chip, Sparkline, AvatarDisplay, AVATAR_OPTIONS } from '../design-system.jsx';

export function ScreenProgress({ theme, t, dir }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const [metric, setMetric] = useState('sleep');
  const metrics = [
    { id: 'sleep',  label: t('sleep'),  icon: 'moon',     values: [6.2,6.8,6.1,7.2,6.9,7.4,7.1,7.0,6.8,7.3,7.5,7.2,7.4,7.6], current: '7.3h', delta: '+0.8h', dir: 'up' },
    { id: 'stress', label: t('stress'), icon: 'leaf',     values: [6,7,6,5,6,4,5,4,5,4,3,4,3,3], current: '3.4', delta: '-2.1', dir: 'down' },
    { id: 'energy', label: t('energy'), icon: 'bolt',     values: [4,5,4,5,6,6,7,6,7,7,8,7,8,7], current: '7.1', delta: '+2.3', dir: 'up' },
    { id: 'mood',   label: t('mood'),   icon: 'smile',    values: [5,6,5,6,6,7,6,7,7,8,7,8,8,8], current: '7.8', delta: '+1.6', dir: 'up' },
  ];
  const m = metrics.find(x => x.id === metric);

  return (
    <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 54, paddingBottom: 100, boxSizing: 'border-box' }}>
      <div style={{ padding: '16px 22px 10px' }}>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 30, letterSpacing: -0.5, color: T.text }}>{t('progressTitle')}</div>
        <div style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }}>{t('last30')}</div>
      </div>

      <div style={{ padding: '6px 22px 14px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {metrics.map(mm => (
          <Chip key={mm.id} theme={T} active={metric === mm.id} onClick={() => setMetric(mm.id)} icon={mm.icon}>
            {mm.label}
          </Chip>
        ))}
      </div>

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
            <span>30d</span><span>21d</span><span>14d</span><span>7d</span><span>{lang === 'ar' ? 'اليوم' : 'today'}</span>
          </div>
        </Card>
      </div>

      <div style={{ padding: '22px 16px 0' }}>
        <SectionLabel theme={T} style={{ padding: '0 4px' }}>{t('insights')}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <InsightCard theme={T} icon="moon" tone="positive"
            title={lang === 'ar' ? 'النوم تحسَّن ٠٫٨ ساعة' : 'Sleep improved 0.8h'}
            body={lang === 'ar' ? 'الاتجاه بدأ بعد إضافة تنفس المساء قبل أسبوعين.' : 'The trend started after you added evening breathing 2 weeks ago.'} />
          <InsightCard theme={T} icon="leaf" tone="info"
            title={lang === 'ar' ? 'التوتر أقل أيام الخميس' : 'Stress lowest on Thursdays'}
            body={lang === 'ar' ? 'أعلى ارتفاع في التوتر يوم الأحد.' : 'Your highest stress spikes consistently land on Sundays.'} />
          <InsightCard theme={T} icon="activity" tone="neutral"
            title={lang === 'ar' ? '١٤ تسجيلاً في ١٤ يوماً' : '14 check-ins in 14 days'}
            body={lang === 'ar' ? 'العادة استقرت. جرّب أضف ملاحظة هذا الأسبوع.' : "Your streak is stable. Try adding a note this week."} />
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

export function ScreenProfile({ theme, t, dir, go, lang, setLang, themeKey, setThemeKey, state }) {
  const T = theme;
  const [anon, setAnon] = useState(true);
  const [share, setShare] = useState(true);
  const [notifs, setNotifs] = useState(true);
  const [picker, setPicker] = useState(false);
  const name = (state && state.name) || 'Amira Mostafa';
  const avatar = (state && state.avatar) || 'monogram';

  return (
    <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 54, paddingBottom: 100, boxSizing: 'border-box' }}>
      <div style={{ padding: '16px 22px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => setPicker(true)} style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', position: 'relative',
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
          <div style={{ color: T.textMuted, fontSize: 13, marginTop: 4 }}>
            {lang === 'ar' ? 'مجموعة النيل · المالية' : 'Nile Group · Finance'}
          </div>
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
          <ToggleRow theme={T} icon="bell"
            title={lang === 'ar' ? 'تذكير التسجيل اليومي' : 'Daily check-in reminder'}
            sub="09:00" value={notifs} onChange={setNotifs}/>
        </Card>
      </div>

      <div style={{ height: 16 }}/>
      <SectionLabel theme={T}>{t('language')} · {lang === 'ar' ? 'المظهر' : 'Appearance'}</SectionLabel>
      <div style={{ padding: '0 16px' }}>
        <Card theme={T} pad={16} radius={20} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 8 }}>{t('language')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['en', 'English'], ['ar', 'العربية']].map(([k, l]) => (
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
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 8 }}>
              {lang === 'ar' ? 'المظهر' : 'Theme'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['brand', 'Brand'], ['light', 'Light']].map(([k, l]) => (
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

      {/* Avatar picker sheet */}
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
            <style>{`@keyframes sheetUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 18px' }}/>
            <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 22, color: T.text, letterSpacing: -0.3, marginBottom: 6 }}>
              {lang === 'ar' ? 'اختر صورة رمزية' : 'Choose your avatar'}
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 18 }}>
              {lang === 'ar' ? 'رموز مجردة تحمي خصوصيتك.' : 'Abstract marks that keep your identity private.'}
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
              {lang === 'ar' ? 'تم' : 'Done'}
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
