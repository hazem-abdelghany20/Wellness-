import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader } from '../../shared/components.jsx';
import { Field, Choice, ErrorText, LangPair } from '../../shared/authoring/ui.jsx';
import { MediaField, MediaPreview, usePendingUploads, formMediaFields } from '../../shared/authoring/media-field.jsx';
import {
  emptyChallengeForm, challengeToForm, validateChallengeForm, buildChallengeInput, setWeeks,
  challengeDays, CHALLENGE_LIMITS, MAX_WEEKS,
} from '../../shared/authoring/challenge-form.js';
import { libraryError } from '../../shared/authoring/errors.js';
import { fmtNum, fmtDate, upcomingSunday, localTodayIso } from '../../shared/authoring/text.js';
import { hrMedia } from '../lib/library-api.js';

// HR's own habit challenge: name, the daily action, why, a tip, 1–4 weeks
// (Sun–Thu), days needed to win, optional how-to media. Scheduled like any
// Wellness House challenge.
export function ChallengeBuilder({ theme, lang, density, template, onSave, onCancel, media = hrMedia, today = localTodayIso() }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const isEdit = !!template?.id;
  const [form, setForm] = React.useState(() => (template ? challengeToForm(template) : emptyChallengeForm()));
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);
  const [previewLang, setPreviewLang] = React.useState(lang);
  const pending = usePendingUploads(media?.discard);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  async function submit(e) {
    e.preventDefault();
    const errs = validateChallengeForm(form);
    setErrors(errs); setSaveError(null);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const keep = form.media.mode === 'upload' && form.media.file?.path ? [form.media.file.path] : [];
      await pending.saving(keep, () => onSave(buildChallengeInput(form)));
    } catch (err) {
      if (err?.fieldErrors) setErrors(err.fieldErrors);
      else setSaveError(libraryError(err, lang));
      setSaving(false);
    }
  }

  const total = form.weeks * 5;
  const pv = (k) => (previewLang === 'ar' ? (form[`${k}_ar`] || form[`${k}_en`]) : (form[`${k}_en`] || form[`${k}_ar`])) || '';
  // The days the challenge would run if it started on the coming Sunday:
  // workdays only, week by week (same as the server's days[]).
  const start = upcomingSunday(today);
  const days = challengeDays(start, form.weeks);
  const weeks = [];
  for (let i = 0; i < days.length; i += 5) weeks.push(days.slice(i, i + 5));
  const fields = formMediaFields(form.media);

  return (
    <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap }}>
      <PanelHeader theme={T} density={density}
        title={isEdit ? s('Edit your challenge', 'تعديل التحدي') : s('Create your own challenge', 'اعمل تحدي بتاعك')}
        subtitle={s('Only your company sees it. After saving, pick its first week below.', 'شركتك بس اللي بتشوفه. بعد الحفظ، اختار أول أسبوع ليه تحت.')}
        right={<HRButton theme={T} variant="ghost" size="sm" icon="close" onClick={onCancel}>{s('Close', 'قفل')}</HRButton>}/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, padding: DENSITY[density].cardPad, alignItems: 'start' }}>
        <form onSubmit={submit} noValidate aria-label={s('Challenge', 'التحدي')}>
          <Field theme={T} label={s('Name', 'الاسم')}>
            <LangPair theme={T} lang={lang} form={form} base="title" label={s('Name', 'الاسم')} onChange={set} errors={errors}
              max={CHALLENGE_LIMITS.title} placeholderEn="Drink water" placeholderAr="اشرب مية"/>
          </Field>
          <Field theme={T} label={s('The daily action', 'الفعل اليومي')} hint={s('One thing people can do and tick each workday.', 'حاجة واحدة الناس تعملها وتعلّم عليها كل يوم شغل.')}>
            <LangPair theme={T} lang={lang} form={form} base="action" label={s('The daily action', 'الفعل اليومي')} onChange={set} errors={errors}
              multiline rows={2} max={CHALLENGE_LIMITS.action} placeholderEn="Drink 6 glasses of water before you leave work." placeholderAr="اشرب ٦ كوبايات مية قبل ما تمشي من الشغل."/>
          </Field>
          <Field theme={T} lang={lang} optional label={s('Why it helps', 'ليه مفيد')}>
            <LangPair theme={T} lang={lang} form={form} base="why" label={s('Why it helps', 'ليه مفيد')} onChange={set} errors={errors} multiline rows={2} max={CHALLENGE_LIMITS.why}/>
          </Field>
          <Field theme={T} lang={lang} optional label={s('Tip', 'نصيحة')}>
            <LangPair theme={T} lang={lang} form={form} base="tip" label={s('Tip', 'نصيحة')} onChange={set} errors={errors} max={CHALLENGE_LIMITS.tip}/>
          </Field>

          <Field theme={T} label={s('How long', 'المدة')} hint={s('Sunday to Thursday each week. Friday and Saturday don’t count.', 'من الأحد للخميس كل أسبوع. الجمعة والسبت مش محسوبين.')}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Array.from({ length: MAX_WEEKS }, (_, i) => i + 1).map((w) => (
                <Choice key={w} theme={T} selected={form.weeks === w} onClick={() => { setForm((f) => setWeeks(f, w)); setErrors((e) => ({ ...e, weeks: undefined, success_days: undefined })); }}>
                  {s(`${w} ${w === 1 ? 'week' : 'weeks'}`, w === 1 ? 'أسبوع' : w === 2 ? 'أسبوعين' : `${fmtNum(w, 'ar')} أسابيع`)}
                </Choice>
              ))}
            </div>
            <ErrorText theme={T} lang={lang} error={errors.weeks}/>
          </Field>

          <Field theme={T} label={s('Days needed to win', 'أيام الفوز')}
            hint={s(`Everyone who does it on this many of the ${total} workdays gets a bronze reward.`, `كل اللي يعملها العدد ده من ${fmtNum(total, 'ar')} يوم شغل ياخد مكافأة برونزية.`)}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min={1} max={total} value={form.success_days} aria-label={s('Days needed to win', 'أيام الفوز')}
                onChange={(e) => { setForm((f) => ({ ...f, success_days: e.target.value === '' ? '' : Number(e.target.value), success_touched: true })); setErrors((er) => ({ ...er, success_days: undefined })); }}
                style={{ width: 80, boxSizing: 'border-box', padding: '8px 10px', background: T.panelSunk, border: `1px solid ${errors.success_days ? T.danger : T.border}`, borderRadius: 9, color: T.text, fontSize: 13, fontFamily: 'inherit' }}/>
              <span style={{ fontSize: 13, color: T.textMid }}>{s(`of ${total} days`, `من ${fmtNum(total, 'ar')} يوم`)}</span>
            </div>
            <ErrorText theme={T} lang={lang} error={errors.success_days}/>
          </Field>

          <Field theme={T} lang={lang} optional label={s('How-to video or picture', 'فيديو أو صورة توضيحية')}>
            <MediaField theme={T} lang={lang} value={form.media} media={media} folder="challenges" pending={pending}
              error={errors.media} onUploadingChange={setUploading}
              onChange={(m) => { setForm((f) => ({ ...f, media: m })); setErrors((er) => ({ ...er, media: undefined })); }}/>
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 14, borderTop: `1px solid ${T.divider}` }}>
            <HRButton theme={T} type="submit" variant="primary" icon="check" disabled={saving || uploading}>
              {saving ? s('Saving…', 'جارٍ الحفظ…') : isEdit ? s('Save changes', 'احفظ التغييرات') : s('Create challenge', 'اعمل التحدي')}
            </HRButton>
            <HRButton theme={T} variant="ghost" onClick={onCancel}>{s('Cancel', 'إلغاء')}</HRButton>
            {Object.values(errors).some(Boolean) && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{s('Fix the highlighted fields.', 'صلّح الخانات اللي متعلّم عليها.')}</span>}
            {saveError && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{saveError}</span>}
          </div>
        </form>

        <div style={{ position: 'sticky', top: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{s('What employees see', 'اللي الموظف بيشوفه')}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['en', 'ar'].map((code) => (
                <Choice key={code} theme={T} selected={previewLang === code} onClick={() => setPreviewLang(code)} style={{ padding: '3px 9px', fontSize: 11 }}>
                  {code === 'ar' ? 'العربية' : 'English'}
                </Choice>
              ))}
            </div>
          </div>
          <div dir={previewLang === 'ar' ? 'rtl' : 'ltr'} style={{ background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: pv('title') ? T.text : T.textFaint }}>{pv('title') || (previewLang === 'ar' ? 'اسم التحدي' : 'Challenge name')}</div>
            <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.55, marginTop: 8 }}>{pv('action') || (previewLang === 'ar' ? 'الفعل اليومي هيظهر هنا.' : 'The daily action shows here.')}</div>
            <MediaPreview theme={T} lang={previewLang} fields={fields} resolve={media?.resolve} title={pv('title')}/>
            <div style={{ marginTop: 14 }}>
              {weeks.map((wk, wi) => (
                <div key={wk[0]} style={{ marginTop: wi ? 10 : 0 }}>
                  {weeks.length > 1 && (
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>
                      {previewLang === 'ar' ? `الأسبوع ${fmtNum(wi + 1, 'ar')}` : `Week ${wi + 1}`}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {wk.map((d) => (
                      <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 999, border: `2px solid ${T.borderStrong}` }}/>
                        <div style={{ fontSize: 10, color: T.textMuted }}>{fmtDate(d, previewLang, { weekday: 'short' })}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', marginTop: 12 }}>
              {previewLang === 'ar' ? `٠ من ${fmtNum(Number(form.success_days) || 0, 'ar')} يوم للمكافأة` : `0 of ${Number(form.success_days) || 0} days for the reward`}
            </div>
            {pv('why') && <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.5, marginTop: 12 }}>{pv('why')}</div>}
            {pv('tip') && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}><strong>{previewLang === 'ar' ? 'نصيحة: ' : 'Tip: '}</strong>{pv('tip')}</div>}
          </div>
        </div>
      </div>
    </Panel>
  );
}
