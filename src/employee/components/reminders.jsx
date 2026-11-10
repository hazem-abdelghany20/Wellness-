import React from 'react';
import { Icon, Button, Card } from '../design-system.jsx';
import { ToggleRow } from './toggle.jsx';
import { usePushReminders } from '../hooks/use-push-reminders.js';
import { unsupportedText, deniedHelp, pushErrorText } from '../lib/push-ui.js';

// Sprint 3 reminders: the switch in Me → Privacy, the one-time card on
// Today, and the iPhone "Add to Home Screen" steps both of them show.

const ASK_KEY = 'wellness-plus-reminder-ask';

function readAsked() {
  try { return !!localStorage.getItem(ASK_KEY); } catch { return false; }
}
function writeAsked(answer) {
  try { localStorage.setItem(ASK_KEY, answer); } catch { /* private mode: ask again next time */ }
}

// iPhone Safari only gets reminders from the Home Screen app: the 2 steps.
function IosInstallSteps({ theme: T, lang }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const steps = [
    s('In Safari, tap Share (the square with an arrow), then Add to Home Screen.',
      'في سفاري، دوس مشاركة (المربع اللي فيه سهم)، وبعدين «إضافة إلى الشاشة الرئيسية».'),
    s('Open Wellness+ from the new icon, and switch reminders on there.',
      'افتح ⁦Wellness+⁩ من الأيقونة الجديدة، وشغّل التذكيرات من هناك.'),
  ];
  return (
    <div data-testid="ios-install-steps" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{s('Add to Home Screen first', 'حطه على الشاشة الرئيسية الأول')}</div>
      <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4, lineHeight: 1.5 }}>
        {s('On iPhone, reminders only work from the Home Screen.', 'على الآيفون، التذكيرات بتشتغل بس من الشاشة الرئيسية.')}
      </div>
      <ol style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((text, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: T.text, lineHeight: 1.5 }}>
            <span aria-hidden="true" style={{
              width: 24, height: 24, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center',
              background: T.accent, color: T.accentInk, fontSize: 13, fontWeight: 700,
            }}>{lang === 'ar' ? ['١', '٢'][i] : i + 1}</span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Me → Privacy: the reminders row. Switch for allowed / not-yet-asked
// browsers; the Home Screen steps on an iPhone Safari tab; how to allow
// again when blocked; one plain line when this browser can't do it.
function RemindersSetting({ theme: T, lang, remindersOn, onPrefs }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const r = usePushReminders({ lang, remindersOn });
  const label = s('Reminders', 'التذكيرات');
  const hint = s('A nudge at each routine time. You can mute any one from its sheet.',
                 'تنبيه في ميعاد كل تمرين. وتقدر تكتم أي واحد من صفحته.');

  const flip = async (wantOn) => {
    const prefs = wantOn ? await r.enable() : await r.disable();
    if (prefs) onPrefs?.(prefs);
  };

  const block = (children) => (
    <div style={{ padding: '12px 10px' }} data-testid="reminders-setting">
      <div style={{ fontSize: 15, color: T.text, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );

  if (r.view === 'unsupported') {
    return block(<div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{unsupportedText(r.push?.support?.reason, lang)}</div>);
  }
  if (r.view === 'install') {
    return block(<IosInstallSteps theme={T} lang={lang}/>);
  }
  if (r.view === 'denied') {
    return block(
      <>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{deniedHelp(!!r.push?.support?.ios, lang)}</div>
        <button type="button" onClick={r.refresh} style={{
          marginTop: 8, background: 'transparent', border: 'none', padding: 0, color: T.accent,
          fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>{s('Check again', 'شوف تاني')}</button>
      </>,
    );
  }
  return (
    <div data-testid="reminders-setting">
      <ToggleRow theme={T} id="pref-reminders" label={label} hint={hint}
        checked={r.view === 'on'} busy={r.busy || r.view === 'loading'}
        onChange={flip}/>
      {r.error && (
        <div role="alert" style={{ fontSize: 12, color: T.negative, padding: '0 10px 10px', lineHeight: 1.5 }}>
          {pushErrorText(r.error, lang)}
        </div>
      )}
    </div>
  );
}

// Today: "Get a nudge at each routine time?" once per device. Hides for
// good once answered (yes, not now, or got it), and never shows when
// reminders are already on, blocked or impossible here.
function ReminderPrompt({ theme: T, lang, remindersOn }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const r = usePushReminders({ lang, remindersOn });
  const [asked, setAsked] = React.useState(readAsked);
  const [result, setResult] = React.useState(null); // 'busy' | 'on' | 'failed'

  const answer = (v) => { writeAsked(v); setAsked(true); };
  const yes = async () => {
    setResult('busy');
    const prefs = await r.enable();
    answer('yes');
    setResult(prefs ? 'on' : 'failed');
  };
  const busy = result === 'busy';

  const shell = (children) => (
    <Card theme={T} pad={16} radius={22} style={{ border: `1px solid ${T.accent}` }}>
      <section aria-label={s('Reminders', 'التذكيرات')} data-testid="reminder-prompt" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 14, background: T.accentSoft, color: T.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="bell" size={20}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </section>
    </Card>
  );
  const closeBtn = (
    <Button theme={T} variant="secondary" size="sm" onClick={() => setResult(null)} style={{ marginTop: 10 }}>
      {s('Close', 'إغلاق')}
    </Button>
  );

  if (result === 'on') {
    return shell(
      <>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{s('Reminders are on', 'التذكيرات اشتغلت')}</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4, lineHeight: 1.5 }}>
          {s('You can switch them off any time in Me.', 'تقدر تقفلها في أي وقت من صفحة أنا.')}
        </div>
        {closeBtn}
      </>,
    );
  }
  if (result === 'failed') {
    const text = r.view === 'denied' ? deniedHelp(!!r.push?.support?.ios, lang) : pushErrorText(r.error, lang);
    return shell(
      <>
        <div role="alert" style={{ fontSize: 14, color: T.text, lineHeight: 1.5 }}>{text}</div>
        {closeBtn}
      </>,
    );
  }
  if (asked && !busy) return null;

  const title = <div style={{ fontSize: 16, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{s('Get a nudge at each routine time?', 'عايز تنبيه في ميعاد كل تمرين؟')}</div>;

  if (r.view === 'install' && !busy) {
    return shell(
      <>
        {title}
        <div style={{ marginTop: 10 }}><IosInstallSteps theme={T} lang={lang}/></div>
        <Button theme={T} variant="secondary" size="sm" onClick={() => answer('later')} style={{ marginTop: 10 }}>
          {s('Got it', 'تمام')}
        </Button>
      </>,
    );
  }
  if (r.view !== 'off' && !busy) return null;

  return shell(
    <>
      {title}
      <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4, lineHeight: 1.5 }}>
        {s('One short reminder when each item is due. Mute any one, or switch them off in Me.',
           'تذكير قصير في ميعاد كل تمرين. تقدر تكتم أي واحد، أو تقفلهم من صفحة أنا.')}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button theme={T} variant="primary" size="sm" icon="bell" onClick={yes} disabled={busy}>
          {busy ? s('Turning on…', 'جارٍ التشغيل…') : s('Yes, remind me', 'أيوه، فكّرني')}
        </Button>
        <Button theme={T} variant="secondary" size="sm" onClick={() => answer('no')} disabled={busy}>
          {s('Not now', 'مش دلوقتي')}
        </Button>
      </div>
    </>,
  );
}

export { RemindersSetting, ReminderPrompt, IosInstallSteps, ASK_KEY };
