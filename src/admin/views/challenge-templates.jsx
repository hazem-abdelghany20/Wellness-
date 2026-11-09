import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { useChallengeTemplates } from '../hooks/use-challenge-templates.js';
import { HabitCardPreview } from './habit-card-preview.jsx';
import { friendlyErrorI18n } from '../../lib/errors';
import { HABIT_CATEGORIES, habitCategory, mediaFromPayload, parseYouTubeUrl } from '../../shared/habit-meta.js';
import {
  emptyTemplateForm, templateToForm, validateTemplateForm, validateMediaFile,
  mediaUploadError, youtubeError, LIMITS, WINDOW_DAYS, MEDIA_ACCEPT,
} from '../lib/habit-template.js';

// Wellness House admins write weekly habit templates here; company HR picks
// one per week in the HR portal (Challenges). A template is a habit card:
// name, category, the daily action, why it helps, an optional tip, when it
// is checked, days needed to win, an optional article and how-to media.

const pickLang = (lang, en, ar) => (lang === 'ar' ? (ar || en) : (en || ar)) || '';

function mediaLabel(type, s) {
  if (type === 'youtube') return s('YouTube', 'يوتيوب');
  if (type === 'image') return s('Image', 'صورة');
  return s('Video', 'فيديو');
}

function CategoryBadge({ theme, lang, id }) {
  const c = habitCategory(id);
  if (!c) return null;
  return (
    <Badge theme={theme} tone="neutral">
      <span style={{ width: 7, height: 7, borderRadius: 99, background: c.color }}/>
      {lang === 'ar' ? c.ar : c.en}
    </Badge>
  );
}

function MediaBadge({ theme, lang, payload }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const m = mediaFromPayload(payload);
  if (!m) return null;
  return (
    <Badge theme={theme} tone="info">
      <HRIcon name={m.type === 'image' ? 'eye' : 'play'} size={11}/>
      {mediaLabel(m.type, s)}
    </Badge>
  );
}

// ── list card ──────────────────────────────────────────────────

function TemplateCard({ theme, density, lang, t, archived, busy, confirming, onEdit, onAskArchive, onArchive, onCancelArchive, onRestore }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const p = t.payload || {};
  const days = p.success_days ?? t.target ?? 4;
  return (
    <Panel theme={T} density={density} style={{ display: 'flex', flexDirection: 'column', opacity: archived ? 0.75 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ width: 10, height: 10, borderRadius: 99, background: p.badge_color || T.accent }}/>
        <CategoryBadge theme={T} lang={lang} id={p.category}/>
        <MediaBadge theme={T} lang={lang} payload={p}/>
        {archived && <Badge theme={T} tone="caution">{s('Archived', 'مؤرشف')}</Badge>}
      </div>
      <div style={{ fontSize: 15, color: T.text, fontWeight: 700, lineHeight: 1.3 }}>
        {pickLang(lang, t.title_en, t.title_ar) || t.slug}
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>
        {lang === 'ar' ? t.title_en : t.title_ar}
      </div>
      <div style={{
        fontSize: 12, color: T.textMid, lineHeight: 1.5, marginTop: 10, flex: 1,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {pickLang(lang, p.action_en, p.action_ar)}
      </div>
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.divider}` }}>
        {p.check_mode === 'next_morning' ? s('Checked next morning', 'يُسجَّل صباح اليوم التالي') : s('Checked same day', 'يُسجَّل في اليوم نفسه')}
        {' · '}
        <span className="mono">{s(`${days} of ${WINDOW_DAYS} days to win`, `${days} من ${WINDOW_DAYS} أيام للفوز`)}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {archived ? (
          <HRButton theme={T} variant="secondary" size="sm" disabled={busy} onClick={onRestore}>
            {s('Restore', 'استعادة')}
          </HRButton>
        ) : confirming ? (
          <>
            <span style={{ fontSize: 12, color: T.textMid }}>{s('Archive it?', 'أرشفة القالب؟')}</span>
            <HRButton theme={T} variant="danger" size="sm" disabled={busy} onClick={onArchive}>
              {busy ? s('Archiving…', 'جارٍ الأرشفة…') : s('Yes, archive', 'نعم، أرشِف')}
            </HRButton>
            <HRButton theme={T} variant="ghost" size="sm" onClick={onCancelArchive}>{s('No', 'لا')}</HRButton>
          </>
        ) : (
          <>
            <HRButton theme={T} variant="secondary" size="sm" onClick={onEdit}>{s('Edit', 'تعديل')}</HRButton>
            <HRButton theme={T} variant="ghost" size="sm" onClick={onAskArchive}>{s('Archive', 'أرشفة')}</HRButton>
          </>
        )}
      </div>
    </Panel>
  );
}

// ── builder ────────────────────────────────────────────────────

function Field({ theme, label, hint, children, style }) {
  const T = theme;
  return (
    <div style={{ marginBottom: 18, ...style }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

function ErrorText({ theme, lang, error }) {
  if (!error) return null;
  return <div role="alert" style={{ fontSize: 11, color: theme.danger, marginTop: 5 }}>{lang === 'ar' ? error.ar : error.en}</div>;
}

function Choice({ theme, selected, onClick, children, style }) {
  const T = theme;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} style={{
      fontFamily: 'inherit', cursor: 'pointer', textAlign: 'start',
      background: selected ? T.accentSoft : T.panelSunk, color: T.text,
      border: `1.5px solid ${selected ? T.accent : T.border}`, borderRadius: 10,
      padding: '8px 12px', fontSize: 12, fontWeight: 600,
      ...style,
    }}>{children}</button>
  );
}

function TemplateBuilder({ theme, density, lang, template, articles, onSave, onCancel, uploadMedia, discardMedia }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const isEdit = !!template;
  const [form, setForm] = React.useState(() => (template ? templateToForm(template) : emptyTemplateForm()));
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState(null);
  const [upload, setUpload] = React.useState({ progress: null, error: null, name: '' });
  const [previewLang, setPreviewLang] = React.useState(lang);
  const fileRef = React.useRef(null);
  const abortRef = React.useRef(null);
  const pendingPathRef = React.useRef(null); // uploaded here, not saved yet
  const savedRef = React.useRef(false);
  const savingRef = React.useRef(false);
  const uploading = upload.progress != null;

  // Leaving without saving: stop any upload and drop the unsaved file. A
  // save still in flight may reference it, so leave it alone then.
  React.useEffect(() => () => {
    abortRef.current?.abort();
    if (!savedRef.current && !savingRef.current && pendingPathRef.current) discardMedia(pendingPathRef.current);
  }, [discardMedia]);

  const set = (key, value, errKey = key) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[errKey] ? { ...e, [errKey]: undefined } : e));
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
    color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
  };
  const withErr = (key) => (errors[key] ? { ...inputStyle, borderColor: T.danger } : inputStyle);
  const langTag = (code) => (
    <span className="mono" style={{ fontSize: 10, color: T.textFaint, fontWeight: 700, marginBottom: 4, display: 'block' }}>{code}</span>
  );

  // EN / AR pair of inputs or textareas.
  const pair = (base, label, { multiline = false, max, placeholderEn = '', placeholderAr = '', errKey } = {}) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {['en', 'ar'].map((code) => {
        const key = `${base}_${code}`;
        const props = {
          value: form[key], dir: code === 'ar' ? 'rtl' : 'ltr', lang: code, maxLength: max,
          placeholder: code === 'ar' ? placeholderAr : placeholderEn,
          'aria-label': `${label} (${code === 'ar' ? s('Arabic', 'بالعربية') : s('English', 'بالإنجليزية')})`,
          onChange: (e) => set(key, e.target.value, errKey || key),
          style: multiline ? { ...withErr(errKey || key), minHeight: 64, resize: 'vertical', lineHeight: 1.5 } : withErr(errKey || key),
        };
        return (
          <div key={code}>
            {langTag(code === 'ar' ? 'AR' : 'EN')}
            {multiline ? <textarea rows={3} {...props}/> : <input {...props}/>}
            {!errKey && <ErrorText theme={T} lang={lang} error={errors[key]}/>}
          </div>
        );
      })}
    </div>
  );

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    const check = validateMediaFile(file);
    if (!check.ok) { setUpload({ progress: null, error: check.error, name: file.name }); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setUpload({ progress: 0, error: null, name: file.name });
    try {
      const media = await uploadMedia(file, {
        signal: ctrl.signal,
        onProgress: (pct) => setUpload((u) => ({ ...u, progress: pct })),
      });
      const previous = pendingPathRef.current;
      pendingPathRef.current = media.path;
      if (previous) discardMedia(previous);
      set('media', media, 'media');
      setUpload({ progress: null, error: null, name: file.name });
    } catch (err) {
      setUpload({ progress: null, error: mediaUploadError(err), name: file.name });
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }

  function removeMedia() {
    if (pendingPathRef.current) discardMedia(pendingPathRef.current);
    pendingPathRef.current = null;
    set('media', null, 'media');
    setUpload({ progress: null, error: null, name: '' });
  }

  async function submit(e) {
    e.preventDefault();
    const errs = validateTemplateForm(form);
    setErrors(errs);
    setSaveError(null);
    if (Object.keys(errs).length) return;
    setSaving(true);
    savingRef.current = true;
    try {
      await onSave(form);
      savedRef.current = true;
      // An upload that didn't end up on the template is not needed.
      const pending = pendingPathRef.current;
      if (pending && (form.media_mode !== 'upload' || form.media?.path !== pending)) discardMedia(pending);
    } catch (err) {
      if (err?.fieldErrors) setErrors(err.fieldErrors);
      else setSaveError(friendlyErrorI18n(err, lang));
      setSaving(false);
    } finally {
      savingRef.current = false;
    }
  }

  const yt = form.media_mode === 'youtube' && form.youtube_url.trim() ? parseYouTubeUrl(form.youtube_url) : null;
  const selectedArticle = articles.find((a) => a.slug === form.article_slug);
  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap }}>
      <PanelHeader theme={T} density={density}
        title={isEdit ? s('Edit template', 'تعديل القالب') : s('New habit template', 'قالب عادة جديد')}
        subtitle={isEdit
          ? s('Changes apply to weeks HR schedules from now on. New or removed how-to media also reaches weeks still running.',
              'تنطبق التغييرات على الأسابيع التي تُجدوَل من الآن. والوسائط التوضيحية الجديدة أو المحذوفة تصل أيضًا إلى الأسابيع الجارية.')
          : s('One small daily action for a Sunday–Thursday week. HR picks it from their Challenges page.',
              'إجراء يومي صغير لأسبوع من الأحد إلى الخميس. يختاره فريق الموارد البشرية من صفحة التحديات.')}
        right={<HRButton theme={T} variant="ghost" size="sm" icon="close" onClick={onCancel}>{s('Close', 'إغلاق')}</HRButton>}/>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 400px)', gap: 24, padding: DENSITY[density].cardPad, alignItems: 'start' }}>
        <form onSubmit={submit} noValidate>
          <Field theme={T} label={s('Name', 'الاسم')}>
            {pair('name', s('Name', 'الاسم'), { max: LIMITS.name, placeholderEn: 'The Water Bottle', placeholderAr: 'قزازة المية' })}
          </Field>

          <Field theme={T} label={s('Category', 'التصنيف')}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {HABIT_CATEGORIES.map((c) => (
                <Choice key={c.id} theme={T} selected={form.category === c.id} onClick={() => set('category', c.id)}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: c.color, marginInlineEnd: 7 }}/>
                  {lang === 'ar' ? c.ar : c.en}
                </Choice>
              ))}
            </div>
            <ErrorText theme={T} lang={lang} error={errors.category}/>
          </Field>

          <Field theme={T} label={s('The daily action', 'الإجراء اليومي')}
            hint={s('One thing an employee can do and tick off today. Keep it short and concrete.', 'شيء واحد يفعله الموظف ويسجّله اليوم. اجعله قصيرًا ومحددًا.')}>
            {pair('action', s('The daily action', 'الإجراء اليومي'), { multiline: true, max: LIMITS.action })}
          </Field>

          <Field theme={T} label={s('Why it helps', 'لماذا يفيد')}>
            {pair('why', s('Why it helps', 'لماذا يفيد'), { multiline: true, max: LIMITS.why })}
          </Field>

          <Field theme={T} label={s('Tip (optional)', 'نصيحة (اختياري)')}>
            {pair('tip', s('Tip', 'نصيحة'), { max: LIMITS.tip, errKey: 'tip' })}
            <ErrorText theme={T} lang={lang} error={errors.tip}/>
          </Field>

          <Field theme={T} label={s("When it's checked", 'وقت التسجيل')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Choice theme={T} selected={form.check_mode === 'same_day'} onClick={() => set('check_mode', 'same_day')}>
                {s('Same day', 'في اليوم نفسه')}
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400, marginTop: 3 }}>
                  {s('Daytime habits. Employees tap "Did it" that day.', 'للعادات النهارية. يضغط الموظف «عملتها» في اليوم نفسه.')}
                </div>
              </Choice>
              <Choice theme={T} selected={form.check_mode === 'next_morning'} onClick={() => set('check_mode', 'next_morning')}>
                {s('Next morning', 'صباح اليوم التالي')}
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400, marginTop: 3 }}>
                  {s('Evening habits such as sleep. Logged the morning after.', 'للعادات المسائية مثل النوم. تُسجَّل في الصباح التالي.')}
                </div>
              </Choice>
            </div>
            <ErrorText theme={T} lang={lang} error={errors.check_mode}/>
          </Field>

          <Field theme={T} label={s('Days needed to win', 'أيام الفوز المطلوبة')}
            hint={s(`The week runs ${WINDOW_DAYS} days, Sunday to Thursday. Everyone who reaches this gets a bronze reward.`,
                    `يمتد الأسبوع ${WINDOW_DAYS} أيام من الأحد إلى الخميس، ومن يصل إلى هذا العدد يحصل على مكافأة برونزية.`)}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Choice key={n} theme={T} selected={Number(form.success_days) === n} onClick={() => set('success_days', n)}
                  style={{ minWidth: 40, textAlign: 'center' }}>
                  <span className="mono">{n}</span>
                </Choice>
              ))}
              <span style={{ fontSize: 12, color: T.textMid, marginInlineStart: 6 }}>
                {s(`of ${WINDOW_DAYS} days`, `من ${WINDOW_DAYS} أيام`)}
              </span>
            </div>
            <ErrorText theme={T} lang={lang} error={errors.success_days}/>
          </Field>

          <Field theme={T} label={s('Related article (optional)', 'مقال مرتبط (اختياري)')}
            hint={selectedArticle && !selectedArticle.published
              ? s('This article is a draft. Employees will not see the button until it is published.', 'هذا المقال مسودة، ولن يظهر الزر للموظفين حتى يُنشر.')
              : null}>
            <select value={form.article_slug} onChange={(e) => set('article_slug', e.target.value)} style={inputStyle}>
              <option value="">{s('No article', 'بدون مقال')}</option>
              {form.article_slug && !selectedArticle && <option value={form.article_slug}>{form.article_slug}</option>}
              {articles.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {pickLang(lang, a.title_en, a.title_ar) || a.slug}{a.published ? '' : s(' (draft)', ' (مسودة)')}
                </option>
              ))}
            </select>
          </Field>

          <Field theme={T} label={s('How-to media (optional)', 'وسائط توضيحية (اختياري)')}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                ['none', s('No media', 'بدون وسائط')],
                ['upload', s('Upload video or image', 'رفع فيديو أو صورة')],
                ['youtube', s('YouTube link', 'رابط يوتيوب')],
              ].map(([mode, label]) => (
                <Choice key={mode} theme={T} selected={form.media_mode === mode} onClick={() => set('media_mode', mode, 'media')}>
                  {label}
                </Choice>
              ))}
            </div>

            {form.media_mode === 'upload' && (
              <div style={{ border: `1px dashed ${errors.media ? T.danger : T.borderStrong}`, borderRadius: 10, padding: 12 }}>
                <input ref={fileRef} type="file" accept={MEDIA_ACCEPT} onChange={onPickFile} style={{ display: 'none' }}
                  aria-label={s('Choose a video or image', 'اختر فيديو أو صورة')}/>
                {uploading ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textMid, marginBottom: 6, gap: 8 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s('Uploading', 'جارٍ رفع')} {upload.name}</span>
                      <span className="mono">{upload.progress}%</span>
                    </div>
                    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={upload.progress}
                      style={{ height: 6, borderRadius: 99, background: T.panelSunk, overflow: 'hidden' }}>
                      <div style={{ width: `${upload.progress}%`, height: '100%', background: T.accent, transition: 'width .2s' }}/>
                    </div>
                    <HRButton theme={T} variant="ghost" size="sm" style={{ marginTop: 8 }} onClick={() => abortRef.current?.abort()}>
                      {s('Cancel upload', 'إلغاء الرفع')}
                    </HRButton>
                  </div>
                ) : form.media ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Badge theme={T} tone="info">
                      <HRIcon name={form.media.type === 'image' ? 'eye' : 'play'} size={11}/>
                      {mediaLabel(form.media.type, s)}
                    </Badge>
                    <span className="mono" style={{ fontSize: 11, color: T.textMuted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(form.media.path || form.media.url).split('/').pop()}
                    </span>
                    <HRButton theme={T} variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>{s('Replace', 'استبدال')}</HRButton>
                    <HRButton theme={T} variant="ghost" size="sm" onClick={removeMedia}>{s('Remove', 'إزالة')}</HRButton>
                  </div>
                ) : (
                  <HRButton theme={T} variant="secondary" size="sm" icon="plus" onClick={() => fileRef.current?.click()}>
                    {s('Choose a file', 'اختر ملفًا')}
                  </HRButton>
                )}
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 8, lineHeight: 1.5 }}>
                  {s('One MP4 or MOV video, or one PNG or JPEG image, up to 50 MB. MP4 plays on every phone; some Android phones cannot play MOV.',
                     'فيديو واحد MP4 أو MOV، أو صورة واحدة PNG أو JPEG، حتى 50 ميجابايت. يعمل MP4 على كل الهواتف، وقد لا تشغّل بعض هواتف أندرويد ملفات MOV.')}
                </div>
                <ErrorText theme={T} lang={lang} error={upload.error}/>
              </div>
            )}

            {form.media_mode === 'youtube' && (
              <div>
                <input value={form.youtube_url} dir="ltr" inputMode="url" placeholder="https://youtu.be/…"
                  aria-label={s('YouTube link', 'رابط يوتيوب')}
                  onChange={(e) => set('youtube_url', e.target.value, 'media')}
                  style={withErr('media')}/>
                {yt && !errors.media && (
                  <div style={{ fontSize: 11, marginTop: 5, color: yt.ok ? T.positive : T.danger }}>
                    {yt.ok ? s('YouTube video found.', 'تم العثور على فيديو يوتيوب.') : (lang === 'ar' ? youtubeError(yt.reason).ar : youtubeError(yt.reason).en)}
                  </div>
                )}
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>
                  {s('Paste a youtube.com, youtu.be or Shorts link. Only the video ID is stored; it plays inside the app.',
                     'الصق رابطًا من youtube.com أو youtu.be أو Shorts. يُحفظ معرّف الفيديو فقط ويُعرض داخل التطبيق.')}
                </div>
              </div>
            )}
            <ErrorText theme={T} lang={lang} error={errors.media}/>
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 14, borderTop: `1px solid ${T.divider}` }}>
            <HRButton theme={T} type="submit" variant="primary" disabled={saving || uploading} icon={isEdit ? 'check' : 'plus'}>
              {saving ? s('Saving…', 'جارٍ الحفظ…') : isEdit ? s('Save changes', 'احفظ التغييرات') : s('Create template', 'أنشئ القالب')}
            </HRButton>
            <HRButton theme={T} variant="ghost" onClick={onCancel}>{s('Cancel', 'إلغاء')}</HRButton>
            {uploading && <span style={{ fontSize: 12, color: T.textMuted }}>{s('Wait for the upload to finish.', 'انتظر حتى ينتهي الرفع.')}</span>}
            {hasErrors && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{s('Fix the highlighted fields.', 'صحّح الحقول المحددة.')}</span>}
            {saveError && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{saveError}</span>}
          </div>
        </form>

        <div style={{ position: 'sticky', top: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {s('Employee preview', 'معاينة الموظف')}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['en', 'ar'].map((code) => (
                <Choice key={code} theme={T} selected={previewLang === code} onClick={() => setPreviewLang(code)} style={{ padding: '3px 9px', fontSize: 11 }}>
                  {code === 'ar' ? 'العربية' : 'English'}
                </Choice>
              ))}
            </div>
          </div>
          <HabitCardPreview form={form} existingPayload={template?.payload} lang={previewLang}/>
        </div>
      </div>
    </Panel>
  );
}

// ── page ───────────────────────────────────────────────────────

function AdminChallengeTemplatesView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const {
    habitTemplates, archivedTemplates, articles, loading, error,
    save, archive, restore, uploadMedia, discardMedia,
  } = useChallengeTemplates();
  const [editing, setEditing] = React.useState(null); // { template, key } | null
  const [flash, setFlash] = React.useState(null);
  const [confirmId, setConfirmId] = React.useState(null);
  const [busyId, setBusyId] = React.useState(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const builderRef = React.useRef(null);

  const open = (template) => {
    setFlash(null); setConfirmId(null);
    setEditing({ template, key: `${template?.id || 'new'}-${Date.now()}` });
    requestAnimationFrame(() => builderRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  };

  async function handleSave(form) {
    const existing = editing?.template || null;
    await save(form, existing);
    setEditing(null);
    setFlash({ kind: 'ok', text: existing ? s('Template saved.', 'تم حفظ القالب.') : s('Template created. HR can pick it now.', 'تم إنشاء القالب، ويمكن لفريق الموارد البشرية اختياره الآن.') });
  }

  async function run(id, fn, okText) {
    setBusyId(id); setFlash(null);
    try { await fn(id); setFlash({ kind: 'ok', text: okText }); }
    catch (e) { setFlash({ kind: 'err', text: friendlyErrorI18n(e, lang) }); }
    finally { setBusyId(null); setConfirmId(null); }
  }

  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: DENSITY[density].gap };

  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Challenge templates', 'قوالب التحديات')}
        title={s('Habit library', 'مكتبة العادات')}
        sub={loading
          ? s('Loading…', 'جارٍ التحميل…')
          : s(`${habitTemplates.length} weekly habits · HR picks one per week`, `${habitTemplates.length} عادة أسبوعية · يختار فريق الموارد البشرية واحدة كل أسبوع`)}
        right={!loading && !editing ? (
          <HRButton theme={T} variant="primary" icon="plus" onClick={() => open(null)}>{s('New template', 'قالب جديد')}</HRButton>
        ) : null}/>

      <div style={{ height: DENSITY[density].gap }}/>

      {error && (
        <Panel theme={T} density={density} style={{ marginBottom: DENSITY[density].gap }}>
          <div style={{ fontSize: 13, color: T.danger }}>{friendlyErrorI18n(error, lang)}</div>
        </Panel>
      )}
      {flash && (
        <div role="status" style={{ fontSize: 13, marginBottom: 12, color: flash.kind === 'ok' ? T.positive : T.danger }}>{flash.text}</div>
      )}

      <div ref={builderRef}>
        {editing && (
          <TemplateBuilder key={editing.key} theme={T} density={density} lang={lang}
            template={editing.template} articles={articles}
            onSave={handleSave} onCancel={() => setEditing(null)}
            uploadMedia={uploadMedia} discardMedia={discardMedia}/>
        )}
      </div>

      {loading ? (
        <Panel theme={T} density={density}>
          <div style={{ padding: 48, display: 'grid', placeItems: 'center', color: T.textMuted, fontSize: 13 }}>
            {s('Loading…', 'جارٍ التحميل…')}
          </div>
        </Panel>
      ) : habitTemplates.length === 0 ? (
        <Panel theme={T} density={density}>
          <div style={{ padding: 32, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
            {s('No habit templates yet. Create the first one.', 'لا توجد قوالب عادات بعد. أنشئ أول قالب.')}
          </div>
        </Panel>
      ) : (
        <div style={grid}>
          {habitTemplates.map((t) => (
            <TemplateCard key={t.id} theme={T} density={density} lang={lang} t={t}
              busy={busyId === t.id} confirming={confirmId === t.id}
              onEdit={() => open(t)}
              onAskArchive={() => setConfirmId(t.id)}
              onCancelArchive={() => setConfirmId(null)}
              onArchive={() => run(t.id, archive, s('Archived. HR no longer sees it; weeks already scheduled keep running.', 'تمت الأرشفة. لن يظهر لفريق الموارد البشرية، والأسابيع المجدولة تستمر كما هي.'))}/>
          ))}
        </div>
      )}

      {!loading && archivedTemplates.length > 0 && (
        <div style={{ marginTop: DENSITY[density].gap }}>
          <HRButton theme={T} variant="ghost" size="sm" iconR={showArchived ? 'chevUp' : 'chevDown'} onClick={() => setShowArchived((v) => !v)}>
            {s(`Archived (${archivedTemplates.length})`, `المؤرشفة (${archivedTemplates.length})`)}
          </HRButton>
          {showArchived && (
            <div style={{ ...grid, marginTop: 12 }}>
              {archivedTemplates.map((t) => (
                <TemplateCard key={t.id} theme={T} density={density} lang={lang} t={t} archived
                  busy={busyId === t.id}
                  onRestore={() => run(t.id, restore, s('Restored. HR can pick it again.', 'تمت الاستعادة، ويمكن لفريق الموارد البشرية اختياره مجددًا.'))}/>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export { AdminChallengeTemplatesView };
