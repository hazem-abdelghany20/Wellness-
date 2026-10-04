import React, { useState, useMemo } from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, Badge } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useChallenges } from '../hooks/use-challenges.js';
import { friendlyErrorI18n } from '../../lib/errors';

// Weekly habit challenges. HR picks one template and one week (Sun → Thu),
// optionally for one team. One challenge at a time for the same people.

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
  const { templates, scheduled, teams, loading, error, schedule, cancel } = useChallenges();
  const weeks = useMemo(upcomingWeeks, []);
  const [templateId, setTemplateId] = useState(null);
  const [weekStart, setWeekStart] = useState(() => weeks[0]?.start || '');
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  if (loading) {
    return <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>{s('Loading…', 'جارٍ التحميل…')}</div>;
  }

  const pick = (p, k) => (lang === 'ar' ? (p?.[`${k}_ar`] || p?.[`${k}_en`]) : p?.[`${k}_en`]) || '';
  const tTitle = (r) => (lang === 'ar' ? (r.title_ar || r.title_en) : r.title_en);
  const weekLabel = (w) => {
    const rel = w.index === 0 ? s(' · this week', ' · الأسبوع ده') : w.index === 1 ? s(' · next week', ' · الأسبوع الجاي') : '';
    return `${fmt(w.start, lang, { weekday: 'short', day: 'numeric', month: 'short' })} → ${fmt(w.end, lang, { weekday: 'short', day: 'numeric', month: 'short' })}${rel}`;
  };

  const nextWeekStart = weeks.find((w) => w.index === 1)?.start;
  const nextWeekEmpty = nextWeekStart && !scheduled.some((c) =>
    c.status !== 'cancelled' && c.start_date === nextWeekStart);

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
        setFlash({ kind: 'err', text: friendlyErrorI18n(e, lang) });
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
        eyebrow={s('One small habit per week', 'عادة صغيرة واحدة كل أسبوع')}
        title={s('Weekly challenges', 'تحديات الأسبوع')}
        sub={s('Employees tap "Did it" each day. No scores, no ranking. Everyone who does it 4 of 5 days gets a bronze reward.',
               'الموظف بيضغط «عملتها» كل يوم. مفيش درجات ولا ترتيب. اللي يعملها ٤ من ٥ أيام ياخد مكافأة برونزية.')}/>

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {templates.map((tp) => {
            const p = tp.payload || {};
            const sel = tp.id === templateId;
            return (
              <button key={tp.id} onClick={() => setTemplateId(tp.id)} style={{
                textAlign: lang === 'ar' ? 'right' : 'left', cursor: 'pointer', fontFamily: 'inherit',
                background: sel ? T.panelSunk : 'transparent', color: T.text,
                border: `1.5px solid ${sel ? T.accent : T.border}`, borderRadius: 12, padding: 14,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{tTitle(tp)}</div>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: p.badge_color || T.accent }}/>
                </div>
                <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.5, marginBottom: 8 }}>{pick(p, 'action')}</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>
                  {p.check_mode === 'next_morning'
                    ? s('Evening habit · logged next morning', 'عادة بالليل · بتتسجل الصبح')
                    : s('Daytime habit · logged same day', 'عادة بالنهار · بتتسجل نفس اليوم')}
                  {' · '}{s(`${p.success_days || 4} of 5 days`, `${p.success_days || 4} من ٥ أيام`)}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, margin: '20px 0 10px' }}>
          {s('2 · Pick the week and who', '٢ · اختار الأسبوع ومين')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Week (Sun → Thu)', 'الأسبوع (الأحد ← الخميس)')}</div>
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
                {c.team_name || s('All staff', 'كل الموظفين')} · {fmt(c.start_date, lang)} → {fmt(c.end_date, lang)}
              </div>
            </div>
            <div style={{ fontSize: 12, color: T.textMid, textAlign: lang === 'ar' ? 'left' : 'right', minWidth: 170 }}>
              {c.status === 'upcoming' || c.status === 'cancelled' ? '—' : (
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
