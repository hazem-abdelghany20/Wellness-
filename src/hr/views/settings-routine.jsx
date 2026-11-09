import React from 'react';
import { Panel, Toggle } from '../../shared/components.jsx';
import { Choice, inputStyle } from '../../shared/authoring/ui.jsx';
import { libraryError } from '../../shared/authoring/errors.js';
import { getMyCompanySettings, setCompanySettings } from '../../lib/supabase-routines';

// Time zones offered in Settings. Africa/Cairo first (the default); the
// company's current zone is added when it isn't in the list.
export const TIMEZONES = [
  { id: 'Africa/Cairo', en: 'Cairo (Egypt)', ar: 'القاهرة (مصر)' },
  { id: 'Asia/Riyadh', en: 'Riyadh (Saudi Arabia)', ar: 'الرياض (السعودية)' },
  { id: 'Asia/Dubai', en: 'Dubai (UAE)', ar: 'دبي (الإمارات)' },
  { id: 'Asia/Kuwait', en: 'Kuwait', ar: 'الكويت' },
  { id: 'Asia/Qatar', en: 'Doha (Qatar)', ar: 'الدوحة (قطر)' },
  { id: 'Asia/Bahrain', en: 'Bahrain', ar: 'البحرين' },
  { id: 'Asia/Muscat', en: 'Muscat (Oman)', ar: 'مسقط (عُمان)' },
  { id: 'Asia/Amman', en: 'Amman (Jordan)', ar: 'عمّان (الأردن)' },
  { id: 'Asia/Beirut', en: 'Beirut (Lebanon)', ar: 'بيروت (لبنان)' },
  { id: 'Asia/Baghdad', en: 'Baghdad (Iraq)', ar: 'بغداد (العراق)' },
  { id: 'Africa/Casablanca', en: 'Casablanca (Morocco)', ar: 'الدار البيضاء (المغرب)' },
  { id: 'Africa/Tunis', en: 'Tunis (Tunisia)', ar: 'تونس' },
  { id: 'Africa/Algiers', en: 'Algiers (Algeria)', ar: 'الجزائر' },
  { id: 'Europe/London', en: 'London (UK)', ar: 'لندن (بريطانيا)' },
  { id: 'Europe/Berlin', en: 'Berlin (Central Europe)', ar: 'برلين (وسط أوروبا)' },
  { id: 'UTC', en: 'UTC', ar: 'UTC' },
];

const arDigits = (t) => String(t).replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[Number(c)]);

const RECOGNITION = [
  { id: 'off', en: 'Off', ar: 'مقفول',
    hint_en: 'No board. Nobody sees how others are doing.', hint_ar: 'مفيش لوحة. محدش بيشوف الباقيين عاملين إيه.' },
  { id: 'teams', en: 'Teams only', ar: 'الفرق بس',
    hint_en: 'Employees see teams ranked by how many people took part. No names.', hint_ar: 'الموظفين بيشوفوا الفرق مترتبة بعدد اللي شاركوا. من غير أسامي.' },
  { id: 'named', en: 'Teams + people who opt in', ar: 'الفرق + اللي يوافقوا',
    hint_en: 'Also names people who chose to appear, by what they did. Never anything about health.', hint_ar: 'وكمان أسامي اللي اختاروا يظهروا، باللي عملوه بس. عمره ما بيظهر حاجة عن الصحة.' },
];

// Routine, recognition, names, quiet hours and time zone. Every change saves on its own.
// onSaved(patch) lets the page keep its own copy of companies.settings in step.
export function RoutineSettingsPanels({ theme, lang, density, onSaved }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const [cfg, setCfg] = React.useState(null);
  const [loadError, setLoadError] = React.useState(null);
  const [status, setStatus] = React.useState({}); // key → { kind, text }
  const [busy, setBusy] = React.useState(null);

  React.useEffect(() => {
    getMyCompanySettings().then(setCfg).catch((e) => setLoadError(e));
  }, []);

  async function save(key, value) {
    setBusy(key);
    setStatus((st) => ({ ...st, [key]: null }));
    try {
      const next = await setCompanySettings({ [key]: value });
      setCfg(next || { ...cfg, [key]: value });
      onSaved?.({ [key]: value });
      setStatus((st) => ({ ...st, [key]: { kind: 'ok', text: s('Saved.', 'اتحفظ.') } }));
    } catch (e) {
      setStatus((st) => ({ ...st, [key]: { kind: 'err', text: libraryError(e, lang) } }));
    } finally {
      setBusy(null);
    }
  }

  const note = (key) => status[key] && (
    <span role={status[key].kind === 'err' ? 'alert' : 'status'} style={{ fontSize: 12, color: status[key].kind === 'ok' ? T.positive : T.danger }}>{status[key].text}</span>
  );
  const title = (text) => <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 4 }}>{text}</div>;
  const sub = (text) => <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, lineHeight: 1.55 }}>{text}</div>;

  if (loadError) {
    return <Panel theme={T} density={density}><div role="alert" style={{ fontSize: 13, color: T.danger }}>{libraryError(loadError, lang)}</div></Panel>;
  }
  if (!cfg) return null;

  const zones = TIMEZONES.some((z) => z.id === cfg.timezone) ? TIMEZONES : [{ id: cfg.timezone, en: cfg.timezone, ar: cfg.timezone }, ...TIMEZONES];
  const quietOn = cfg.quiet_hours !== false;
  const quietFrom = cfg.quiet_window?.from || '20:00';
  const quietTo = cfg.quiet_window?.to || '08:00';

  return (
    <>
      <Panel theme={T} density={density}>
        {title(s('Recognition', 'التقدير'))}
        {sub(s('Who can see effort on the Today tab. People who join in can be congratulated without anyone being singled out.',
               'مين يقدر يشوف المجهود في «النهارده». تقدر تشجّع اللي بيشاركوا من غير ما حد يتحط تحت المجهر.'))}
        <div role="radiogroup" aria-label={s('Recognition', 'التقدير')} style={{ display: 'grid', gap: 8 }}>
          {RECOGNITION.map((r) => (
            <Choice key={r.id} theme={T} selected={cfg.recognition === r.id} disabled={busy === 'recognition'}
              onClick={() => cfg.recognition !== r.id && save('recognition', r.id)} style={{ padding: '10px 12px' }}>
              {lang === 'ar' ? r.ar : r.en}
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400, marginTop: 3 }}>{lang === 'ar' ? r.hint_ar : r.hint_en}</div>
            </Choice>
          ))}
        </div>
        <div style={{ marginTop: 10, minHeight: 16 }}>{note('recognition')}</div>
      </Panel>

      <Panel theme={T} density={density}>
        {title(s('Weekly Wellness House habit', 'عادة الأسبوع من Wellness House'))}
        {sub(s('When you leave a week empty, Wellness House picks a small habit for it. Turn this off to pause it while a routine runs, so people have one thing to do. Challenges you schedule still run.',
               'لما تسيب أسبوع فاضي، Wellness House بيختار له عادة صغيرة. اقفلها علشان توقفها وقت ما الروتين شغال، علشان الناس يبقى عندهم حاجة واحدة. التحديات اللي بتجدولها بتفضل شغالة.'))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Toggle theme={T} value={!!cfg.weekly_habit_enabled} onChange={(v) => save('weekly_habit_enabled', v)}/>
          <span style={{ fontSize: 13, color: T.textMid }}>{cfg.weekly_habit_enabled ? s('On', 'شغالة') : s('Paused', 'متوقفة')}</span>
          {note('weekly_habit_enabled')}
        </div>
      </Panel>

      <Panel theme={T} density={density}>
        {title(s('Show names of people who share their progress', 'إظهار أسامي اللي بيشاركوا تقدمهم'))}
        {sub(s('Each employee decides in their app whether to share their routine progress with HR. When this is on, the Routine report lists only those people. Everyone else is only counted.',
               'كل موظف بيقرر من التطبيق يشارك تقدمه في الروتين مع الـ HR ولا لأ. لما ده يتفتح، تقرير الروتين بيعرض الناس دول بس. الباقي بيتعدّوا من غير أسامي.'))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Toggle theme={T} value={!!cfg.hr_people_view} onChange={(v) => save('hr_people_view', v)}/>
          <span style={{ fontSize: 13, color: T.textMid }}>{cfg.hr_people_view ? s('On', 'مفتوح') : s('Off', 'مقفول')}</span>
          {note('hr_people_view')}
        </div>
      </Panel>

      <Panel theme={T} density={density}>
        {title(s('Quiet hours', 'ساعات الهدوء'))}
        {sub(s(`When this is on, messages from HR arrive only between ${quietTo} and ${quietFrom} company time. One set for the night waits until ${quietTo}.`,
               `لما ده يبقى شغال، رسايل الـ HR بتوصل بس من ${arDigits(quietTo)} لـ ${arDigits(quietFrom)} بتوقيت الشركة. اللي متجدولة بالليل بتستنى لحد ${arDigits(quietTo)}.`))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Toggle theme={T} value={quietOn} onChange={(v) => save('quiet_hours', v)}/>
          <span style={{ fontSize: 13, color: T.textMid }}>
            {quietOn ? s(`On · ${quietTo}–${quietFrom}`, `شغالة · ${arDigits(quietTo)}–${arDigits(quietFrom)}`) : s('Off: messages go at any hour', 'مقفولة: الرسايل بتوصل في أي وقت')}
          </span>
          {note('quiet_hours')}
        </div>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.divider}`, fontSize: 12, color: T.textMuted, lineHeight: 1.55 }}>
          <strong style={{ color: T.textMid }}>{s('Routine reminders: ', 'تذكيرات الروتين: ')}</strong>
          {s('Employees switch reminders on in their app; iPhone users must add the app to the Home Screen first. Reminders follow the routine times, not quiet hours.',
             'الموظفين بيشغّلوا التذكيرات من التطبيق بتاعهم؛ ومستخدمين الآيفون لازم يضيفوا التطبيق للشاشة الرئيسية الأول. التذكيرات بتمشي على مواعيد الروتين، مش ساعات الهدوء.')}
        </div>
      </Panel>

      <Panel theme={T} density={density}>
        {title(s('Time zone', 'المنطقة الزمنية'))}
        {sub(s('Sets when “today” starts for everyone, and the times in routines and the report.', 'بيحدد «النهارده» بيبدأ إمتى للكل، ومواعيد الروتين والتقرير.'))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select value={cfg.timezone || 'Africa/Cairo'} disabled={busy === 'timezone'} aria-label={s('Time zone', 'المنطقة الزمنية')}
            onChange={(e) => save('timezone', e.target.value)} style={{ ...inputStyle(T), maxWidth: 320 }}>
            {zones.map((z) => <option key={z.id} value={z.id}>{lang === 'ar' ? z.ar : z.en}</option>)}
          </select>
          {note('timezone')}
        </div>
      </Panel>
    </>
  );
}

export const RECOGNITION_MODES = RECOGNITION.map((r) => r.id);
