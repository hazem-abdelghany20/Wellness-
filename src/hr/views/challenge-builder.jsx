import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader } from '../../shared/components.jsx';
import { Field, Choice, ErrorText, LangPair, inputStyle } from '../../shared/authoring/ui.jsx';
import { MediaField, MediaPreview, usePendingUploads, formMediaFields } from '../../shared/authoring/media-field.jsx';
import {
  emptyChallengeForm, challengeToForm, validateChallengeForm, buildChallengeInput, setWeeks,
  challengeDays, CHALLENGE_LIMITS, MAX_WEEKS,
  defaultEndDate, workdaysBetween, countableDays, defaultNeed, validateRoutineChallenge,
  buildRoutineChallengeInput, pickableRoutineRows, MAX_SPAN_DAYS, MAX_ROUTINE_ITEMS,
} from '../../shared/authoring/challenge-form.js';
import { weekdayLabel } from '../../shared/authoring/routine-form.js';
import { libraryError, challengeError } from '../../shared/authoring/errors.js';
import { fmtNum, fmtDate, upcomingSunday, localTodayIso, addDays, pickLang } from '../../shared/authoring/text.js';
import { listRoutines, getRoutineDetail } from '../../lib/supabase-routines';
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
        subtitle={s('Only your company sees it. After saving, pick its dates below.', 'شركتك بس اللي بتشوفه. بعد الحفظ، اختار تواريخه تحت.')}
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

// "Challenge from routine exercises": a name, a few rows of one of the
// company's routines, its dates, days needed and who. The day counts by
// itself when a person ticks those rows in Today; nobody taps "Did it".
// onSubmit(input) gets the scheduleChallenge() input and throws on a refusal.
export function RoutineChallengeForm({
  theme, lang, density, teams = [], today = localTodayIso(), onSubmit, onCancel,
  loadRoutines = () => listRoutines('company'), loadDetail = getRoutineDetail,
}) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const num = (v) => fmtNum(v, lang);
  const [routines, setRoutines] = React.useState(null);
  const [loadError, setLoadError] = React.useState(null);
  const [routineId, setRoutineId] = React.useState('');
  const [detail, setDetail] = React.useState(null);
  const [detailBusy, setDetailBusy] = React.useState(false);
  const [itemIds, setItemIds] = React.useState([]);
  const [name, setName] = React.useState({ title_en: '', title_ar: '' });
  const [startDate, setStartDate] = React.useState(() => upcomingSunday(today));
  const [endPick, setEndPick] = React.useState('');    // '' = the Thursday after the start
  const [needPick, setNeedPick] = React.useState(null); // null = 80% of the days that can count
  const [teamId, setTeamId] = React.useState('');
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState(null);

  React.useEffect(() => {
    let live = true;
    Promise.resolve().then(loadRoutines)
      .then((rows) => { if (live) setRoutines((rows || []).filter((r) => r.status !== 'archived')); })
      .catch((e) => { if (live) { setRoutines([]); setLoadError(libraryError(e, lang)); } });
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = (...keys) => setErrors((e) => {
    if (!keys.some((k) => e[k])) return e;
    const next = { ...e };
    for (const k of keys) delete next[k];
    return next;
  });

  async function pickRoutine(id) {
    setRoutineId(id); setItemIds([]); setDetail(null); setLoadError(null);
    clear('routineId', 'items', 'successDays');
    if (!id) return;
    setDetailBusy(true);
    try { setDetail(await loadDetail(id)); }
    catch (e) { setLoadError(libraryError(e, lang)); }
    finally { setDetailBusy(false); }
  }

  const rows = React.useMemo(() => pickableRoutineRows(detail, lang), [detail, lang]);
  const hiddenCount = (detail?.items || []).filter((it) => it.hidden_at).length;
  const routine = (routines || []).find((r) => r.id === routineId) || null;
  const full = itemIds.length >= MAX_ROUTINE_ITEMS;
  const toggleRow = (id) => {
    setItemIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= MAX_ROUTINE_ITEMS ? ids : [...ids, id]));
    clear('items', 'successDays');
  };

  const endDate = endPick || defaultEndDate(startDate, 1);
  const days = workdaysBetween(startDate, endDate);
  // Days on which at least one ticked row is due: only those can count.
  const picked = rows.filter((r) => itemIds.includes(r.id));
  const canCount = picked.length ? countableDays(days, picked, detail?.routine?.workdays || [0, 1, 2, 3, 4]).length : days.length;
  const need = needPick == null ? defaultNeed(null, canCount)
    : needPick === '' ? '' : Math.min(Number(needPick), Math.max(canCount, 1));
  const pickStart = (v) => { setStartDate(v); if (endPick && v && endPick < v) setEndPick(''); clear('startDate', 'endDate', 'successDays'); };

  async function submit(e) {
    e.preventDefault();
    const form = { ...name, routineId, itemIds, startDate, endDate, successDays: need, maxDays: picked.length ? canCount : undefined, teamId };
    const errs = validateRoutineChallenge(form, today);
    setErrors(errs); setSaveError(null);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await onSubmit(buildRoutineChallengeInput(form));
    } catch (err) {
      setSaveError(challengeError(err, lang));
      setSaving(false);
    }
  }

  const whenLabel = (r) => (r.weekday == null ? s('Every workday', 'كل أيام الشغل') : `${s('Only ', 'بس ')}${weekdayLabel(r.weekday, lang)}`);
  const small = { fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 };

  return (
    <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap }}>
      <PanelHeader theme={T} density={density}
        title={s('Challenge from routine exercises', 'تحدي من تمارين الروتين')}
        subtitle={s('The day counts by itself when a person ticks these in Today. No extra button.', 'اليوم بيتحسب لوحده لما الموظف يعلّم على دول في «النهارده». من غير زرار زيادة.')}
        right={<HRButton theme={T} variant="ghost" size="sm" icon="close" onClick={onCancel}>{s('Close', 'قفل')}</HRButton>}/>
      <form onSubmit={submit} noValidate aria-label={s('Challenge from routine exercises', 'تحدي من تمارين الروتين')} style={{ padding: DENSITY[density].cardPad }}>
        <Field theme={T} label={s('Name', 'الاسم')}>
          <LangPair theme={T} lang={lang} form={name} base="title" label={s('Name', 'الاسم')} errors={errors} max={CHALLENGE_LIMITS.title}
            onChange={(key, value) => { setName((n) => ({ ...n, [key]: value })); clear(key); }}
            placeholderEn="Stretch week" placeholderAr="أسبوع الإطالات"/>
        </Field>

        <Field theme={T} label={s('Routine', 'الروتين')}>
          {routines == null ? (
            <div style={{ fontSize: 12, color: T.textMuted }}>{s('Loading…', 'جارٍ التحميل…')}</div>
          ) : routines.length === 0 && !loadError ? (
            <div style={{ fontSize: 12, color: T.textMuted }}>{s('No routines yet. Build one in Routines first.', 'لسه مفيش روتين. اعمل واحد من صفحة الروتين الأول.')}</div>
          ) : (
            <select value={routineId} onChange={(e) => pickRoutine(e.target.value)} aria-label={s('Routine', 'الروتين')}
              aria-invalid={errors.routineId ? true : undefined} style={{ ...inputStyle(T, !!errors.routineId), maxWidth: 420 }}>
              <option value="">{s('Pick a routine…', 'اختار روتين…')}</option>
              {routines.map((r) => <option key={r.id} value={r.id}>{pickLang(lang, r.title_en, r.title_ar)}</option>)}
            </select>
          )}
          <ErrorText theme={T} lang={lang} error={errors.routineId}/>
          {loadError && <div role="alert" style={{ fontSize: 11, color: T.danger, marginTop: 5 }}>{loadError}</div>}
          {routine && routine.assigned === false && (
            <div role="note" style={{ fontSize: 11, color: T.caution, marginTop: 6 }}>
              {s('Nobody has this routine yet. Assign it in Routines, or the days can’t count.', 'الروتين ده لسه مش متوزّع على حد. وزّعه من صفحة الروتين، وإلا الأيام مش هتتحسب.')}
            </div>
          )}
        </Field>

        {routineId && (
          <Field theme={T} label={s('Exercises that count', 'التمارين اللي بتتحسب')}
            hint={hiddenCount > 0 ? s(`${hiddenCount} hidden ${hiddenCount === 1 ? 'row is' : 'rows are'} not offered.`, `${num(hiddenCount)} صف مخفي مش معروض.`) : null}>
            {detailBusy ? (
              <div style={{ fontSize: 12, color: T.textMuted }}>{s('Loading…', 'جارٍ التحميل…')}</div>
            ) : rows.length === 0 ? (
              !loadError && <div style={{ fontSize: 12, color: T.textMuted }}>{s('This routine has no rows to pick.', 'الروتين ده مفيهوش صفوف تختار منها.')}</div>
            ) : (
              <>
                <div role="group" aria-label={s('Exercises that count', 'التمارين اللي بتتحسب')}
                  style={{ background: T.panelSunk, border: `1px solid ${errors.items ? T.danger : T.border}`, borderRadius: 9, padding: 6, maxHeight: 280, overflowY: 'auto' }}>
                  {rows.map((r) => {
                    const checked = itemIds.includes(r.id);
                    return (
                      <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 6,
                        cursor: !checked && full ? 'not-allowed' : 'pointer', background: checked ? T.accentSoft : 'transparent', opacity: !checked && full ? 0.5 : 1 }}>
                        <input type="checkbox" checked={checked} disabled={!checked && full} onChange={() => toggleRow(r.id)} style={{ accentColor: T.accent }}/>
                        <span className="mono" dir="ltr" style={{ fontSize: 12, color: T.textMuted, width: 42 }}>{r.time || '—'}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.text }}>{r.title}</span>
                        <span style={{ fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap' }}>{whenLabel(r)}</span>
                      </label>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
                  {s(`${itemIds.length} of up to ${MAX_ROUTINE_ITEMS} picked`, `${num(itemIds.length)} من ${num(MAX_ROUTINE_ITEMS)} بحد أقصى`)}
                </div>
              </>
            )}
            <ErrorText theme={T} lang={lang} error={errors.items}/>
          </Field>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'start' }}>
          <div>
            <div style={small}>{s('Starts', 'يبدأ')}</div>
            <input type="date" value={startDate} aria-label={s('Start date', 'تاريخ البداية')} aria-invalid={errors.startDate ? true : undefined}
              onChange={(e) => pickStart(e.target.value)} style={inputStyle(T, !!errors.startDate)}/>
            <ErrorText theme={T} lang={lang} error={errors.startDate}/>
          </div>
          <div>
            <div style={small}>{s('Ends', 'يخلص')}</div>
            <input type="date" value={endDate} min={startDate || undefined} max={startDate ? addDays(startDate, MAX_SPAN_DAYS) : undefined}
              aria-label={s('End date', 'تاريخ النهاية')} aria-invalid={errors.endDate ? true : undefined}
              onChange={(e) => { setEndPick(e.target.value); clear('endDate', 'successDays'); }} style={inputStyle(T, !!errors.endDate)}/>
            <ErrorText theme={T} lang={lang} error={errors.endDate}/>
          </div>
          <div>
            <div style={small}>{s('Days needed', 'الأيام المطلوبة')}</div>
            <input type="number" min={1} max={Math.max(canCount, 1)} value={need} aria-label={s('Days needed', 'الأيام المطلوبة')}
              aria-invalid={errors.successDays ? true : undefined}
              onChange={(e) => { setNeedPick(e.target.value === '' ? '' : Number(e.target.value)); clear('successDays'); }} style={inputStyle(T, !!errors.successDays)}/>
            <ErrorText theme={T} lang={lang} error={errors.successDays}/>
          </div>
          <div>
            <div style={small}>{s('Who', 'مين')}</div>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label={s('Who', 'مين')} style={inputStyle(T)}>
              <option value="">{s('All staff', 'كل الموظفين')}</option>
              {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: T.textMuted, lineHeight: 1.55 }}>
          {s(`${days.length} working ${days.length === 1 ? 'day' : 'days'} (Sun–Thu) in these dates`, `${num(days.length)} يوم شغل (الأحد–الخميس) في التواريخ دي`)}
          {picked.length > 0 && canCount < days.length && (
            <>{' · '}{s(`the exercises you ticked are due on ${canCount} of them`, `التمارين اللي علّمت عليها مطلوبة في ${num(canCount)} منهم`)}</>
          )}
          {' · '}{s('Any dates, up to 5 weeks.', 'أي تواريخ، لحد ٥ أسابيع.')}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.divider}` }}>
          <HRButton theme={T} type="submit" variant="primary" icon="check" disabled={saving}>
            {saving ? s('Starting…', 'جارٍ البدء…') : s('Start challenge', 'ابدأ التحدي')}
          </HRButton>
          <HRButton theme={T} variant="ghost" onClick={onCancel}>{s('Cancel', 'إلغاء')}</HRButton>
          {Object.values(errors).some(Boolean) && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{s('Fix the highlighted fields.', 'صلّح الخانات اللي متعلّم عليها.')}</span>}
          {saveError && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{saveError}</span>}
        </div>
      </form>
    </Panel>
  );
}
