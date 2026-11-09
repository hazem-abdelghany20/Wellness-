import React from 'react';
import { WEEKDAYS } from '../../lib/supabase-routines';
import { parseYouTubeUrl } from '../habit-meta.js';
import { DENSITY } from '../tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader } from '../components.jsx';
import { Field, ErrorText, Choice, LangPair, inputStyle } from './ui.jsx';
import { SourceFileField, usePendingUploads } from './media-field.jsx';
import {
  emptyRoutineForm, routineToForm, validateRoutineForm, buildRoutineInput, routineErrorCount,
  newRowAfter, moveRow, sortRowsByTime, toggleWorkday, weekdayLabel, previewDay, dayFocus, ROUTINE_LIMITS,
} from './routine-form.js';
import { libraryError } from './errors.js';
import { pickLang, fmtNum } from './text.js';

const NEW = '__new';
const TEXT = '__text';

// Add an exercise without leaving the routine: name, sets × reps, YouTube.
function QuickAddExercise({ theme, lang, onCreate, onCancel }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const [name, setName] = React.useState('');
  const [sets, setSets] = React.useState('');
  const [yt, setYt] = React.useState('');
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  async function add() {
    if (!name.trim()) { setError(s('Add the name.', 'اكتب الاسم.')); return; }
    const parsed = yt.trim() ? parseYouTubeUrl(yt) : null;
    if (parsed && !parsed.ok) { setError(s('That is not a YouTube video link.', 'ده مش لينك فيديو يوتيوب.')); return; }
    setBusy(true); setError(null);
    try {
      await onCreate({
        name_en: name.trim(), default_sets_reps: sets.trim() || null, body_areas: [],
        media_type: parsed ? 'youtube' : null, media_youtube_id: parsed ? parsed.id : null,
        media_bucket: null, media_path: null, media_mime: null,
      });
    } catch (e) { setError(libraryError(e, lang)); setBusy(false); }
  }
  return (
    <div role="group" aria-label={s('New exercise', 'تمرين جديد')} style={{ gridColumn: '1 / -1', background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginTop: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>{s('New exercise', 'تمرين جديد')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={s('Name, e.g. Wall push-ups', 'الاسم، مثلاً ضغط على الحيطة')}
          aria-label={s('New exercise name', 'اسم التمرين الجديد')} style={inputStyle(T)} maxLength={120}/>
        <input value={sets} onChange={(e) => setSets(e.target.value)} placeholder="2 × 10" aria-label={s('New exercise sets × reps', 'عدد التمرين الجديد')} style={inputStyle(T)} maxLength={60}/>
        <input value={yt} onChange={(e) => setYt(e.target.value)} placeholder={s('YouTube link (optional)', 'لينك يوتيوب (اختياري)')} dir="ltr"
          aria-label={s('New exercise YouTube link', 'لينك يوتيوب للتمرين الجديد')} style={inputStyle(T)}/>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <HRButton theme={T} size="sm" variant="primary" icon="plus" disabled={busy} onClick={add}>{busy ? s('Adding…', 'جارٍ الإضافة…') : s('Add and use', 'ضيفه واستخدمه')}</HRButton>
        <HRButton theme={T} size="sm" variant="ghost" onClick={onCancel}>{s('Cancel', 'إلغاء')}</HRButton>
        <span style={{ fontSize: 11, color: T.textMuted }}>{s('Upload a video later from Exercises.', 'تقدر ترفع فيديو بعدين من صفحة التمارين.')}</span>
      </div>
      {error && <div role="alert" style={{ fontSize: 11, color: T.danger, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

// The routine builder: name, workdays, optional day focus, timed rows,
// original table, and a phone preview of any day.
export function RoutineBuilder({
  theme, lang, density = 'comfortable', detail, exercises = [], isPublic = false, media,
  onSave, onCancel, onCreateExercise, todayWeekday = 0,
}) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const isEdit = !!detail?.routine?.id;
  const [form, setForm] = React.useState(() => {
    const f = detail ? routineToForm(detail) : emptyRoutineForm();
    if (!f.rows.length) f.rows = [newRowAfter([])];
    return f;
  });
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);
  const [quickFor, setQuickFor] = React.useState(null);
  const [created, setCreated] = React.useState([]);
  const [showFocus, setShowFocus] = React.useState(() => Object.keys(detail?.routine?.day_titles || {}).length > 0);
  const [previewDayId, setPreviewDayId] = React.useState(() => (form.workdays.includes(todayWeekday) ? todayWeekday : form.workdays[0] ?? 0));
  const pending = usePendingUploads(media?.discard);

  const allExercises = React.useMemo(() => [...created, ...exercises], [created, exercises]);
  const byId = React.useMemo(() => {
    const m = new Map();
    for (const ex of allExercises) m.set(ex.id, ex);
    for (const r of form.rows) if (r.exercise && !m.has(r.exercise.id)) m.set(r.exercise.id, r.exercise);
    return m;
  }, [allExercises, form.rows]);

  const pickable = allExercises.filter((ex) => ex.status !== 'archived' && !ex.hidden);
  const ownOptions = pickable.filter((ex) => (isPublic ? true : ex.scope === 'company' || ex.company_id));
  const publicOptions = isPublic ? [] : pickable.filter((ex) => !(ex.scope === 'company' || ex.company_id));
  const exName = (ex) => pickLang(lang, ex?.name_en, ex?.name_ar);

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };
  const setRow = (key, patch) => {
    setForm((f) => ({ ...f, rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
    setErrors((e) => {
      if (!e.rows?.[key]) return e;
      const rows = { ...e.rows };
      const re = { ...rows[key] };
      for (const k of Object.keys(patch)) delete re[k];
      if (patch.mode) { delete re.exercise_id; delete re.title_en; }
      if (Object.keys(re).length) rows[key] = re; else delete rows[key];
      return { ...e, rows };
    });
  };
  const setRows = (fn) => setForm((f) => ({ ...f, rows: fn(f.rows) }));

  const onPickExercise = (row, value) => {
    if (value === NEW) { setQuickFor(row.key); return; }
    if (value === TEXT) { setRow(row.key, { mode: 'text', exercise_id: '' }); return; }
    setRow(row.key, { mode: 'exercise', exercise_id: value });
  };

  async function createExercise(rowKey, input) {
    const ex = await onCreateExercise({ ...input, ...(isPublic ? { public: true } : {}) });
    const row = { ...ex, scope: isPublic ? 'public' : 'company' };
    setCreated((c) => [row, ...c]);
    setRow(rowKey, { mode: 'exercise', exercise_id: ex.id });
    setQuickFor(null);
  }

  async function submit(e) {
    e?.preventDefault?.();
    const errs = validateRoutineForm(form);
    setErrors(errs);
    setSaveError(null);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      return await pending.saving(form.source?.path ? [form.source.path] : [], () => onSave(buildRoutineInput(form, { isPublic }), form));
    } catch (err) {
      if (err?.fieldErrors) setErrors(err.fieldErrors);
      else setSaveError(libraryError(err, lang));
      setSaving(false);
    }
    return undefined;
  }

  const errCount = routineErrorCount(errors);
  const sel = { ...inputStyle(T), padding: '7px 8px' };
  const rowGrid = { display: 'grid', gridTemplateColumns: '92px minmax(170px, 2.2fr) minmax(90px, 1fr) minmax(120px, 1.2fr) auto', gap: 8, alignItems: 'start' };
  const preview = previewDay(form, previewDayId, byId, lang);
  const focus = dayFocus(form, previewDayId, lang);

  return (
    <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap }}>
      <PanelHeader theme={T} density={density}
        title={isEdit ? s('Edit routine', 'تعديل الروتين') : s('New routine', 'روتين جديد')}
        subtitle={isEdit
          ? s('Changes show from today on. Past ticks stay as they were.', 'التغييرات بتظهر من النهارده. العلامات اللي فاتت زي ما هي.')
          : s('Type the coach’s table: one row per exercise, with its time.', 'اكتب جدول المدرب: صف لكل تمرين، بالوقت بتاعه.')}
        right={<HRButton theme={T} variant="ghost" size="sm" icon="close" onClick={onCancel}>{s('Close', 'قفل')}</HRButton>}/>

      <form onSubmit={submit} noValidate aria-label={s('Routine', 'الروتين')}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 24, padding: DENSITY[density].cardPad, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <Field theme={T} label={s('Name', 'الاسم')}>
            <LangPair theme={T} lang={lang} form={form} base="title" label={s('Routine name', 'اسم الروتين')} onChange={setField} errors={errors}
              max={ROUTINE_LIMITS.title} placeholderEn="Daily desk routine" placeholderAr="روتين المكتب اليومي"/>
          </Field>

          <Field theme={T} label={s('Workdays', 'أيام الشغل')} hint={s('Rows set to "Every workday" show on each of these days.', 'الصفوف اللي على «كل أيام الشغل» بتظهر في الأيام دي كلها.')}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {WEEKDAYS.map((d) => (
                <Choice key={d.id} theme={T} selected={form.workdays.includes(d.id)} onClick={() => setField('workdays', toggleWorkday(form.workdays, d.id))}
                  style={{ minWidth: 52, textAlign: 'center', padding: '6px 8px' }}>
                  {lang === 'ar' ? d.short_ar : d.short_en}
                </Choice>
              ))}
            </div>
            <ErrorText theme={T} lang={lang} error={errors.workdays}/>
          </Field>

          <Field theme={T} lang={lang} optional label={s('Day focus', 'تركيز اليوم')}>
            {!showFocus ? (
              <HRButton theme={T} variant="ghost" size="sm" icon="plus" onClick={() => setShowFocus(true)}>
                {s('Give a day a focus, e.g. Sunday: Upper body', 'حط تركيز ليوم، مثلاً الأحد: الجزء العلوي')}
              </HRButton>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {form.workdays.map((d) => {
                  const v = form.day_titles[String(d)] || { en: '', ar: '' };
                  const setDay = (k, val) => setField('day_titles', { ...form.day_titles, [String(d)]: { ...v, [k]: val } });
                  return (
                    <div key={d} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: T.textMid, fontWeight: 600 }}>{weekdayLabel(d, lang)}</span>
                      <input value={v.en || ''} dir="ltr" maxLength={ROUTINE_LIMITS.dayTitle} placeholder="Upper body"
                        aria-label={`${s('Focus', 'التركيز')} ${weekdayLabel(d, lang)} (${s('English', 'بالإنجليزي')})`}
                        onChange={(e) => setDay('en', e.target.value)} style={inputStyle(T, !!errors.day_titles?.[String(d)])}/>
                      <input value={v.ar || ''} dir="rtl" maxLength={ROUTINE_LIMITS.dayTitle} placeholder="الجزء العلوي"
                        aria-label={`${s('Focus', 'التركيز')} ${weekdayLabel(d, lang)} (${s('Arabic', 'بالعربي')})`}
                        onChange={(e) => setDay('ar', e.target.value)} style={inputStyle(T, !!errors.day_titles?.[String(d)])}/>
                    </div>
                  );
                })}
              </div>
            )}
          </Field>

          <Field theme={T} label={s('Rows', 'الصفوف')}
            hint={s('Leave sets × reps empty to use the exercise’s own. Leave the time empty for "any time today".',
                    'سيب العدد فاضي علشان ياخد عدد التمرين نفسه. سيب الوقت فاضي لو «أي وقت النهارده».')}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 640 }}>
                <div style={{ ...rowGrid, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: T.textMuted, fontWeight: 700, padding: '0 0 6px' }}>
                  <span>{s('Time', 'الوقت')}</span><span>{s('Exercise', 'التمرين')}</span><span>{s('Sets × reps', 'العدد')}</span><span>{s('Day', 'اليوم')}</span><span/>
                </div>
                {form.rows.map((row, i) => {
                  const re = errors.rows?.[row.key] || {};
                  const ex = row.exercise_id ? byId.get(row.exercise_id) : null;
                  const known = !row.exercise_id || ownOptions.some((o) => o.id === row.exercise_id) || publicOptions.some((o) => o.id === row.exercise_id);
                  const n = i + 1;
                  return (
                    <div key={row.key} role="group" aria-label={`${s('Row', 'صف')} ${n}`}
                      style={{ ...rowGrid, padding: '6px 0', borderTop: `1px solid ${T.divider}` }}>
                      <div>
                        <input type="time" value={row.at_time} onChange={(e) => setRow(row.key, { at_time: e.target.value })}
                          aria-label={`${s('Time', 'الوقت')} ${n}`} style={{ ...inputStyle(T, !!re.at_time), padding: '7px 6px' }}/>
                        <ErrorText theme={T} lang={lang} error={re.at_time}/>
                      </div>
                      <div>
                        <select value={row.mode === 'text' ? TEXT : row.exercise_id || ''} aria-label={`${s('Exercise', 'التمرين')} ${n}`}
                          onChange={(e) => onPickExercise(row, e.target.value)} style={{ ...sel, borderColor: re.exercise_id ? T.danger : T.border }}>
                          <option value="">{s('Pick an exercise…', 'اختار تمرين…')}</option>
                          {ownOptions.length > 0 && (
                            <optgroup label={isPublic ? s('Wellness House', 'Wellness House') : s('Your company', 'شركتك')}>
                              {ownOptions.map((o) => <option key={o.id} value={o.id}>{exName(o)}</option>)}
                            </optgroup>
                          )}
                          {publicOptions.length > 0 && (
                            <optgroup label={s('Wellness House', 'Wellness House')}>
                              {publicOptions.map((o) => <option key={o.id} value={o.id}>{exName(o)}</option>)}
                            </optgroup>
                          )}
                          {!known && ex && <option value={ex.id}>{exName(ex)}{ex.status === 'archived' ? s(' (archived)', ' (مؤرشف)') : ''}</option>}
                          <option value={NEW}>{s('+ New exercise…', '+ تمرين جديد…')}</option>
                          <option value={TEXT}>{s('A step with no exercise (e.g. drink water)', 'خطوة من غير تمرين (مثلاً اشرب مية)')}</option>
                        </select>
                        {row.mode === 'text' && (
                          <input value={row.title_en} onChange={(e) => setRow(row.key, { title_en: e.target.value })} maxLength={ROUTINE_LIMITS.rowTitle}
                            placeholder={s('e.g. Drink a glass of water', 'مثلاً اشرب كوباية مية')} aria-label={`${s('Step', 'الخطوة')} ${n}`}
                            style={{ ...inputStyle(T, !!re.title_en), marginTop: 6 }}/>
                        )}
                        <ErrorText theme={T} lang={lang} error={re.exercise_id || re.title_en}/>
                      </div>
                      <div>
                        <input value={row.sets_reps} onChange={(e) => setRow(row.key, { sets_reps: e.target.value })} maxLength={ROUTINE_LIMITS.setsReps}
                          placeholder={pickLang(lang, ex?.default_sets_reps, ex?.default_sets_reps_ar) || '2 × 10'}
                          aria-label={`${s('Sets × reps', 'العدد')} ${n}`} style={inputStyle(T, !!re.sets_reps)}/>
                        <ErrorText theme={T} lang={lang} error={re.sets_reps}/>
                      </div>
                      <div>
                        <select value={row.weekday == null ? '' : String(row.weekday)} aria-label={`${s('Day', 'اليوم')} ${n}`}
                          onChange={(e) => setRow(row.key, { weekday: e.target.value === '' ? null : Number(e.target.value) })}
                          style={{ ...sel, borderColor: re.weekday ? T.danger : T.border }}>
                          <option value="">{s('Every workday', 'كل أيام الشغل')}</option>
                          {[...new Set([...form.workdays, ...(row.weekday != null ? [row.weekday] : [])])].sort((a, b) => a - b).map((d) => (
                            <option key={d} value={String(d)}>{s('Only ', 'بس ')}{weekdayLabel(d, lang)}</option>
                          ))}
                        </select>
                        <ErrorText theme={T} lang={lang} error={re.weekday}/>
                      </div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <HRButton theme={T} variant="ghost" size="sm" icon="chevUp" title={s('Move up', 'لفوق')} disabled={i === 0}
                          onClick={() => setRows((rows) => moveRow(rows, i, -1))} style={{ padding: '0 6px' }}/>
                        <HRButton theme={T} variant="ghost" size="sm" icon="chevDown" title={s('Move down', 'لتحت')} disabled={i === form.rows.length - 1}
                          onClick={() => setRows((rows) => moveRow(rows, i, 1))} style={{ padding: '0 6px' }}/>
                        <HRButton theme={T} variant="ghost" size="sm" icon="close" title={s('Delete row', 'امسح الصف')}
                          onClick={() => setRows((rows) => rows.filter((r) => r.key !== row.key))} style={{ padding: '0 6px' }}/>
                      </div>
                      {quickFor === row.key && (
                        <QuickAddExercise theme={T} lang={lang} onCancel={() => setQuickFor(null)}
                          onCreate={(input) => createExercise(row.key, input)}/>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <HRButton theme={T} variant="secondary" size="sm" icon="plus" onClick={() => setRows((rows) => [...rows, newRowAfter(rows)])}>
                {s('Add row', 'ضيف صف')}
              </HRButton>
              <HRButton theme={T} variant="ghost" size="sm" disabled={form.rows.length < 2} onClick={() => setRows(sortRowsByTime)}>
                {s('Sort by time', 'رتّب بالوقت')}
              </HRButton>
              <span style={{ fontSize: 11, color: T.textMuted }}>{s(`${form.rows.length} rows`, `${fmtNum(form.rows.length, 'ar')} صف`)}</span>
            </div>
            <ErrorText theme={T} lang={lang} error={errors.rowsList}/>
          </Field>

          <Field theme={T} lang={lang} optional label={s('Original table', 'الجدول الأصلي')}>
            <SourceFileField theme={T} lang={lang} value={form.source} media={media} pending={pending} onUploadingChange={setUploading}
              onChange={(v) => setField('source', v)}/>
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 14, borderTop: `1px solid ${T.divider}` }}>
            <HRButton theme={T} type="submit" variant="primary" disabled={saving || uploading} icon="check">
              {saving ? s('Saving…', 'جارٍ الحفظ…') : s('Save routine', 'احفظ الروتين')}
            </HRButton>
            <HRButton theme={T} variant="ghost" onClick={onCancel}>{s('Cancel', 'إلغاء')}</HRButton>
            {uploading && <span style={{ fontSize: 12, color: T.textMuted }}>{s('Wait for the upload to finish.', 'استنى الرفع يخلص.')}</span>}
            {errCount > 0 && (
              <span role="alert" style={{ fontSize: 12, color: T.danger }}>
                {s(`Fix ${errCount} highlighted ${errCount === 1 ? 'field' : 'fields'}.`, `صلّح ${fmtNum(errCount, 'ar')} خانة متعلّم عليها.`)}
              </span>
            )}
            {saveError && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{saveError}</span>}
          </div>
        </div>

        <aside aria-label={s('Phone preview', 'معاينة الموبايل')} style={{ position: 'sticky', top: 16 }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
            {s('What employees see', 'اللي الموظف بيشوفه')}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {form.workdays.map((d) => (
              <Choice key={d} theme={T} selected={previewDayId === d} onClick={() => setPreviewDayId(d)} style={{ padding: '3px 8px', fontSize: 11 }}>
                {weekdayLabel(d, lang, true)}
              </Choice>
            ))}
          </div>
          <div style={{ background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 18, padding: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{s('Today', 'النهارده')} · {weekdayLabel(previewDayId, lang)}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
              {s(`0 of ${preview.length} done`, `٠ من ${fmtNum(preview.length, 'ar')} اتعمل`)}
            </div>
            {focus && <div style={{ fontSize: 12, color: T.accent, fontWeight: 700, marginTop: 8 }}>{s('Today’s focus: ', 'تركيز النهارده: ')}{focus}</div>}
            <div style={{ marginTop: 10 }}>
              {preview.length === 0 ? (
                <div style={{ fontSize: 12, color: T.textMuted, padding: '10px 0' }}>
                  {form.workdays.includes(previewDayId) ? s('Nothing on this day yet.', 'لسه مفيش حاجة اليوم ده.') : s('Not a workday.', 'مش يوم شغل.')}
                </div>
              ) : preview.map((p) => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${T.divider}` }}>
                  <span className="mono" style={{ fontSize: 12, color: T.textMuted, width: 42 }}>{p.time || '—'}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                  {p.setsReps && <span dir="ltr" style={{ fontSize: 11, color: T.textMid }}>{p.setsReps}</span>}
                  {p.exercise && (p.exercise.media_type) && <HRIcon name="play" size={12} stroke={T.accent}/>}
                  <span aria-hidden style={{ width: 16, height: 16, borderRadius: 99, border: `2px solid ${T.borderStrong}` }}/>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </form>
    </Panel>
  );
}

