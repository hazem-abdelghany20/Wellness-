import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader } from '../../shared/components.jsx';
import { Field, Choice, LangPair, inputStyle } from '../../shared/authoring/ui.jsx';
import {
  emptyContentForm, contentToForm, validateContentForm, buildContentInput, CONTENT_CATEGORIES, CONTENT_LIMITS,
} from '../../shared/authoring/content-form.js';
import { libraryError } from '../../shared/authoring/errors.js';
import { clean, fmtNum } from '../../shared/authoring/text.js';

// Write or edit one of the company's own articles or facts.
export function ContentEditor({ theme, lang, density, item, onSave, onCancel }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const isEdit = !!item?.id;
  const [form, setForm] = React.useState(() => (item ? contentToForm(item) : emptyContentForm()));
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(null);
  const [saveError, setSaveError] = React.useState(null);
  const fact = form.kind === 'fact';

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  async function save(status) {
    const errs = validateContentForm(form);
    setErrors(errs); setSaveError(null);
    if (Object.keys(errs).length) return;
    setSaving(status);
    try {
      await onSave(buildContentInput(form, status));
    } catch (err) {
      if (err?.fieldErrors) setErrors(err.fieldErrors);
      else setSaveError(libraryError(err, lang));
      setSaving(null);
    }
  }

  const factLeft = (k) => CONTENT_LIMITS.fact - clean(form[k]).length;

  return (
    <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap }}>
      <PanelHeader theme={T} density={density}
        title={isEdit ? s('Edit', 'تعديل') : s('Write for your company', 'اكتب لشركتك')}
        subtitle={s('Only your company sees it. Employees find it in their Library.', 'شركتك بس اللي بتشوفه. الموظفين بيلاقوه في المكتبة.')}
        right={<HRButton theme={T} variant="ghost" size="sm" icon="close" onClick={onCancel}>{s('Close', 'قفل')}</HRButton>}/>
      <form noValidate aria-label={s('Write', 'اكتب')} onSubmit={(e) => { e.preventDefault(); save('published'); }} style={{ padding: DENSITY[density].cardPad, maxWidth: 860 }}>
        <Field theme={T} label={s('What is it?', 'ده إيه؟')}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Choice theme={T} selected={!fact} onClick={() => set('kind', 'article')}>
              {s('Article', 'مقال')}
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400, marginTop: 2 }}>{s('A short read with a title and text.', 'قراية قصيرة بعنوان ونص.')}</div>
            </Choice>
            <Choice theme={T} selected={fact} onClick={() => set('kind', 'fact')}>
              {s('Fact', 'معلومة')}
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400, marginTop: 2 }}>{s('One or two lines, shown as a card.', 'سطر أو اتنين، بتظهر ككارت.')}</div>
            </Choice>
          </div>
        </Field>

        <Field theme={T} label={s('Title', 'العنوان')}>
          <LangPair theme={T} lang={lang} form={form} base="title" label={s('Title', 'العنوان')} onChange={set} errors={errors} max={CONTENT_LIMITS.title}
            placeholderEn={fact ? 'Did you know?' : 'Five desk stretches'} placeholderAr={fact ? 'تعرف إن…؟' : 'خمس تمارين للمكتب'}/>
        </Field>

        {fact ? (
          <Field theme={T} label={s('The fact', 'المعلومة')} hint={s('Up to 300 characters in each language.', 'لحد ٣٠٠ حرف في كل لغة.')}>
            <LangPair theme={T} lang={lang} form={form} base="body" label={s('The fact', 'المعلومة')} onChange={set} errors={errors}
              multiline rows={3} max={CONTENT_LIMITS.fact}
              placeholderEn="Standing up every 30 minutes helps your back more than one long walk." placeholderAr="إنك تقوم كل نص ساعة بيفيد ضهرك أكتر من مشية طويلة."/>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: T.textMuted, marginTop: 4 }} className="mono">
              <span>EN {fmtNum(factLeft('body_en'), lang)}</span><span>AR {fmtNum(factLeft('body_ar'), lang)}</span>
            </div>
          </Field>
        ) : (
          <>
            <Field theme={T} lang={lang} optional label={s('One-line summary', 'ملخص في سطر')}>
              <LangPair theme={T} lang={lang} form={form} base="description" label={s('Summary', 'الملخص')} onChange={set} errors={errors} max={CONTENT_LIMITS.description}/>
            </Field>
            <Field theme={T} label={s('Text', 'النص')} hint={s('Write in one language or both. Employees see their language first.', 'اكتب بلغة واحدة أو الاتنين. الموظف بيشوف لغته الأول.')}>
              <LangPair theme={T} lang={lang} form={form} base="body" label={s('Text', 'النص')} onChange={set} errors={errors} multiline rows={8} max={CONTENT_LIMITS.body}/>
            </Field>
            <Field theme={T} label={s('Topic', 'الموضوع')}>
              <select value={form.category} onChange={(e) => set('category', e.target.value)} aria-label={s('Topic', 'الموضوع')} style={{ ...inputStyle(T), maxWidth: 260 }}>
                {CONTENT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{lang === 'ar' ? c.ar : c.en}</option>)}
              </select>
            </Field>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 14, borderTop: `1px solid ${T.divider}` }}>
          <HRButton theme={T} type="submit" variant="primary" icon="check" disabled={!!saving}>
            {saving === 'published' ? s('Publishing…', 'جارٍ النشر…') : s('Publish', 'انشر')}
          </HRButton>
          <HRButton theme={T} variant="secondary" disabled={!!saving} onClick={() => save('draft')}>
            {saving === 'draft' ? s('Saving…', 'جارٍ الحفظ…') : s('Save as draft', 'احفظ كمسودة')}
          </HRButton>
          <HRButton theme={T} variant="ghost" onClick={onCancel}>{s('Cancel', 'إلغاء')}</HRButton>
          {Object.values(errors).some(Boolean) && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{s('Fix the highlighted fields.', 'صلّح الخانات اللي متعلّم عليها.')}</span>}
          {saveError && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{saveError}</span>}
        </div>
      </form>
    </Panel>
  );
}
