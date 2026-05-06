import React from 'react';
import {
  typeStyles, Icon, Card, Button,
} from '../design-system.jsx';
import { useCompetitionPath } from '../hooks/use-competition-path.js';

// v2 Sprint 3 — signature competition detail (Sabr 21d, Niyyah 7d).
// Renders the day-by-day path; each day expands to body + reflection
// prompt + complete-day action.

function ScreenCompetitionPath({ theme, t, dir, go, challengeId }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const {
    challenge, days, completedSet, activeDay, progress,
    loading, error, complete,
  } = useCompetitionPath(challengeId);
  const [openDay, setOpenDay] = React.useState(null);

  React.useEffect(() => {
    if (activeDay && openDay == null) setOpenDay(activeDay);
  }, [activeDay, openDay]);

  if (loading) {
    return (
      <div style={{
        height: '100%', background: T.bg, paddingTop: 54, paddingBottom: 100,
        boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: T.textMuted, fontSize: 14 }}>
          {lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}
        </div>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <PathError theme={T} lang={lang} go={go}/>
    );
  }

  const title = (lang === 'ar' && challenge.title_ar) ? challenge.title_ar : challenge.title_en;
  const desc = (lang === 'ar' && challenge.description_ar) ? challenge.description_ar : challenge.description_en;
  const themeAccent = challenge.badge_color || T.accent;
  const isRTLArabic = lang === 'ar';
  const useArabicDisplay = challenge.theme === 'sabr' && isRTLArabic;

  return (
    <div style={{
      height: '100%', background: T.bg, overflow: 'auto',
      paddingTop: 54, paddingBottom: 100, boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 22px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => go && go('challenges')}
          aria-label={lang === 'ar' ? 'العودة' : 'Back'}
          style={{
            width: 36, height: 36, borderRadius: 999,
            background: T.chipBg, border: `1px solid ${T.border}`,
            color: T.text, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon name={lang === 'ar' ? 'chev' : 'chevL'} size={16}/></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {challenge.theme === 'sabr' ? (lang === 'ar' ? 'صبر' : 'Sabr')
             : challenge.theme === 'niyyah' ? (lang === 'ar' ? 'نية' : 'Niyyah')
             : (lang === 'ar' ? 'مسار' : 'Path')}
            {' · '}
            {challenge.duration_days || days.length} {lang === 'ar' ? 'يوماً' : 'days'}
          </div>
        </div>
      </div>

      <div style={{ padding: '8px 22px 14px' }}>
        <div style={{
          fontFamily: useArabicDisplay
            ? `'Reem Kufi', 'Amiri', ${typeStyles(T).displayFont}`
            : typeStyles(T).displayFont,
          fontSize: useArabicDisplay ? 36 : 30,
          color: T.text, letterSpacing: -0.5, lineHeight: 1.1,
          textAlign: useArabicDisplay ? 'center' : (isRTLArabic ? 'start' : 'start'),
        }}>
          {title}
        </div>
        {desc && (
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 8, lineHeight: 1.5 }}>
            {desc}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ padding: '0 22px 16px' }}>
        <div style={{
          height: 6, borderRadius: 999, background: T.track, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${Math.round(progress * 100)}%`,
            background: themeAccent, transition: 'width .3s',
          }}/>
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6, letterSpacing: 0.2 }}>
          {completedSet.size} / {days.length} {lang === 'ar' ? 'مكتمل' : 'complete'}
        </div>
      </div>

      {/* Day cards */}
      <div style={{ padding: '0 16px' }}>
        {days.map((day) => (
          <DayCard
            key={day.id}
            theme={T} lang={lang}
            day={day}
            done={completedSet.has(day.day_number)}
            active={day.day_number === activeDay}
            open={openDay === day.day_number}
            onToggle={() => setOpenDay(prev => prev === day.day_number ? null : day.day_number)}
            onComplete={(reflection) => complete(day.day_number, reflection)}
            accent={themeAccent}/>
        ))}
      </div>

      {progress >= 1 && (
        <CompletionCard theme={T} lang={lang} accent={themeAccent}/>
      )}
    </div>
  );
}

function DayCard({ theme, lang, day, done, active, open, onToggle, onComplete, accent }) {
  const T = theme;
  const title = (lang === 'ar' && day.title_ar) ? day.title_ar : day.title_en;
  const body = (lang === 'ar' && day.body_ar) ? day.body_ar : day.body_en;
  const prompt = (lang === 'ar' && day.prompt_ar) ? day.prompt_ar : day.prompt_en;
  const [reflection, setReflection] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const handleComplete = async () => {
    if (busy) return;
    setBusy(true);
    try { await onComplete(reflection.trim() || undefined); setReflection(''); }
    finally { setBusy(false); }
  };

  return (
    <Card theme={T} pad={0} radius={20}
      style={{
        marginBottom: 10,
        borderLeft: `3px solid ${done ? accent : (active ? accent : T.border)}`,
        opacity: done && !open ? 0.85 : 1,
      }}>
      <button onClick={onToggle} type="button"
        style={{
          width: '100%', padding: '14px 16px',
          background: 'transparent', border: 'none', color: T.text,
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer', textAlign: 'start', fontFamily: 'inherit',
        }}>
        <div style={{
          width: 32, height: 32, borderRadius: 999, flexShrink: 0,
          background: done ? accent : 'transparent',
          color: done ? '#FFFFFF' : T.textMuted,
          border: done ? 'none' : `1.5px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700,
        }}>
          {done ? <Icon name="check" size={14}/> : day.day_number}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, color: T.textMuted, letterSpacing: 0.4, fontWeight: 700,
            textTransform: 'uppercase', marginBottom: 2,
          }}>
            {lang === 'ar' ? `يوم ${day.day_number}` : `Day ${day.day_number}`}
          </div>
          <div style={{ fontSize: 15, color: T.text, fontWeight: 600, lineHeight: 1.3 }}>
            {title}
          </div>
        </div>
        <Icon name={open ? 'chevUp' : 'chevDown'} size={16} style={{ color: T.textMuted }}/>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 14, color: T.text, lineHeight: 1.5, marginTop: 14 }}>
            {body}
          </div>
          {prompt && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>
                {lang === 'ar' ? 'تأمّل' : 'Reflect'}
              </div>
              <div style={{ fontSize: 13, color: T.textMid, marginBottom: 10, lineHeight: 1.5 }}>
                {prompt}
              </div>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder={lang === 'ar' ? 'اكتب هنا (اختياري)…' : 'Write here (optional)…'}
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                  background: T.surfaceAlt, border: `1px solid ${T.border}`,
                  borderRadius: 12, color: T.text, fontSize: 13, fontFamily: 'inherit',
                  outline: 'none', resize: 'vertical',
                }}
              />
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <Button theme={T} variant={done ? 'secondary' : 'primary'}
              style={{ width: '100%' }}
              disabled={busy}
              onClick={handleComplete}>
              {done
                ? (lang === 'ar' ? 'حفظ التأمل' : 'Save reflection')
                : (busy
                    ? (lang === 'ar' ? 'جارٍ…' : 'Saving…')
                    : (lang === 'ar' ? 'إنهاء يوم اليوم' : 'Complete today'))}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function CompletionCard({ theme, lang, accent }) {
  const T = theme;
  return (
    <div style={{ padding: '20px 16px 0' }}>
      <Card theme={T} pad={20} radius={20}
        style={{
          textAlign: 'center', borderTop: `3px solid ${accent}`,
          background: T.surfaceAlt,
        }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
          background: accent, color: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="trophy" size={28}/>
        </div>
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 20, color: T.text,
          letterSpacing: -0.3, marginBottom: 8,
        }}>
          {lang === 'ar' ? 'بارك الله فيك' : 'Path complete'}
        </div>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
          {lang === 'ar'
            ? 'لقد أتممت المسار. ستظهر مكافأتك في تبويب "حسابي" قريباً.'
            : 'You finished the path. Your reward will appear in the Mine tab shortly.'}
        </div>
      </Card>
    </div>
  );
}

function PathError({ theme, lang, go }) {
  const T = theme;
  return (
    <div style={{
      height: '100%', background: T.bg, paddingTop: 54, paddingBottom: 100,
      boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 14, padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, color: T.textMuted }}>
        {lang === 'ar' ? 'تعذّر تحميل المسار.' : 'Could not load this path.'}
      </div>
      <Button theme={T} variant="secondary" onClick={() => go && go('challenges')}>
        {lang === 'ar' ? 'العودة' : 'Back'}
      </Button>
    </div>
  );
}

export { ScreenCompetitionPath };
