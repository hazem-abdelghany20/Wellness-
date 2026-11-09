import React from 'react';
import { BODY_AREAS } from '../../lib/supabase-routines';
import { DENSITY } from '../tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge } from '../components.jsx';
import { Field, ErrorText, Choice, LangPair, inputStyle } from './ui.jsx';
import { MediaField, MediaPreview, usePendingUploads, formMediaFields } from './media-field.jsx';
import {
  emptyExerciseForm, exerciseToForm, validateExerciseForm, buildExerciseInput, toggleArea,
  bodyAreaLabel, SETS_REPS_PICKS, EXERCISE_LIMITS,
} from './exercise-form.js';
import { libraryError } from './errors.js';
import { pickLang } from './text.js';

// Add / edit one exercise: name, how to do it, what it helps, body areas,
// sets × reps, and a demo (upload, YouTube or none), with a live preview.
// isPublic: Wellness House admin writing a public exercise.
export function ExerciseEditor({ theme, lang, density = 'comfortable', exercise, isPublic = false, media, onSave, onCancel }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const isEdit = !!exercise?.id;
  const [form, setForm] = React.useState(() => (exercise ? exerciseToForm(exercise) : emptyExerciseForm()));
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
    const errs = validateExerciseForm(form);
    setErrors(errs);
    setSaveError(null);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const keep = form.media.mode === 'upload' && form.media.file?.path ? [form.media.file.path] : [];
      return await pending.saving(keep, () => onSave(buildExerciseInput(form, { isPublic })));
    } catch (err) {
      if (err?.fieldErrors) setErrors(err.fieldErrors);
      else setSaveError(libraryError(err, lang));
      setSaving(false);
    }
    return undefined;
  }

  const pv = (en, ar) => (previewLang === 'ar' ? (ar || en) : (en || ar));
  const fields = formMediaFields(form.media);
  const hasErrors = Object.values(errors).some(Boolean);
  const title = pv(form.name_en, form.name_ar);

  return (
    <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap }}>
      <PanelHeader theme={T} density={density}
        title={isEdit ? s('Edit exercise', 'تعديل التمرين') : s('Add an exercise', 'ضيف تمرين')}
        subtitle={isPublic
          ? s('Public: every company can use it in their routines.', 'عام: كل الشركات تقدر تستخدمه في الروتين.')
          : s('Only your company sees it. Use it in any routine.', 'شركتك بس اللي بتشوفه. استخدمه في أي روتين.')}
        right={<HRButton theme={T} variant="ghost" size="sm" icon="close" onClick={onCancel}>{s('Close', 'قفل')}</HRButton>}/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 24, padding: DENSITY[density].cardPad, alignItems: 'start' }}>
        <form onSubmit={submit} noValidate aria-label={s('Exercise', 'التمرين')}>
          <Field theme={T} label={s('Name', 'الاسم')}>
            <LangPair theme={T} lang={lang} form={form} base="name" label={s('Name', 'الاسم')} onChange={set} errors={errors}
              max={EXERCISE_LIMITS.name} placeholderEn="Neck release" placeholderAr="فك الرقبة"/>
          </Field>

          <Field theme={T} lang={lang} optional label={s('Sets × reps', 'المجموعات × التكرار')}
            hint={s('As the coach wrote it. Routines can change it per row.', 'زي ما المدرب كاتبها. تقدر تغيّرها في كل صف في الروتين.')}>
            <input value={form.sets_reps} onChange={(e) => set('sets_reps', e.target.value)} maxLength={EXERCISE_LIMITS.setsReps}
              placeholder="2 × 10" aria-label={s('Sets × reps', 'المجموعات × التكرار')} style={{ ...inputStyle(T, !!errors.sets_reps), maxWidth: 220 }}/>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {SETS_REPS_PICKS.map((p) => (
                <Choice key={p} theme={T} selected={form.sets_reps === p} onClick={() => set('sets_reps', p)} style={{ padding: '4px 10px', fontSize: 11 }}>
                  <span dir="ltr">{p}</span>
                </Choice>
              ))}
            </div>
            <ErrorText theme={T} lang={lang} error={errors.sets_reps}/>
          </Field>

          <Field theme={T} lang={lang} optional label={s('Body areas', 'مناطق الجسم')}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {BODY_AREAS.map((a) => (
                <Choice key={a.id} theme={T} selected={form.body_areas.includes(a.id)} onClick={() => set('body_areas', toggleArea(form.body_areas, a.id))}
                  style={{ padding: '5px 10px', fontSize: 12 }}>
                  {lang === 'ar' ? a.ar : a.en}
                </Choice>
              ))}
            </div>
            <ErrorText theme={T} lang={lang} error={errors.body_areas}/>
          </Field>

          <Field theme={T} lang={lang} optional label={s('Demo', 'فيديو الشرح')}>
            <MediaField theme={T} lang={lang} value={form.media} media={media} folder="exercises" pending={pending}
              error={errors.media} onUploadingChange={setUploading}
              onChange={(m) => { setForm((f) => ({ ...f, media: m })); setErrors((e) => ({ ...e, media: undefined })); }}/>
          </Field>

          <Field theme={T} lang={lang} optional label={s('How to do it', 'إزاي تعمله')}>
            <LangPair theme={T} lang={lang} form={form} base="how" label={s('How to do it', 'إزاي تعمله')} onChange={set} errors={errors}
              multiline rows={2} max={EXERCISE_LIMITS.how}
              placeholderEn="Sit tall. Tilt your head to one side, hold 10 seconds." placeholderAr="اقعد مفرود. ميّل راسك لجنب، واثبت ١٠ ثواني."/>
          </Field>

          <Field theme={T} lang={lang} optional label={s('What it helps', 'بيفيد في إيه')}>
            <LangPair theme={T} lang={lang} form={form} base="helps" label={s('What it helps', 'بيفيد في إيه')} onChange={set} errors={errors}
              max={EXERCISE_LIMITS.helps} placeholderEn="A stiff neck after screen time" placeholderAr="شد الرقبة بعد الشاشة"/>
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 14, borderTop: `1px solid ${T.divider}` }}>
            <HRButton theme={T} type="submit" variant="primary" disabled={saving || uploading} icon={isEdit ? 'check' : 'plus'}>
              {saving ? s('Saving…', 'جارٍ الحفظ…') : isEdit ? s('Save changes', 'احفظ التغييرات') : s('Add exercise', 'ضيف التمرين')}
            </HRButton>
            <HRButton theme={T} variant="ghost" onClick={onCancel}>{s('Cancel', 'إلغاء')}</HRButton>
            {uploading && <span style={{ fontSize: 12, color: T.textMuted }}>{s('Wait for the upload to finish.', 'استنى الرفع يخلص.')}</span>}
            {hasErrors && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{s('Fix the highlighted fields.', 'صلّح الخانات اللي متعلّم عليها.')}</span>}
            {saveError && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{saveError}</span>}
          </div>
        </form>

        <div style={{ position: 'sticky', top: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {s('What employees see', 'اللي الموظف بيشوفه')}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['en', 'ar'].map((code) => (
                <Choice key={code} theme={T} selected={previewLang === code} onClick={() => setPreviewLang(code)} style={{ padding: '3px 9px', fontSize: 11 }}>
                  {code === 'ar' ? 'العربية' : 'English'}
                </Choice>
              ))}
            </div>
          </div>
          <div dir={previewLang === 'ar' ? 'rtl' : 'ltr'} style={{ background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: title ? T.text : T.textFaint }}>
                {title || (previewLang === 'ar' ? 'اسم التمرين' : 'Exercise name')}
              </div>
              {form.sets_reps && <div className="mono" dir="ltr" style={{ fontSize: 13, color: T.textMid }}>{pv(form.sets_reps, form.sets_reps_ar)}</div>}
            </div>
            {form.body_areas.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                {form.body_areas.map((a) => <Badge key={a} theme={T} tone="neutral">{bodyAreaLabel(a, previewLang)}</Badge>)}
              </div>
            )}
            <MediaPreview theme={T} lang={previewLang} fields={fields} resolve={media?.resolve} title={title}
              emptyText={previewLang === 'ar' ? 'مفيش فيديو. الموظف هيشوف الاسم والعدد بس.' : 'No demo. Employees see the name and sets × reps only.'}/>
            {pv(form.how_en, form.how_ar) && (
              <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.55, marginTop: 12 }}>{pv(form.how_en, form.how_ar)}</div>
            )}
            {pv(form.helps_en, form.helps_ar) && (
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>
                <strong>{previewLang === 'ar' ? 'بيفيد في: ' : 'Helps with: '}</strong>{pv(form.helps_en, form.helps_ar)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function exerciseTitle(ex, lang) {
  return pickLang(lang, ex?.name_en, ex?.name_ar);
}
