import React, { useState, useMemo } from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, Badge } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useChallenges } from '../hooks/use-challenges.js';
import { friendlyErrorI18n } from '../../lib/errors';
import { habitCategory } from '../../shared/habit-meta.js';
import { ChallengeBuilder } from './challenge-builder.jsx';
import { saveChallengeTemplate, setLibraryStatus } from '../../lib/supabase-routines';
import { libraryError } from '../../shared/authoring/errors.js';
import { ConfirmButton } from '../../shared/authoring/ui.jsx';
import { templateWeeks, templateSuccessDays, payloadMediaKind, challengeEnd } from '../../shared/authoring/challenge-form.js';

// Habit challenges. HR picks a template (Wellness House's or their own,
// 1–4 weeks of Sun → Thu) and its first week, optionally for one team.
// One challenge at a time for the same people.

const iso = (d) => d.toISOString().slice(0, 10);

// Sundays from this week (if it hasn't ended) for the next 8 weeks.
function upcomingWeeks() {
  const today = new Date();
  const utc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const sunday = new Date(utc); sunday.setUTCDate(utc.getUTCDate() - utc.getUTCDay());
  const weeks = [];
  for (let i = 0; i < 9; i++) {
    const start = new Date(sunday); start.setUTCDate(sunday.getUTCDate() + 7 * i);
    const end = new Date(start); end.setUTCDate(start.getUTCDate() + 4);
    if (end < utc) continue; // this week already over (Fri/Sat)
    weeks.push({ start: iso(start), end: iso(end), index: i });
  }
  return weeks.slice(0, 8);
}

function fmt(isoDate, lang, opts = { day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { ...opts, timeZone: 'UTC' })
    .format(new Date(`${isoDate}T00:00:00Z`));
}

function HRChallengesPage({ theme, lang, density }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const { templates, scheduled, teams, loading, error, schedule, cancel, refetch } = useChallenges();
  const weeks = useMemo(upcomingWeeks, []);
  const [templateId, setTemplateId] = useState(null);
  const [weekStart, setWeekStart] = useState(() => weeks[0]?.start || '');
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  const [editing, setEditing] = useState(null); // { template, key }
  const [archivingId, setArchivingId] = useState(null);

  if (loading) {
    return <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>{s('Loading…', 'جارٍ التحميل…')}</div>;
  }

  const pick = (p, k) => (lang === 'ar' ? (p?.[`${k}_ar`] || p?.[`${k}_en`]) : p?.[`${k}_en`]) || '';
  const tTitle = (r) => (lang === 'ar' ? (r.title_ar || r.title_en) : r.title_en);
  const arrow = lang === 'ar' ? '←' : '→';
  const selected = templates.find((t) => t.id === templateId) || null;
  const selWeeks = templateWeeks(selected);
  const weekLabel = (w) => {
    const rel = w.index === 0 ? s(' · this week', ' · الأسبوع ده') : w.index === 1 ? s(' · next week', ' · الأسبوع الجاي') : '';
    // A multi-week challenge ends on the Thursday of its last week.
    const end = challengeEnd(w.start, selWeeks) || w.end;
    return `${fmt(w.start, lang, { weekday: 'short', day: 'numeric', month: 'short' })} ${arrow} ${fmt(end, lang, { weekday: 'short', day: 'numeric', month: 'short' })}${rel}`;
  };
  const own = templates.filter((t) => t.company_id);
  const shared = templates.filter((t) => !t.company_id);

  const openBuilder = (template) => { setFlash(null); setEditing({ template, key: `${template?.id || 'new'}-${Date.now()}` }); };
  async function handleSaveTemplate(input) {
    const saved = await saveChallengeTemplate(input);
    setEditing(null);
    await refetch();
    if (saved?.id) setTemplateId(saved.id);
    setFlash({ kind: 'ok', text: input.id
      ? s('Challenge saved. Weeks you schedule from now use the new version.', 'التحدي اتحفظ. الأسابيع اللي هتجدولها من دلوقتي هتاخد النسخة الجديدة.')
      : s('Challenge created and picked below. Now choose its first week.', 'التحدي اتعمل واتختار تحت. اختار أول أسبوع ليه.') });
  }
  async function archiveTemplate(t) {
    setArchivingId(t.id); setFlash(null);
    try {
      await setLibraryStatus('challenge_template', t.id, 'archived');
      if (templateId === t.id) setTemplateId(null);
      await refetch();
      setFlash({ kind: 'ok', text: s('Archived. Weeks already scheduled keep running.', 'اتأرشف. الأسابيع المجدولة هتكمّل.') });
    } catch (e) {
      setFlash({ kind: 'err', text: libraryError(e, lang) });
    } finally {
      setArchivingId(null);
    }
  }

  const nextWeekStart = weeks.find((w) => w.index === 1)?.start;
  // A multi-week challenge that started earlier can cover next week too.
  const nextWeekEmpty = nextWeekStart && !scheduled.some((c) =>
    c.status !== 'cancelled' && c.start_date <= nextWeekStart && (c.end_date || c.start_date) >= nextWeekStart);

  const handleSchedule = async () => {
    if (!templateId || !weekStart) return;
    setBusy(true); setFlash(null);
    try {
      await schedule(templateId, weekStart, teamId || null);
      setFlash({ kind: 'ok', text: s('Scheduled. Employees will see it on Sunday.', 'اتجدول. الموظفين هيشوفوه يوم الأحد.') });
      setTemplateId(null);
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.includes('habit_week_taken')) {
        const [ar, en] = String(e?.details || '').split(' | ');
        setFlash({ kind: 'err', text: s(`That week already has a challenge for these people: ${en || ''}. Pick another week or team.`,
                                        `الأسبوع ده فيه تحدي شغال لنفس الناس: ${ar || ''}. اختار أسبوع أو فريق تاني.`) });
      } else {
        setFlash({ kind: 'err', text: libraryError(e, lang) });
        // Archived since this page loaded: drop it from the picker.
        if (msg.includes('template_archived')) { setTemplateId(null); refetch(); }
      }
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
        eyebrow={s('One small habit at a time', 'عادة صغيرة واحدة كل مرة')}
        title={s('Challenges', 'التحديات')}
        sub={s('Employees tap "Did it" each workday. No scores, no ranking. Everyone who reaches the days needed gets a bronze reward.',
               'الموظف بيضغط «عملتها» كل يوم شغل. مفيش درجات ولا ترتيب. اللي يوصل لعدد الأيام المطلوب ياخد مكافأة برونزية.')}
        right={!editing ? <HRButton theme={T} variant="primary" icon="plus" onClick={() => openBuilder(null)}>{s('Create your own challenge', 'اعمل تحدي بتاعك')}</HRButton> : null}/>

      {editing && (
        <ChallengeBuilder key={editing.key} theme={T} lang={lang} density={density} template={editing.template}
          onSave={handleSaveTemplate} onCancel={() => setEditing(null)}/>
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
              <button onClick={() => setTemplateId(tp.id)} aria-pressed={sel} style={{ flex: 1,
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
          {selWeeks > 1 ? s('2 · Pick the first week and who', '٢ · اختار أول أسبوع ومين') : s('2 · Pick the week and who', '٢ · اختار الأسبوع ومين')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>
              {selWeeks > 1 ? s(`Starts (${selWeeks} weeks, Sun → Thu)`, `يبدأ (${selWeeks} أسابيع، الأحد ← الخميس)`) : s('Week (Sun → Thu)', 'الأسبوع (الأحد ← الخميس)')}
            </div>
            <select value={weekStart} onChange={(e) => setWeekStart(e.target.value)} style={field}>
              {weeks.map((w) => <option key={w.start} value={w.start}>{weekLabel(w)}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Who', 'مين')}</div>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={field}>
              <option value="">{s('All staff', 'كل الموظفين')}</option>
              {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
            </select>
          </div>
          <HRButton theme={T} variant="primary" disabled={!templateId || !weekStart || busy} onClick={handleSchedule}>
            {busy ? s('Scheduling…', 'جارٍ الجدولة…') : s('Schedule', 'جدولة')}
          </HRButton>
        </div>
        {flash && (
          <div style={{ marginTop: 12, fontSize: 13, color: flash.kind === 'ok' ? T.positive : T.danger }}>{flash.text}</div>
        )}
      </Panel>

      <div style={{ marginBottom: 12, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {s('Scheduled and past', 'المجدول والسابق')}
      </div>
      <Panel theme={T} density={density} pad={false}>
        {scheduled.map((c, i) => (
          <div key={c.id} style={{
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
            borderBottom: i < scheduled.length - 1 ? `1px solid ${T.divider}` : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{tTitle(c)}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                {c.team_name || s('All staff', 'كل الموظفين')} · {fmt(c.start_date, lang)} {arrow} {fmt(c.end_date, lang)}
                {c.auto && s(' · Picked by the app. Schedule your own for this week to replace it.', ' · التطبيق اختاره. جدول تحدي للأسبوع ده عشان تغيّره.')}
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
              <HRButton theme={T} variant="ghost" size="sm" onClick={() => cancel(c.id).catch((e) => setFlash({ kind: 'err', text: friendlyErrorI18n(e, lang) }))}>
                {s('Cancel', 'إلغاء')}
              </HRButton>
            )}
          </div>
        ))}
        {scheduled.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
            {s('No weekly challenges yet.', 'لسه مفيش تحديات أسبوعية.')}
          </div>
        )}
      </Panel>
    </>
  );
}

export { HRChallengesPage };
