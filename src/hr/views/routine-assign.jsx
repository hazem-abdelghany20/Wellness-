import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { Field, Choice, inputStyle, ConfirmButton } from '../../shared/authoring/ui.jsx';
import { libraryError } from '../../shared/authoring/errors.js';
import { pickLang, fmtDate, upcomingSunday, weekdayOf } from '../../shared/authoring/text.js';

// Give a routine to everyone or one team, from a date, optionally until a date.
export function AssignPanel({ theme, lang, density, routine, teams = [], today, onAssign, onClose }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const sunday = upcomingSunday(today);
  const [who, setWho] = React.useState('all');
  const [teamId, setTeamId] = React.useState('');
  const [startsOn, setStartsOn] = React.useState(sunday);
  const [endsOn, setEndsOn] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const title = pickLang(lang, routine?.title_en, routine?.title_ar);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (who === 'team' && !teamId) { setError(s('Pick the team.', 'اختار الفريق.')); return; }
    if (!startsOn) { setError(s('Pick a start date.', 'اختار تاريخ البداية.')); return; }
    if (startsOn < today) { setError(s('Pick today or a later date.', 'اختار النهارده أو تاريخ بعده.')); return; }
    if (endsOn && endsOn < startsOn) { setError(s('The end date must be on or after the start date.', 'تاريخ النهاية لازم يكون بعد البداية أو نفس اليوم.')); return; }
    setBusy(true);
    try {
      await onAssign({ routineId: routine.id, teamId: who === 'team' ? teamId : null, startsOn, endsOn: endsOn || null });
    } catch (err) {
      setError(libraryError(err, lang));
      setBusy(false);
    }
  }

  const day = (iso) => fmtDate(iso, lang, { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap, borderColor: T.accent }}>
      <PanelHeader theme={T} density={density}
        title={s(`Who gets “${title}”?`, `مين ياخد «${title}»؟`)}
        subtitle={s('They see it on their Today tab from the start date.', 'هيظهر لهم في «النهارده» من تاريخ البداية.')}
        right={<HRButton theme={T} variant="ghost" size="sm" icon="close" onClick={onClose}>{s('Close', 'قفل')}</HRButton>}/>
      <form onSubmit={submit} noValidate aria-label={s('Assign routine', 'وزّع الروتين')} style={{ padding: DENSITY[density].cardPad }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          <Field theme={T} label={s('Who', 'مين')}
            hint={teams.length ? s('A team’s own routine replaces the company-wide one for that team.', 'روتين الفريق بيحل محل روتين الشركة كلها للفريق ده.') : null}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Choice theme={T} selected={who === 'all'} onClick={() => setWho('all')}>{s('Everyone', 'كل الموظفين')}</Choice>
              <Choice theme={T} selected={who === 'team'} onClick={() => setWho('team')} disabled={!teams.length}
                title={!teams.length ? s('No teams yet. Add teams when you import people.', 'لسه مفيش فرق. ضيف الفرق وانت بتستورد الموظفين.') : undefined}>
                {s('One team', 'فريق واحد')}
              </Choice>
            </div>
            {who === 'team' && (
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label={s('Team', 'الفريق')} style={{ ...inputStyle(T), marginTop: 8 }}>
                <option value="">{s('Pick a team…', 'اختار فريق…')}</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </Field>
          <Field theme={T} label={s('Starts', 'يبدأ')} hint={day(startsOn)}>
            <input type="date" value={startsOn} min={today} onChange={(e) => setStartsOn(e.target.value)}
              aria-label={s('Start date', 'تاريخ البداية')} style={inputStyle(T)}/>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {weekdayOf(today) !== 0 && <Choice theme={T} selected={startsOn === today} onClick={() => setStartsOn(today)} style={{ padding: '4px 10px', fontSize: 11 }}>{s('Today', 'النهارده')}</Choice>}
              <Choice theme={T} selected={startsOn === sunday} onClick={() => setStartsOn(sunday)} style={{ padding: '4px 10px', fontSize: 11 }}>
                {weekdayOf(today) === 0 ? s('Today (Sunday)', 'النهارده (الأحد)') : s('This Sunday', 'الأحد الجاي')}
              </Choice>
            </div>
          </Field>
          <Field theme={T} lang={lang} optional label={s('Ends', 'ينتهي')} hint={endsOn ? day(endsOn) : s('Empty: it keeps going until you end it.', 'فاضي: هيفضل شغال لحد ما توقفه.')}>
            <input type="date" value={endsOn} min={startsOn || today} onChange={(e) => setEndsOn(e.target.value)}
              aria-label={s('End date', 'تاريخ النهاية')} style={inputStyle(T)}/>
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          <HRButton theme={T} type="submit" variant="primary" icon="check" disabled={busy}>{busy ? s('Assigning…', 'جارٍ التوزيع…') : s('Assign', 'وزّع')}</HRButton>
          <HRButton theme={T} variant="ghost" onClick={onClose}>{s('Not now', 'مش دلوقتي')}</HRButton>
          {error && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{error}</span>}
        </div>
      </form>
    </Panel>
  );
}

const STATUS = {
  active: ['positive', 'Running', 'شغال'],
  upcoming: ['info', 'Upcoming', 'جاي'],
  ended: ['neutral', 'Ended', 'خلص'],
  cancelled: ['neutral', 'Cancelled', 'اتلغى'],
};

// Every assignment: routine, who, dates, status, and End / Cancel.
export function AssignmentsPanel({ theme, lang, density, assignments = [], onEnd }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const [busyId, setBusyId] = React.useState(null);
  const [error, setError] = React.useState(null);
  if (!assignments.length) return null;
  const arrow = lang === 'ar' ? '←' : '→';
  const live = assignments.filter((a) => a.status === 'active' || a.status === 'upcoming');
  const past = assignments.filter((a) => a.status === 'ended' || a.status === 'cancelled').slice(0, 5);

  async function end(a) {
    setBusyId(a.id); setError(null);
    try { await onEnd(a); } catch (e) { setError(libraryError(e, lang)); } finally { setBusyId(null); }
  }

  const row = (a, i, arr) => {
    const [tone, en, ar] = STATUS[a.status] || STATUS.ended;
    return (
      <div key={a.id} style={{
        padding: `${DENSITY[density].cellPadY}px ${DENSITY[density].cardPad}px`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{pickLang(lang, a.routine_title_en, a.routine_title_ar)}</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
            {a.team_name || s('Everyone', 'كل الموظفين')} · {fmtDate(a.starts_on, lang)} {arrow} {a.ends_on ? fmtDate(a.ends_on, lang) : s('no end date', 'من غير نهاية')}
          </div>
        </div>
        <Badge theme={T} tone={tone}>{s(en, ar)}</Badge>
        {a.status === 'active' && (
          <ConfirmButton theme={T} lang={lang} label={s('End', 'وقّفه')} busy={busyId === a.id}
            question={s('End it? It shows today, then stops.', 'توقّفه؟ هيظهر النهارده وبعدين يقف.')}
            yes={s('Yes, end', 'أيوه، وقّفه')} onConfirm={() => end(a)}/>
        )}
        {a.status === 'upcoming' && (
          <ConfirmButton theme={T} lang={lang} label={s('Cancel', 'إلغاء')} busy={busyId === a.id}
            question={s('Cancel it?', 'تلغيه؟')} yes={s('Yes, cancel', 'أيوه، الغيه')} onConfirm={() => end(a)}/>
        )}
      </div>
    );
  };

  return (
    <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap }}>
      <PanelHeader theme={T} density={density} title={s('Who has which routine', 'مين معاه أنهي روتين')}
        subtitle={s('Running and upcoming first.', 'الشغال والجاي الأول.')}/>
      {live.length === 0 ? (
        <div style={{ padding: DENSITY[density].cardPad, fontSize: 13, color: T.textMuted }}>{s('No routine is running now.', 'مفيش روتين شغال دلوقتي.')}</div>
      ) : live.map(row)}
      {past.length > 0 && (
        <div style={{ borderTop: `1px solid ${T.divider}`, opacity: 0.75 }}>{past.map(row)}</div>
      )}
      {error && <div role="alert" style={{ padding: '8px 18px 14px', fontSize: 12, color: T.danger }}>{error}</div>}
    </Panel>
  );
}
