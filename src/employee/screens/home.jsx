import React from 'react';
import {
  typeStyles, Icon, AvatarDisplay, Card,
  SectionLabel, WellnessMark, Sparkline, Ring,
} from '../design-system.jsx';
import { useDailyPlan } from '../hooks/use-daily-plan.js';
import { useCheckin } from '../hooks/use-checkin.js';
import { useContent } from '../hooks/use-content.js';
import { useAuth } from '../state/auth-context.jsx';
import { tierFor } from '../lib/tiers.js';
import { listSignatureChallenges } from '../../lib/supabase.js';
import { useAppConfig } from '../state/app-config-context.jsx';
import { prayerTimes, CAIRO } from '../lib/sun-times.js';

// --- screens-home.jsx ---
// Home / Today feed — 3 layout variants: 'list', 'stack', 'agenda'

// Defaults to gracefully fall back when the server returns sparse action data.
// The `kind` is stored as a {en, ar} object so the badge translates with
// the rest of the UI in AR mode.
const ACTION_DEFAULTS = {
  checkin:         { icon: 'smile',    kind: { en: 'Check-in', ar: 'تسجيل' },     label: { en: 'Daily check-in',             ar: 'التسجيل اليومي' },       minutes: 1 },
  'daily-checkin': { icon: 'smile',    kind: { en: 'Check-in', ar: 'تسجيل' },     label: { en: 'Daily check-in',             ar: 'التسجيل اليومي' },       minutes: 1 },
  breathe:         { icon: 'wind',     kind: { en: 'Reset',    ar: 'استراحة' },   label: { en: '2-minute box breathing',     ar: 'تنفس مربع دقيقتان' },    minutes: 2 },
  'box-breath':    { icon: 'wind',     kind: { en: 'Reset',    ar: 'استراحة' },   label: { en: 'Box breathing',              ar: 'تنفس مربع' },            minutes: 4 },
  content:         { icon: 'play',     kind: { en: 'Content',  ar: 'محتوى' },     label: { en: 'Recommended session',        ar: 'جلسة مقترحة' },          minutes: 5 },
  challenge:       { icon: 'trophy',   kind: { en: 'Challenge', ar: 'تحدٍ' },     label: { en: 'Challenge practice',         ar: 'تدريب التحدي' },         minutes: 5 },
  stretch:         { icon: 'activity', kind: { en: 'Move',     ar: 'حركة' },      label: { en: 'Desk mobility flow',         ar: 'حركات مكتبية' },         minutes: 4 },
  journal:         { icon: 'book',     kind: { en: 'Reflect',  ar: 'تأمّل' },     label: { en: 'Evening wind-down journal',  ar: 'يوميات نهاية اليوم' },   minutes: 3 },
};

// Translate content-item kind chips (AUDIO/VIDEO/ARTICLE) to AR-friendly
// labels in the home featured strip + library cards. Lives next to home so
// the home featured card and library can share it.
function kindLabel(kind, lang) {
  const map = {
    audio:   { en: 'AUDIO',   ar: 'صوت' },
    video:   { en: 'VIDEO',   ar: 'فيديو' },
    article: { en: 'ARTICLE', ar: 'مقال' },
  };
  const m = map[kind] || { en: (kind || '').toUpperCase(), ar: (kind || '') };
  return m[lang] || m.en;
}

function normalizeAction(a) {
  const fallback = ACTION_DEFAULTS[a?.id] || ACTION_DEFAULTS[a?.type] || ACTION_DEFAULTS[a?.kind] || {};
  // Server label may be a plain string or already a {en, ar} object.
  let label = a?.label ?? a?.title ?? fallback.label;
  if (!a?.label && !a?.title && (a?.title_en || a?.title_ar)) {
    label = { en: a.title_en || a.title_ar, ar: a.title_ar || a.title_en };
  }
  if (typeof label === 'string') label = { en: label, ar: label };
  // Kind: keep as a bilingual object so the badge renders in AR mode too.
  // Server may send a string (legacy) — wrap it; or already an object.
  let kind = a?.kind ?? fallback.kind ?? '';
  if (typeof kind === 'string') {
    const lookup = ACTION_DEFAULTS[kind.toLowerCase?.()];
    kind = lookup?.kind || { en: kind, ar: kind };
  }
  return {
    id: a?.id,
    type: a?.type,
    content_id: a?.content_id,
    icon: a?.icon || fallback.icon || 'sparkle',
    kind,
    label: label || { en: '', ar: '' },
    minutes: a?.minutes ?? a?.mins ?? a?.duration_mins ?? fallback.minutes ?? 0,
  };
}

function ScreenHome({ theme, t, dir, go, variant = 'list', state }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const { profile } = useAuth();
  // In AR mode, prefer display_name_ar so the greeting reads
  // "صباح الخير، أميرة" instead of leaking the Latin script.
  const arName = profile?.display_name_ar || '';
  const enName = state.name || profile?.display_name || '';
  const displayName = (lang === 'ar' && arName) ? arName : enName;
  const firstName = displayName.trim().split(/\s+/)[0] || (lang === 'ar' ? 'هناك' : 'there');
  const greeting = lang === 'ar' ? `صباح الخير، ${firstName}` : `Good morning, ${firstName}`;
  const streak = state.streak;

  const { plan, completedIds, loading, complete } = useDailyPlan();
  const { history: checkinHistory } = useCheckin(14);
  const { featured: featuredItems } = useContent(null);
  const { cfg } = useAppConfig();
  const ramadan = cfg?.ramadanMode;
  const times = React.useMemo(() => ramadan ? prayerTimes(new Date(), CAIRO) : null, [ramadan]);
  const [signatures, setSignatures] = React.useState([]);
  React.useEffect(() => {
    let alive = true;
    listSignatureChallenges()
      .then((rows) => { if (alive) setSignatures(rows); })
      .catch(() => { /* swallow — strip just won't render */ });
    return () => { alive = false; };
  }, []);

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

  // Live featured-for-you card. Falls back to the most recent featured
  // content; only renders the strip when we actually have a row.
  const featured = featuredItems && featuredItems[0] ? featuredItems[0] : null;

  const onAction = (a) => {
    if (a.type === 'checkin' || a.id === 'daily-checkin') { go('checkin'); return; }
    if (a.type === 'breathe' || a.id === 'breathe' || a.id === 'box-breath') { go('breathe'); return; }
    if (!a.done) complete(a.id);
  };

  // Build the 7-day sleep sparkline from real check-in history. checkinHistory
  // comes back newest-first; we want oldest→newest for the line, padded with
  // 0s if the user has fewer than 7 days yet (the Sparkline handles flatlines).
  const recent = (checkinHistory || []).slice(0, 7).slice().reverse();
  const weekSleep = recent.map(r => Number(r?.sleep ?? 0));
  const weekDelta = (weekSleep.length >= 2)
    ? weekSleep[weekSleep.length - 1] - weekSleep[0]
    : null;

  return (
    <div style={{
      height: '100%', background: T.bg, overflow: 'auto',
      paddingTop: 54, paddingBottom: 100, boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 22px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <WellnessMark theme={T} size={22} showText={false}/>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <IconBtn theme={T} icon="bell" onClick={() => go('notifs')}
            aria-label={lang === 'ar' ? 'الإشعارات' : 'Notifications'}/>
          <button onClick={() => go('profile')}
            aria-label={lang === 'ar' ? 'الملف الشخصي' : 'Profile'}
            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
            <AvatarDisplay theme={T} kind={state.avatar || 'monogram'} name={state.name || '?'} size={38}/>
          </button>
        </div>
      </div>

      {ramadan && times && <RamadanStrip theme={T} lang={lang} times={times}/>}

      <div style={{ padding: '8px 22px 22px' }}>
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 32, lineHeight: 1.1,
          color: T.text, letterSpacing: -0.5, fontWeight: 400, marginBottom: 12,
        }}>{greeting}</div>

        {/* Streak + quick stat row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <StreakTierCard theme={T} t={t} lang={lang} streak={streak}/>
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

      {/* Signature paths (Sabr / Niyyah / Ramadan Mode) */}
      {signatures.length > 0 && (
        <>
          <SectionLabel theme={T}>{lang === 'ar' ? 'مسارات مميّزة' : 'Featured paths'}</SectionLabel>
          <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {signatures.map(sig => (
              <SignaturePathCard key={sig.id} theme={T} lang={lang} sig={sig}
                onOpen={() => go('competition-path', { id: sig.id })}/>
            ))}
          </div>
        </>
      )}

      {/* Today's plan */}
      <SectionLabel theme={T}>{t('todaysPlan')}</SectionLabel>
      <div style={{ padding: '0 16px' }}>
        {variant === 'list' && <LayoutList theme={T} t={t} lang={lang} actions={actions} onAction={onAction}/>}
        {variant === 'stack' && <LayoutStack theme={T} t={t} lang={lang} actions={actions} onAction={onAction}/>}
        {variant === 'agenda' && <LayoutAgenda theme={T} t={t} lang={lang} actions={actions} onAction={onAction}/>}
      </div>

      {/* Featured / recommendation — real row from getFeaturedContent() */}
      {featured && (
      <div style={{ padding: '24px 16px 0' }}>
        <SectionLabel theme={T} style={{ padding: '0 4px' }} right={
          <button onClick={() => go('library')} style={{ background:'transparent', border:'none', color:T.accent, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            {lang==='ar'?'المكتبة ←':'Library →'}
          </button>
        }>{t('recForYou')}</SectionLabel>
        <Card theme={T} pad={0} radius={22} onClick={() => go('player', { item: featured })} style={{ overflow: 'hidden', cursor: 'pointer' }}>
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
              <Icon name={featured.kind === 'article' ? 'book' : 'play'} size={22}/>
            </div>
            <div style={{ position: 'relative', fontSize: 11, color: T.textMuted, letterSpacing: 1, fontWeight: 600 }}>
              {kindLabel(featured.kind, lang)} · {featured.duration_mins || featured.mins || 0} {t('minutes')}
            </div>
          </div>
          <div style={{ padding: '16px 18px 18px' }}>
            <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 22, letterSpacing: -0.3, color: T.text, lineHeight: 1.2 }}>
              {(lang === 'ar' && featured.title_ar) ? featured.title_ar : featured.title_en}
            </div>
          </div>
        </Card>
      </div>
      )}

      {/* Week glance — real 7-day sleep sparkline */}
      {weekSleep.length > 0 && (
      <div style={{ padding: '24px 16px 0' }}>
        <SectionLabel theme={T} style={{ padding: '0 4px' }}>{t('yourWeek')}</SectionLabel>
        <Card theme={T} pad={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: T.textMuted }}>{lang==='ar'?'النوم':'Sleep'}</div>
            {weekDelta != null && (
              <div style={{
                fontSize: 12,
                color: weekDelta >= 0 ? T.positive : (T.danger || T.warning || T.textMuted),
                fontWeight: 600,
              }}>
                {weekDelta >= 0 ? '+' : ''}{weekDelta.toFixed(1)}h
              </div>
            )}
          </div>
          <Sparkline theme={T} values={weekSleep} height={46}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: T.textFaint, letterSpacing: 0.5 }}>
            {recent.map((r, i) => {
              const d = r?.checked_at ? new Date(r.checked_at) : null;
              const en = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
              const ar = ['أحد','إثن','ثلا','أرب','خمي','جمع','سبت'];
              const idx = d ? d.getDay() : i;
              return <span key={i}>{(lang==='ar'?ar:en)[idx]?.[0]}</span>;
            })}
          </div>
        </Card>
      </div>
      )}
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

function RamadanStrip({ theme, lang, times }) {
  const T = theme;
  // Sunset-leaning gradient that reads on both light and dark.
  const grad = `linear-gradient(120deg, rgba(194,122,56,0.18), rgba(245,181,68,0.10))`;
  return (
    <div style={{ padding: '0 16px 8px' }}>
      <div style={{
        background: grad, border: `1px solid rgba(194,122,56,0.25)`,
        borderRadius: 16, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'rgba(245,181,68,0.20)', color: '#C27A38',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="moon" size={18}/>
        </div>
        <div style={{
          fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.5,
          textTransform: 'uppercase', minWidth: 64,
        }}>
          {lang === 'ar' ? 'وضع رمضان' : 'Ramadan'}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-around', gap: 8 }}>
          <TimeBlock theme={T} label={lang === 'ar' ? 'سحور' : 'Suhoor'} value={times.suhoor}/>
          <TimeBlock theme={T} label={lang === 'ar' ? 'إفطار' : 'Iftar'} value={times.iftar}/>
        </div>
      </div>
    </div>
  );
}

function TimeBlock({ theme, label, value }) {
  const T = theme;
  return (
    <div style={{ textAlign: 'center', minWidth: 56 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}

function SignaturePathCard({ theme, lang, sig, onOpen }) {
  const T = theme;
  const title = (lang === 'ar' && sig.title_ar) ? sig.title_ar : sig.title_en;
  const desc = (lang === 'ar' && sig.description_ar) ? sig.description_ar : sig.description_en;
  const accent = sig.badge_color || T.accent;
  const days = sig.duration_days;
  const subtle = sig.theme === 'sabr' ? (lang === 'ar' ? 'صبر' : 'Sabr')
    : sig.theme === 'niyyah' ? (lang === 'ar' ? 'نيّة' : 'Niyyah')
    : (lang === 'ar' ? 'مسار' : 'Path');
  return (
    <button onClick={onOpen} type="button" style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18,
      padding: 14, color: T.text, fontFamily: 'inherit', cursor: 'pointer',
      textAlign: 'start', width: '100%',
      borderInlineStart: `4px solid ${accent}`,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: accent + '22', color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={sig.theme === 'sabr' ? 'leaf' : sig.theme === 'niyyah' ? 'target' : 'trophy'} size={22}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, color: T.textMuted, letterSpacing: 0.4,
          textTransform: 'uppercase', fontWeight: 700, marginBottom: 2,
        }}>
          {subtle}{days ? ` · ${days} ${lang === 'ar' ? 'يوماً' : 'days'}` : ''}
        </div>
        <div style={{ fontSize: 15, color: T.text, fontWeight: 600, lineHeight: 1.2 }}>{title}</div>
        {desc && (
          <div style={{
            fontSize: 12, color: T.textMuted, marginTop: 4, lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{desc}</div>
        )}
      </div>
      <Icon name={lang === 'ar' ? 'chevL' : 'chev'} size={16} style={{ color: T.textMuted, flexShrink: 0 }}/>
    </button>
  );
}

function StreakTierCard({ theme, t, lang, streak }) {
  const T = theme;
  const info = tierFor(streak);
  const pct = Math.max(0, Math.min(1, info.progress));
  const dayWord = lang === 'ar'
    ? (info.daysToNext === 1 ? 'يوم' : 'أيام')
    : (info.daysToNext === 1 ? 'day' : 'days');
  const toNext = info.next
    ? (lang === 'ar'
        ? `${info.daysToNext} ${dayWord} إلى ${info.nextLabel.ar}`
        : `${info.daysToNext} ${dayWord} to ${info.nextLabel.en}`)
    : (lang === 'ar' ? 'وصلت للذهبي' : 'Top tier reached');
  return (
    <Card theme={T} pad={14} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: T.accentSoft,
          color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}><Icon name="flame" size={20}/></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text, lineHeight: 1 }}>{streak}</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{t('dayStreak')}</div>
        </div>
        <div style={{
          padding: '4px 9px', borderRadius: 999,
          background: info.colorSoft,
          color: info.color,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>{info.label[lang === 'ar' ? 'ar' : 'en']}</div>
      </div>
      <div>
        <div style={{ height: 4, borderRadius: 999, background: T.track, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${Math.round(pct * 100)}%`,
            background: info.color, transition: 'width .3s',
          }}/>
        </div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4, letterSpacing: 0.2 }}>
          {toNext}
        </div>
      </div>
    </Card>
  );
}

function IconBtn({ theme, icon, onClick, 'aria-label': ariaLabel, title }) {
  // No onClick = v1 placeholder → auto-disable + Coming soon tooltip
  // (same pattern as the shared HR HRButton + employee Button).
  const isStub = !onClick;
  return (
    <button onClick={isStub ? undefined : onClick} aria-label={ariaLabel} disabled={isStub}
      title={title || (isStub ? 'Coming soon' : undefined)}
      style={{
        width: 40, height: 40, borderRadius: 999,
        background: theme.chipBg, border: `1px solid ${theme.border}`,
        color: theme.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: isStub ? 'default' : 'pointer',
        opacity: isStub ? 0.45 : 1,
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
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: T.textMuted, fontWeight: 600, marginBottom: 2 }}>{typeof a.kind === 'object' ? (a.kind[lang] || a.kind.en) : a.kind}</div>
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
              <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: T.textMuted, fontWeight: 600 }}>{typeof a.kind === 'object' ? (a.kind[lang] || a.kind.en) : a.kind} · {a.minutes} {t('minutes')}</div>
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

// LAYOUT C — agenda with time-of-day rail
function LayoutAgenda({ theme, t, lang, actions, onAction }) {
  const T = theme;
  // Distribute actions across morning / midday / evening based on their
  // index — we don't have real scheduled times for daily plan actions,
  // so we surface a textual time-of-day band instead of a fake clock.
  const bands = lang === 'ar'
    ? [{ label: 'صباحاً', clock: '٩:٠٠' }, { label: 'ظهراً', clock: '١:٣٠' }, { label: 'مساءً', clock: '٩:٠٠' }]
    : [{ label: 'morning', clock: '9 am' }, { label: 'midday', clock: '1:30 pm' }, { label: 'evening', clock: '9 pm' }];
  return (
    <div style={{ paddingLeft: 4, paddingRight: 4 }}>
      {actions.map((a, i) => (
        <div key={a.id} style={{ display: 'flex', gap: 14, paddingBottom: i < actions.length - 1 ? 16 : 0 }}>
          <div style={{ width: 56, flexShrink: 0, paddingTop: 4 }}>
            <div style={{ fontFamily: typeStyles(T).monoFont, fontSize: 13, color: T.textMuted, fontWeight: 600 }}>{bands[i % bands.length].clock}</div>
            <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {bands[i % bands.length].label}
            </div>
          </div>
          <div style={{ width: 2, background: T.border, borderRadius: 2, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 6, left: -4, width: 10, height: 10, borderRadius: 999, background: a.done ? T.accent : T.bg, border: `2px solid ${T.accent}` }}/>
          </div>
          <Card theme={T} pad={14} radius={16}
            onClick={() => onAction(a)}
            style={{ flex: 1, cursor: 'pointer' }}>
            <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: T.textMuted, fontWeight: 600, marginBottom: 4 }}>
              {typeof a.kind === 'object' ? (a.kind[lang] || a.kind.en) : a.kind} · {a.minutes} {t('minutes')}
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

export { ScreenHome, IconBtn, LayoutList, LayoutStack, LayoutAgenda, normalizeAction, kindLabel };
