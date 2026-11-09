import React from 'react';
import { THEMES, typeStyles, Icon, Button, Card, SectionLabel } from '../../employee/design-system.jsx';
import { HabitMedia } from '../../employee/components/habit-media.jsx';
import { resolveBadge, mediaPayload, WINDOW_DAYS } from '../lib/habit-template.js';

// Live preview of the employee's Challenge tab for a template being edited.
// Mirrors src/employee/screens/habit-challenge.jsx (active week, nothing
// logged yet) with the employee theme and the same copy.

function nextSunday() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return d;
}

const fmtDay = (d, lang, opts) =>
  new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { ...opts, timeZone: 'UTC' }).format(d);
const num = (n, lang) => (lang === 'ar' ? new Intl.NumberFormat('ar-EG').format(n) : String(n));

function HabitCardPreview({ form, existingPayload, lang }) {
  const T = THEMES.brand;
  const ty = typeStyles(T);
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const val = (k) => (lang === 'ar' ? form[`${k}_ar`] : form[`${k}_en`]) || '';
  const placeholder = (en, ar) => <span style={{ color: T.textFaint }}>{s(en, ar)}</span>;

  const title = val('name');
  const badge = resolveBadge(form, existingPayload);
  const evening = form.check_mode === 'next_morning';
  const need = Number(form.success_days) || 4;
  const media = mediaPayload(form);

  const start = nextSunday();
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); return d;
  });
  const end = days[days.length - 1];

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{
      background: T.bg, color: T.text, fontFamily: ty.sansFont,
      borderRadius: 28, padding: '18px 14px 22px', border: '1px solid rgba(0,0,0,0.25)',
      boxShadow: '0 12px 30px rgba(0,0,0,0.18)', maxWidth: 380, margin: '0 auto',
    }}>
      <div style={{ padding: '2px 8px 14px' }}>
        <div style={{ fontFamily: ty.displayFont, fontSize: 28, letterSpacing: -0.5 }}>{s('This week', 'تحدي الأسبوع')}</div>
        <div style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }}>
          {fmtDay(start, lang, { day: 'numeric', month: 'short' })} {lang === 'ar' ? '←' : '→'} {fmtDay(end, lang, { day: 'numeric', month: 'short' })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card theme={T} pad={20} radius={24}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center',
              background: `${badge.badge_color}26`, color: badge.badge_color, flexShrink: 0,
            }}>
              <Icon name={badge.badge_icon} size={22}/>
            </div>
            <div style={{ fontFamily: ty.displayFont, fontSize: 24, lineHeight: 1.1, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
              {title || placeholder('Challenge name', 'اسم التحدي')}
            </div>
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.55, overflowWrap: 'anywhere' }}>
            {val('action') || placeholder('The daily action shows here.', 'الفعل اليومي هيظهر هنا.')}
          </div>

          <HabitMedia theme={T} lang={lang} payload={media} title={title}/>

          <div style={{ marginTop: 20 }}>
            <Button theme={T} variant="primary" onClick={() => {}} style={{ width: '100%' }}>
              {evening ? s('✓ Did it last night', '✓ عملتها امبارح بالليل') : s('✓ Did it today', '✓ عملتها النهارده')}
            </Button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
            {days.map((d, i) => {
              const isTarget = i === 0;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 999, border: `2px solid ${isTarget ? T.text : T.border}` }}/>
                  <div style={{ fontSize: 11, color: isTarget ? T.text : T.textMuted, fontWeight: isTarget ? 700 : 500 }}>
                    {fmtDay(d, lang, { weekday: 'short' })}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, fontSize: 14, color: T.textMuted, textAlign: 'center' }}>
            {s(`0 of ${need} days for the reward`, `${num(0, lang)} من ${num(need, lang)} أيام للمكافأة`)}
          </div>
        </Card>

        <SectionLabel theme={T} style={{ padding: '0 6px', margin: '6px 0 0' }}>{s('Why this helps', 'ليه ده مفيد')}</SectionLabel>
        <Card theme={T} pad={18} radius={20}>
          <div style={{ fontSize: 15, lineHeight: 1.55, overflowWrap: 'anywhere' }}>
            {val('why') || placeholder('Why it helps shows here.', 'سبب الفايدة هيظهر هنا.')}
          </div>
          {val('tip') && (
            <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5, marginTop: 12, overflowWrap: 'anywhere' }}>
              <span style={{ fontWeight: 700 }}>{s('Tip: ', 'نصيحة: ')}</span>{val('tip')}
            </div>
          )}
          {form.article_slug && (
            <div style={{ marginTop: 16 }}>
              <Button theme={T} variant="soft" size="sm" icon="book" onClick={() => {}}>
                {s('Read the article', 'اقرا المقال')}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export { HabitCardPreview };
