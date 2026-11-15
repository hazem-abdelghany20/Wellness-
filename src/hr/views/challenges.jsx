import React, { useState } from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, Badge } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useChallenges } from '../hooks/use-challenges.js';
import { friendlyErrorI18n } from '../../lib/errors';
import { habitCategory } from '../../shared/habit-meta.js';
import { ChallengeBuilder, RoutineChallengeForm } from './challenge-builder.jsx';
import { saveChallengeTemplate, setLibraryStatus } from '../../lib/supabase-routines';
import { libraryError, challengeError } from '../../shared/authoring/errors.js';
import { ConfirmButton, Flash } from '../../shared/authoring/ui.jsx';
import {
  templateWeeks, templateSuccessDays, payloadMediaKind,
  defaultEndDate, countWorkdays, defaultNeed, validateSchedule, MAX_SPAN_DAYS,
} from '../../shared/authoring/challenge-form.js';
import { localTodayIso, upcomingSunday, addDays, weekdayOf, msgText, fmtNum } from '../../shared/authoring/text.js';

// Habit challenges. HR picks a template (Wellness House's or their own) or
// a few rows of a routine, then its own start and end dates (up to 5 weeks,
// Sun–Thu days count), optionally for one team. Several can run at once;
// only the same challenge can't run twice over the same days.

function fmt(isoDate, lang, opts = { day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { ...opts, timeZone: 'UTC' })
    .format(new Date(`${isoDate}T00:00:00Z`));
}

function HRChallengesPage({ theme, lang, density, today = localTodayIso() }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const { templates, scheduled, teams, loading, error, schedule, cancel, refetch } = useChallenges();
  const [templateId, setTemplateId] = useState(null);
  const [startDate, setStartDate] = useState(() => upcomingSunday(today));
  const [endPick, setEndPick] = useState('');   // '' = follows the start and the template's length
  const [needPick, setNeedPick] = useState(null); // null = the template's days, capped to the dates
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  const [topFlash, setTopFlash] = useState(null);
  const [listFlash, setListFlash] = useState(null);
  const [editing, setEditing] = useState(null); // { template, key }
  const [fromRoutine, setFromRoutine] = useState(null); // key of the open "from routine exercises" form
  const [archivingId, setArchivingId] = useState(null);
  const [endingId, setEndingId] = useState(null);

  if (loading) {
    return <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>{s('Loading…', 'جارٍ التحميل…')}</div>;
  }

  const pick = (p, k) => (lang === 'ar' ? (p?.[`${k}_ar`] || p?.[`${k}_en`]) : p?.[`${k}_en`]) || '';
  const tTitle = (r) => (lang === 'ar' ? (r.title_ar || r.title_en) : r.title_en);
  const arrow = lang === 'ar' ? '←' : '→';
  const selected = templates.find((t) => t.id === templateId) || null;
  const selWeeks = templateWeeks(selected);
  // The end follows the start (and a multi-week template's length) until HR
  // picks one; days needed follow the template, capped to the working days.
  const endDate = endPick || defaultEndDate(startDate, selWeeks);
  const workdays = countWorkdays(startDate, endDate);
  const need = needPick == null ? defaultNeed(selected, workdays)
    : needPick === '' ? '' : Math.min(Number(needPick), Math.max(workdays, 1));
  const num = (v) => fmtNum(v, lang);
  const SENT = s('Sent. Everyone it is for got a note in the app.', 'اتبعت. كل اللي التحدي ليهم وصلتهم ملحوظة في التطبيق.');
  const own = templates.filter((t) => t.company_id);
  const shared = templates.filter((t) => !t.company_id);

  const pickTemplate = (id) => { setTemplateId(id); setEndPick(''); setNeedPick(null); };
  // A start after the picked end: the end goes back to following the start.
  const pickStart = (v) => { setStartDate(v); if (endPick && v && endPick < v) setEndPick(''); };
  const openBuilder = (template) => { setFlash(null); setTopFlash(null); setFromRoutine(null); setEditing({ template, key: `${template?.id || 'new'}-${Date.now()}` }); };
  const openFromRoutine = () => { setFlash(null); setTopFlash(null); setEditing(null); setFromRoutine(`routine-${Date.now()}`); };
  async function handleSaveTemplate(input) {
    const saved = await saveChallengeTemplate(input);
    setEditing(null);
    await refetch();
    if (saved?.id) pickTemplate(saved.id);
    setFlash({ kind: 'ok', text: input.id
      ? s('Challenge saved. The ones you schedule from now use the new version.', 'التحدي اتحفظ. اللي هتجدوله من دلوقتي هياخد النسخة الجديدة.')
      : s('Challenge created and picked below. Now choose its dates.', 'التحدي اتعمل واتختار تحت. اختار تواريخه.') });
  }
  // The form shows its own errors; on success it closes.
  async function handleRoutineChallenge(input) {
    await schedule(input);
    setFromRoutine(null);
    setTopFlash({ kind: 'ok', text: SENT });
  }
  async function endChallenge(c) {
    setEndingId(c.id); setListFlash(null);
    try {
      await cancel(c.id);
      setListFlash({ kind: 'ok', text: c.status === 'active'
        ? s('Ended. People keep the days they logged.', 'اتوقف. الناس محتفظين بالأيام اللي سجّلوها.')
        : s('Cancelled.', 'اتلغى.') });
    } catch (e) {
      setListFlash({ kind: 'err', text: challengeError(e, lang) });
      if (String(e?.message || '').includes('only_upcoming_can_be_cancelled')) refetch();
    } finally {
      setEndingId(null);
    }
  }
  async function archiveTemplate(t) {
    setArchivingId(t.id); setFlash(null);
    try {
      await setLibraryStatus('challenge_template', t.id, 'archived');
      if (templateId === t.id) setTemplateId(null);
      await refetch();
      setFlash({ kind: 'ok', text: s('Archived. Challenges already scheduled keep running.', 'اتأرشف. التحديات المجدولة هتكمّل.') });
    } catch (e) {
      setFlash({ kind: 'err', text: libraryError(e, lang) });
    } finally {
      setArchivingId(null);
    }
  }

  // Next week (Sun → Thu) with nothing in it yet: a nudge, not a rule.
  const nextSunday = addDays(today, 7 - weekdayOf(today));
  const nextThursday = addDays(nextSunday, 4);
  const nextWeekEmpty = !scheduled.some((c) =>
    c.status !== 'cancelled' && c.start_date <= nextThursday && (c.end_date || c.start_date) >= nextSunday);

  const handleSchedule = async () => {
    if (!templateId) return;
    const errs = validateSchedule({ startDate, endDate, successDays: need }, today);
    const first = errs.startDate || errs.endDate || errs.successDays;
    if (first) { setFlash({ kind: 'err', text: msgText(first, lang) }); return; }
    setBusy(true); setFlash(null);
    try {
      await schedule({ templateId, startDate, endDate, successDays: Number(need), teamId: teamId || null });
      setFlash({ kind: 'ok', text: SENT });
      pickTemplate(null);
    } catch (e) {
      setFlash({ kind: 'err', text: challengeError(e, lang) });
      // Archived since this page loaded: drop it from the picker.
      if (String(e?.message || '').includes('template_archived')) { setTemplateId(null); refetch(); }
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (st) => {
    const map = {
      active:    ['positive', s('Running', 'شغال')],
      upcoming:  ['neutral',  s('Upcoming', 'جاي')],
      done:      ['neutral',  s('Done', 'خلص')],
      cancelled: ['caution',  s('Cancelled', 'اتلغى')],
      // Ended while it was running ("End now"): people keep their days.
      ended:     ['neutral',  s('Ended early', 'اتوقف بدري')],
      // Sprint 3: the default weekly habit gives way while a routine runs.
      paused:    ['info',     s('Paused while a routine runs', 'متوقف طول ما الروتين شغال')],
    };
    const [tone, label] = map[st] || map.done;
    return <Badge theme={T} tone={tone}>{label}</Badge>;
  };

  const field = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
    color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
  };

  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Small habits, as many as you want', 'عادات صغيرة، قد ما تحب')}
        title={s('Challenges', 'التحديات')}
        sub={s('Employees tap "Did it" each workday. No scores, no ranking. Everyone who reaches the days needed gets a bronze reward. Several challenges can run at the same time.',
               'الموظف بيضغط «عملتها» كل يوم شغل. مفيش درجات ولا ترتيب. اللي يوصل لعدد الأيام المطلوب ياخد مكافأة برونزية. ممكن أكتر من تحدي يشتغلوا في نفس الوقت.')}
        right={!editing && !fromRoutine ? (
          <>
            <HRButton theme={T} variant="secondary" icon="plus" onClick={openFromRoutine}>{s('Challenge from routine exercises', 'تحدي من تمارين الروتين')}</HRButton>
            <HRButton theme={T} variant="primary" icon="plus" onClick={() => openBuilder(null)}>{s('Create your own challenge', 'اعمل تحدي بتاعك')}</HRButton>
          </>
        ) : null}/>

      <Flash theme={T} flash={topFlash}/>

      {editing && (
        <ChallengeBuilder key={editing.key} theme={T} lang={lang} density={density} template={editing.template}
          onSave={handleSaveTemplate} onCancel={() => setEditing(null)}/>
      )}

      {fromRoutine && (
        <RoutineChallengeForm key={fromRoutine} theme={T} lang={lang} density={density} teams={teams} today={today}
          onSubmit={handleRoutineChallenge} onCancel={() => setFromRoutine(null)}/>
      )}

      {error && (
        <Panel theme={T} density={density} style={{ marginBottom: DENSITY[density].gap }}>
          <div style={{ fontSize: 13, color: T.danger }}>{friendlyErrorI18n(error, lang)}</div>
        </Panel>
      )}

      {nextWeekEmpty && (
        <Panel theme={T} density={density} style={{ marginBottom: DENSITY[density].gap, borderColor: T.accent }}>
          <div style={{ fontSize: 13, color: T.text }}>
            {s('Next week has no challenge yet. Pick one below.', 'الأسبوع الجاي لسه من غير تحدي. اختار واحد من تحت.')}
          </div>
        </Panel>
      )}

      <Panel theme={T} density={density} style={{ marginBottom: DENSITY[density].gap }}>
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>
          {s('1 · Pick a challenge', '١ · اختار التحدي')}
        </div>
        {[
          ['company', s('Your company', 'شركتك'), own],
          ['public', s('Wellness House', 'Wellness House'), shared],
        ].filter(([, , list]) => list.length).map(([groupId, groupLabel, list]) => (
        <div key={groupId} style={{ marginBottom: 14 }}>
        {own.length > 0 && (
          <div style={{ fontSize: 12, color: T.textMid, fontWeight: 700, marginBottom: 8 }}>{groupLabel}</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {list.map((tp) => {
            const p = tp.payload || {};
            const sel = tp.id === templateId;
            const cat = habitCategory(p.category);
            const mediaKind = payloadMediaKind(p);
            const weeks = templateWeeks(tp);
            const need = templateSuccessDays(tp);
            return (
              <div key={tp.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <button onClick={() => pickTemplate(tp.id)} aria-pressed={sel} style={{ flex: 1,
                textAlign: lang === 'ar' ? 'right' : 'left', cursor: 'pointer', fontFamily: 'inherit',
                background: sel ? T.panelSunk : 'transparent', color: T.text,
                border: `1.5px solid ${sel ? T.accent : T.border}`, borderRadius: 12, padding: 14,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{tTitle(tp)}</div>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: p.badge_color || T.accent }}/>
                </div>
                {(cat || mediaKind || weeks > 1) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {cat && <Badge theme={T} tone="neutral">{lang === 'ar' ? cat.ar : cat.en}</Badge>}
                    {weeks > 1 && <Badge theme={T} tone="caution">{s(`${weeks} weeks`, weeks === 2 ? 'أسبوعين' : `${weeks} أسابيع`)}</Badge>}
                    {mediaKind && (
                      <Badge theme={T} tone="info">
                        <HRIcon name={mediaKind === 'image' ? 'eye' : 'play'} size={11}/>
                        {mediaKind === 'image' ? s('How-to image', 'صورة توضيحية') : s('How-to video', 'فيديو توضيحي')}
                      </Badge>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.5, marginBottom: 8 }}>{pick(p, 'action')}</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>
                  {p.check_mode === 'next_morning'
                    ? s('Evening habit · logged next morning', 'عادة بالليل · بتتسجل الصبح')
                    : s('Daytime habit · logged same day', 'عادة بالنهار · بتتسجل نفس اليوم')}
                  {' · '}{s(`${need} of ${weeks * 5} days`, `${need} من ${weeks * 5} يوم`)}
                </div>
              </button>
              {tp.company_id && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  <HRButton theme={T} variant="ghost" size="sm" onClick={() => openBuilder(tp)}>{s('Edit', 'تعديل')}</HRButton>
                  <ConfirmButton theme={T} lang={lang} label={s('Archive', 'أرشفة')} busy={archivingId === tp.id}
                    question={s('Archive it?', 'تأرشفه؟')} yes={s('Yes, archive', 'أيوه، أرشف')} onConfirm={() => archiveTemplate(tp)}/>
                </div>
              )}
              </div>
            );
          })}
        </div>
        </div>
        ))}
        {templates.length === 0 && (
          <div style={{ fontSize: 13, color: T.textMuted }}>{s('No challenges yet. Create your own above.', 'لسه مفيش تحديات. اعمل تحدي بتاعك من فوق.')}</div>
        )}

        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, margin: '20px 0 10px' }}>
          {s('2 · Pick the dates and who', '٢ · اختار التواريخ ومين')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Starts', 'يبدأ')}</div>
            <input type="date" value={startDate} aria-label={s('Start date', 'تاريخ البداية')}
              onChange={(e) => pickStart(e.target.value)} style={field}/>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Ends', 'يخلص')}</div>
            <input type="date" value={endDate} min={startDate || undefined} max={startDate ? addDays(startDate, MAX_SPAN_DAYS) : undefined}
              aria-label={s('End date', 'تاريخ النهاية')} onChange={(e) => setEndPick(e.target.value)} style={field}/>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Days needed', 'الأيام المطلوبة')}</div>
            <input type="number" min={1} max={Math.max(workdays, 1)} value={need} aria-label={s('Days needed', 'الأيام المطلوبة')}
              onChange={(e) => setNeedPick(e.target.value === '' ? '' : Number(e.target.value))} style={field}/>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Who', 'مين')}</div>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label={s('Who', 'مين')} style={field}>
              <option value="">{s('All staff', 'كل الموظفين')}</option>
              {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
            </select>
          </div>
          <HRButton theme={T} variant="primary" disabled={!templateId || busy} onClick={handleSchedule} style={{ justifyContent: 'center' }}>
            {busy ? s('Scheduling…', 'جارٍ الجدولة…') : s('Schedule', 'جدولة')}
          </HRButton>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: T.textMuted }}>
          {s(`${workdays} working ${workdays === 1 ? 'day' : 'days'} (Sun–Thu) in these dates`, `${num(workdays)} يوم شغل (الأحد–الخميس) في التواريخ دي`)}
          {' · '}{s('Any dates, up to 5 weeks.', 'أي تواريخ، لحد ٥ أسابيع.')}
        </div>
        {flash && (
          <div role={flash.kind === 'err' ? 'alert' : 'status'} style={{ marginTop: 12, fontSize: 13, color: flash.kind === 'ok' ? T.positive : T.danger }}>{flash.text}</div>
        )}
      </Panel>

      <div style={{ marginBottom: 12, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {s('Scheduled and past', 'المجدول والسابق')}
      </div>
      <Flash theme={T} flash={listFlash}/>
      <Panel theme={T} density={density} pad={false}>
        {scheduled.map((c0, i) => {
          // The server reports a challenge ended mid-run as "cancelled"; one
          // people logged days in did run, so show it as ended, with its numbers.
          const c = c0.status === 'cancelled' && Number(c0.participants) > 0 ? { ...c0, status: 'ended' } : c0;
          return (
          <div key={c.id} style={{
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            borderBottom: i < scheduled.length - 1 ? `1px solid ${T.divider}` : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{tTitle(c)}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                {c.team_name || s('All staff', 'كل الموظفين')} · {fmt(c.start_date, lang)} {arrow} {fmt(c.end_date, lang)}
                {c.auto && s(' · Picked by the app. Schedule your own on these days to replace it.', ' · التطبيق اختاره. جدول تحدي في الأيام دي عشان تغيّره.')}
              </div>
            </div>
            <div style={{ fontSize: 12, color: T.textMid, textAlign: lang === 'ar' ? 'left' : 'right', minWidth: 170 }}>
              {c.status === 'paused' ? (
                <span style={{ fontSize: 11, color: T.textMuted }}>{s('People do their routine instead this week.', 'الناس بيعملوا الروتين بدالها الأسبوع ده.')}</span>
              ) : c.status === 'upcoming' || c.status === 'cancelled' ? '—' : c.status === 'active' ? (
                <>
                  {s(`${c.participants} taking part so far`, `${c.participants} بيشاركوا لحد دلوقتي`)}
                  <div style={{ fontSize: 11, color: T.textMuted }}>{s(`Results after ${fmt(c.end_date, lang)}`, `النتيجة بعد ${fmt(c.end_date, lang)}`)}</div>
                </>
              ) : (
                <>
                  {s(`${c.participants} took part · ${c.completed} completed`, `${c.participants} شاركوا · ${c.completed} كمّلوا`)}
                  <div style={{ fontSize: 11, color: T.textMuted }}>
                    {c.completion_pct != null
                      ? s(`${c.completion_pct}% of the group`, `${c.completion_pct}٪ من المجموعة`)
                      : s('% hidden: group under 5', 'النسبة مخفية: المجموعة أقل من ٥')}
                  </div>
                </>
              )}
            </div>
            {statusBadge(c.status)}
            {c.status === 'upcoming' && (
              <HRButton theme={T} variant="ghost" size="sm" disabled={endingId === c.id} onClick={() => endChallenge(c)}>
                {s('Cancel', 'إلغاء')}
              </HRButton>
            )}
            {c.status === 'active' && (
              <ConfirmButton theme={T} lang={lang} label={s('End now', 'وقّفه دلوقتي')} busy={endingId === c.id}
                question={s('End this challenge today? People keep the days they logged.', 'توقّف التحدي ده النهارده؟ الناس هيحتفظوا بالأيام اللي سجّلوها.')}
                yes={s('Yes, end it', 'أيوه، وقّفه')} onConfirm={() => endChallenge(c)}/>
            )}
          </div>
          );
        })}
        {scheduled.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
            {s('No challenges yet.', 'لسه مفيش تحديات.')}
          </div>
        )}
      </Panel>
    </>
  );
}

export { HRChallengesPage };
