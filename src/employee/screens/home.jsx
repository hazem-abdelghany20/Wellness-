import React from 'react';
import {
  typeStyles, Icon, AvatarDisplay, Card,
  SectionLabel, WellnessMark, Sparkline, Ring,
} from '../design-system.jsx';
import { useDailyPlan } from '../hooks/use-daily-plan.js';

// --- screens-home.jsx ---
// Home / Today feed — 3 layout variants: 'list', 'stack', 'agenda'

// Defaults to gracefully fall back when the server returns sparse action data.
const ACTION_DEFAULTS = {
  breathe: { icon: 'wind',     kind: 'Reset',   label: { en: '2-minute box breathing',     ar: 'تنفس مربع دقيقتان' }, minutes: 2 },
  stretch: { icon: 'activity', kind: 'Move',    label: { en: 'Desk mobility flow',         ar: 'حركات مكتبية' },        minutes: 4 },
  journal: { icon: 'book',     kind: 'Reflect', label: { en: 'Evening wind-down journal',  ar: 'يوميات نهاية اليوم' },  minutes: 3 },
};

function normalizeAction(a) {
  const fallback = ACTION_DEFAULTS[a?.id] || ACTION_DEFAULTS[a?.kind] || {};
  // Server label may be a plain string or already a {en, ar} object.
  let label = a?.label ?? a?.title ?? fallback.label;
  if (typeof label === 'string') label = { en: label, ar: label };
  return {
    id: a?.id,
    icon: a?.icon || fallback.icon || 'sparkle',
    kind: a?.kind || fallback.kind || '',
    label: label || { en: '', ar: '' },
    minutes: a?.minutes ?? a?.mins ?? fallback.minutes ?? 0,
  };
}

function ScreenHome({ theme, t, dir, go, variant = 'list', state }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const greeting = t('goodMorning');
  const streak = state.streak;

  const { plan, completedIds, loading, complete } = useDailyPlan();

  if (loading) {
    return <HomeLoading theme={T} dir={dir}/>;
  }

  const rawActions = plan?.actions ?? [];
  const completedSet = new Set(completedIds || []);
  const actions = rawActions.map(a => {
    const n = normalizeAction(a);
    return { ...n, done: completedSet.has(n.id) };
  });
  const doneCount = actions.filter(a => a.done).length;
  const totalCount = Math.max(actions.length, 1);

  const onAction = (a) => {
    if (a.id === 'breathe') { go('breathe'); return; }
    if (!a.done) complete(a.id);
  };

  const featured = {
    tag: { en: 'AUDIO · 6 MIN', ar: 'صوت · 6 د' },
    title: { en: 'Sleep onset — a cue for tonight', ar: 'بداية النوم — إشارة لهذه الليلة' },
    sub: { en: 'Based on your last three check-ins', ar: 'استناداً إلى آخر ثلاث تسجيلات' },
  };

  return (
    <div style={{
      height: '100%', background: T.bg, overflow: 'auto',
      paddingTop: 54, paddingBottom: 100, boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 22px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <WellnessMark theme={T} size={22} showText={false}/>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <IconBtn theme={T} icon="bell" onClick={() => go('notifs')}/>
          <button onClick={() => go('profile')} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
            <AvatarDisplay theme={T} kind={state.avatar || 'monogram'} name={state.name || '?'} size={38}/>
          </button>
        </div>
      </div>

      <div style={{ padding: '8px 22px 22px' }}>
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 32, lineHeight: 1.1,
          color: T.text, letterSpacing: -0.5, fontWeight: 400, marginBottom: 12,
        }}>{greeting}</div>

        {/* Streak + quick stat row */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Card theme={T} pad={14} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: T.accentSoft,
              color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name="flame" size={20}/></div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text, lineHeight: 1 }}>{streak}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{t('dayStreak')}</div>
            </div>
          </Card>
          <Card theme={T} pad={14} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Ring theme={T} value={doneCount / totalCount} size={38} stroke={4}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{doneCount}/{actions.length || 0}</div>
            </Ring>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.2 }}>{lang==='ar'?'خطة اليوم':'Today'}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{lang==='ar'?'مهام مكتملة':'actions complete'}</div>
            </div>
          </Card>
        </div>
      </div>

      {/* Today's plan */}
      <SectionLabel theme={T}>{t('todaysPlan')}</SectionLabel>
      <div style={{ padding: '0 16px' }}>
        {variant === 'list' && <LayoutList theme={T} t={t} lang={lang} actions={actions} onAction={onAction}/>}
        {variant === 'stack' && <LayoutStack theme={T} t={t} lang={lang} actions={actions} onAction={onAction}/>}
        {variant === 'agenda' && <LayoutAgenda theme={T} t={t} lang={lang} actions={actions} onAction={onAction}/>}
      </div>

      {/* Featured / recommendation */}
      <div style={{ padding: '24px 16px 0' }}>
        <SectionLabel theme={T} style={{ padding: '0 4px' }} right={
          <button onClick={() => go('library')} style={{ background:'transparent', border:'none', color:T.accent, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            {lang==='ar'?'المكتبة ←':'Library →'}
          </button>
        }>{t('recForYou')}</SectionLabel>
        <Card theme={T} pad={0} radius={22} onClick={() => go('player', { id: 'sleep-onset' })} style={{ overflow: 'hidden', cursor: 'pointer' }}>
          <div style={{
            height: 140, position: 'relative',
            background: `linear-gradient(135deg, ${T.accentSoft}, ${T.surfaceAlt})`,
            display: 'flex', alignItems: 'flex-end', padding: 18,
          }}>
            {/* placeholder moon motif */}
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
              <defs>
                <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill={T.textFaint}/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dots)"/>
            </svg>
            <div style={{
              position: 'absolute', top: 18, right: 18,
              width: 54, height: 54, borderRadius: 999,
              background: T.accent, color: T.accentInk,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: dir === 'rtl' ? 'scale(-1,1)' : 'none',
            }}>
              <Icon name="play" size={22}/>
            </div>
            <div style={{ position: 'relative', fontSize: 11, color: T.textMuted, letterSpacing: 1, fontWeight: 600 }}>
              {featured.tag[lang]}
            </div>
          </div>
          <div style={{ padding: '16px 18px 18px' }}>
            <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 22, letterSpacing: -0.3, color: T.text, lineHeight: 1.2 }}>
              {featured.title[lang]}
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>{featured.sub[lang]}</div>
          </div>
        </Card>
      </div>

      {/* Week glance */}
      <div style={{ padding: '24px 16px 0' }}>
        <SectionLabel theme={T} style={{ padding: '0 4px' }}>{t('yourWeek')}</SectionLabel>
        <Card theme={T} pad={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: T.textMuted }}>{lang==='ar'?'النوم':'Sleep'}</div>
            <div style={{ fontSize: 12, color: T.positive, fontWeight: 600 }}>+0.8h</div>
          </div>
          <Sparkline theme={T} values={[6.2, 6.8, 6.1, 7.2, 6.9, 7.4, 7.1]} height={46}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: T.textFaint, letterSpacing: 0.5 }}>
            {(lang==='ar'?['س','أ','ث','أر','خ','ج','س']:['M','T','W','T','F','S','S']).map((d,i)=><span key={i}>{d}</span>)}
          </div>
        </Card>
      </div>
    </div>
  );
}

function HomeLoading({ theme, dir }) {
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

function IconBtn({ theme, icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 40, height: 40, borderRadius: 999,
      background: theme.chipBg, border: `1px solid ${theme.border}`,
      color: theme.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
    }}><Icon name={icon} size={18}/></button>
  );
}

// LAYOUT A — list with left icon, inline check
function LayoutList({ theme, t, lang, actions, onAction }) {
  const T = theme;
  return (
    <Card theme={T} pad={0} radius={22}>
      {actions.map((a, i) => (
        <div key={a.id} onClick={() => onAction(a)}
          style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
            borderBottom: i < actions.length - 1 ? `1px solid ${T.border}` : 'none',
            cursor: 'pointer',
          }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: a.done ? T.accent : T.accentSoft, color: a.done ? T.accentInk : T.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{a.done ? <Icon name="check" size={20}/> : <Icon name={a.icon} size={20}/>}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: T.textMuted, fontWeight: 600, marginBottom: 2 }}>{a.kind}</div>
            <div style={{
              fontSize: 15, color: T.text, fontWeight: 500,
              textDecoration: a.done ? 'line-through' : 'none',
              textDecorationColor: T.textFaint,
            }}>{a.label[lang]}</div>
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>{a.minutes} {t('minutes')}</div>
        </div>
      ))}
    </Card>
  );
}

// LAYOUT B — stacked cards with big numerals
function LayoutStack({ theme, t, lang, actions, onAction }) {
  const T = theme;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {actions.map((a, i) => (
        <Card key={a.id} theme={T} pad={18} radius={20}
          onClick={() => onAction(a)}
          style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: a.done ? 0.6 : 1 }}>
          <div style={{
            fontFamily: typeStyles(T).displayFont, fontSize: 38, color: T.accent,
            width: 36, lineHeight: 1, letterSpacing: -1,
          }}>{String(i+1).padStart(2,'0')}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name={a.icon} size={14} stroke={T.textMuted}/>
              <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: T.textMuted, fontWeight: 600 }}>{a.kind} · {a.minutes} {t('minutes')}</div>
            </div>
            <div style={{ fontSize: 16, color: T.text, fontWeight: 500, lineHeight: 1.3 }}>{a.label[lang]}</div>
          </div>
          <div style={{
            width: 28, height: 28, borderRadius: 999,
            border: `1.5px solid ${a.done ? T.accent : T.borderStrong}`,
            background: a.done ? T.accent : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{a.done && <Icon name="check" size={14} stroke={T.accentInk}/>}</div>
        </Card>
      ))}
    </div>
  );
}

// LAYOUT C — agenda with time rail
function LayoutAgenda({ theme, t, lang, actions, onAction }) {
  const T = theme;
  const times = ['09:00', '13:30', '21:00'];
  return (
    <div style={{ paddingLeft: 4, paddingRight: 4 }}>
      {actions.map((a, i) => (
        <div key={a.id} style={{ display: 'flex', gap: 14, paddingBottom: i < actions.length - 1 ? 16 : 0 }}>
          <div style={{ width: 56, flexShrink: 0, paddingTop: 4 }}>
            <div style={{ fontFamily: typeStyles(T).monoFont, fontSize: 13, color: T.textMuted, fontWeight: 600 }}>{times[i % times.length]}</div>
            <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {lang==='ar' ? ['صباحاً','ظهراً','مساءً'][i % 3] : ['morning','midday','evening'][i % 3]}
            </div>
          </div>
          <div style={{ width: 2, background: T.border, borderRadius: 2, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 6, left: -4, width: 10, height: 10, borderRadius: 999, background: a.done ? T.accent : T.bg, border: `2px solid ${T.accent}` }}/>
          </div>
          <Card theme={T} pad={14} radius={16}
            onClick={() => onAction(a)}
            style={{ flex: 1, cursor: 'pointer' }}>
            <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: T.textMuted, fontWeight: 600, marginBottom: 4 }}>
              {a.kind} · {a.minutes} {t('minutes')}
            </div>
            <div style={{ fontSize: 15, color: T.text, fontWeight: 500, lineHeight: 1.3, marginBottom: 10 }}>
              {a.label[lang]}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name={a.icon} size={14} stroke={T.accent}/>
              <div style={{ fontSize: 12, color: a.done ? T.positive : T.accent, fontWeight: 600 }}>
                {a.done ? t('done') : t('tryNow')}
              </div>
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { ScreenHome, IconBtn });

export { ScreenHome, IconBtn, LayoutList, LayoutStack, LayoutAgenda };
