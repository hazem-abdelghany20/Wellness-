import React from 'react';
import { Card, SectionLabel } from '../design-system.jsx';
import { ToggleRow } from './toggle.jsx';
import { useMyPrefs } from '../hooks/use-my-prefs.js';
import { RemindersSetting } from './reminders.jsx';

// Me → Privacy: the two opt-ins (sprint 2 §5) and the reminders switch
// (sprint 3, Web Push). Both opt-ins are off until the employee turns them
// on, and can be turned off any time.
function PrivacySettings({ theme, lang }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const { prefs, loading, error, saving, saveError, set, replace, refetch } = useMyPrefs();

  let body;
  if (loading && !prefs) {
    body = <div style={{ fontSize: 13, color: T.textMuted, padding: '12px 10px' }}>{s('Loading…', 'جارٍ التحميل…')}</div>;
  } else if (!prefs) {
    body = (
      <div style={{ fontSize: 13, color: T.textMuted, padding: '12px 10px', lineHeight: 1.5 }}>
        {s('Your privacy choices can’t load right now.', 'اختيارات الخصوصية مش راضية تحمّل دلوقتي.')}{' '}
        {error && (
          <button onClick={refetch} style={{ background: 'transparent', border: 'none', color: T.accent, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 13 }}>
            {s('Try again', 'جرّب تاني')}
          </button>
        )}
      </div>
    );
  } else {
    const company = prefs.company || {};
    const boardOff = company.recognition === 'off' || !company.recognition;
    const boardTeamsOnly = company.recognition === 'teams';
    const hrViewOff = company.hr_people_view === false;
    const failed = (key) => saveError?.key === key;
    const note = (text) => <div style={{ fontSize: 12, color: T.textMuted, padding: '0 10px 10px', marginTop: -4, lineHeight: 1.5 }}>{text}</div>;
    body = (
      <>
        <ToggleRow theme={T} id="pref-board"
          label={s('Show me on the company board', 'اظهرني في لوحة الشركة')}
          hint={s('Your name can appear when you finish your routine. Only what you did is shown, never anything about your health.',
                  'اسمك ممكن يظهر لما تخلّص الروتين. بيظهر بس اللي عملته، عمره ما هيظهر حاجة عن صحتك.')}
          checked={!!prefs.recognition_opt_in} busy={saving === 'recognition_opt_in'}
          onChange={(v) => set('recognition_opt_in', v)}/>
        {(boardOff || boardTeamsOnly) && note(boardOff
          ? s('Your company hasn’t turned the board on, so no names show for now.', 'شركتك لسه ما شغّلتش اللوحة، فمفيش أسامي بتظهر دلوقتي.')
          : s('Your company’s board shows teams only, so no names show for now.', 'لوحة شركتك بتعرض الفرق بس، فمفيش أسامي بتظهر دلوقتي.'))}
        {failed('recognition_opt_in') && <div role="alert" style={{ fontSize: 12, color: T.negative, padding: '0 10px 10px' }}>{s('Could not save. Try again.', 'ما اتحفظش. جرّب تاني.')}</div>}

        <div style={{ height: 1, background: T.border, margin: '0 10px' }}/>
        <ToggleRow theme={T} id="pref-share"
          label={s('Share my routine progress with HR', 'شارك تقدّمي في الروتين مع الـ HR')}
          hint={s('HR sees your name with the days you were active and the items you ticked. Nothing about your health.',
                  'الـ HR هيشوف اسمك مع الأيام اللي شاركت فيها والتمارين اللي علّمت عليها. ولا حاجة عن صحتك.')}
          checked={!!prefs.share_with_hr} busy={saving === 'share_with_hr'}
          onChange={(v) => set('share_with_hr', v)}/>
        {hrViewOff && note(s('Your company hasn’t turned this view on, so HR sees nothing by name for now.', 'شركتك لسه ما شغّلتش العرض ده، فالـ HR مش شايف أي حاجة بالاسم دلوقتي.'))}
        {failed('share_with_hr') && <div role="alert" style={{ fontSize: 12, color: T.negative, padding: '0 10px 10px' }}>{s('Could not save. Try again.', 'ما اتحفظش. جرّب تاني.')}</div>}

        <div style={{ height: 1, background: T.border, margin: '0 10px' }}/>
        <RemindersSetting theme={T} lang={lang} remindersOn={!!prefs.routine_reminders} onPrefs={replace}/>
      </>
    );
  }

  return (
    <div data-testid="privacy-settings">
      <SectionLabel theme={T}>{s('Privacy', 'الخصوصية')}</SectionLabel>
      <div style={{ padding: '0 16px' }}>
        <Card theme={T} pad={6} radius={20}>{body}</Card>
      </div>
    </div>
  );
}

export { PrivacySettings };
