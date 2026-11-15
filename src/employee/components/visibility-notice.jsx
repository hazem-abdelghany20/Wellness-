import React from 'react';
import { Button } from '../design-system.jsx';
import { Sheet } from './sheet.jsx';
import { useMyPrefs } from '../hooks/use-my-prefs.js';

// "Your company shows everyone" (sprint 4). When the company turned on
// "Everyone takes part", there are no opt-ins: everyone's name is on the
// company board and in HR's routine report. The same words are used in
// Me → Privacy and in the one-time notice.
function visibilityCopy(lang) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  return {
    title: s('Your company shows everyone', 'شركتك بتعرض الكل'),
    text: s('Your name appears on the company board with what you did (ticks, full days, streaks), and HR sees your routine progress. Never anything about your health.',
            'اسمك بيظهر في لوحة الشركة مع اللي عملته (اللي علّمت عليه، الأيام الكاملة، وكام يوم ورا بعض)، والـ HR بيشوف تقدّمك في الروتين. عمره ما هيظهر حاجة عن صحتك.'),
  };
}

// The one-time notice. Shown once after sign-in while the company shows
// everyone and this person has not tapped OK yet.
//   open     show the sheet now
//   pending  not known yet (prefs still loading): hold other pop-ups
//   ok()     close it and remember; if saving fails it still closes, and
//            shows again next time the app opens.
function useVisibilityNotice(enabled = true) {
  const { prefs, loading, set } = useMyPrefs(enabled);
  const [closed, setClosed] = React.useState(false);
  const due = !!(enabled && prefs?.company?.everyone_visible && !prefs.visibility_notice_seen_at);
  const ok = React.useCallback(() => {
    setClosed(true);
    Promise.resolve(set('visibility_notice_seen', true)).catch(() => {});
  }, [set]);
  return { open: due && !closed, pending: !!enabled && loading && !prefs, ok };
}

function VisibilityNotice({ theme, lang, notice }) {
  if (!notice?.open) return null;
  const copy = visibilityCopy(lang);
  return (
    <Sheet theme={theme} lang={lang} title={copy.title} onClose={notice.ok} labelId="wp-visibility-title"
      footer={<Button theme={theme} variant="primary" onClick={notice.ok} style={{ width: '100%' }}>{lang === 'ar' ? 'تمام' : 'OK'}</Button>}>
      <div data-testid="visibility-notice" style={{ fontSize: 16, color: theme.text, lineHeight: 1.6 }}>{copy.text}</div>
    </Sheet>
  );
}

export { visibilityCopy, useVisibilityNotice, VisibilityNotice };
