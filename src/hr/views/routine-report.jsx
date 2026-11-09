import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge, AvatarMark } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { Tabs, Loading, EmptyState, Flash } from '../../shared/authoring/ui.jsx';
import { shapeRoutineReport, REPORT_RANGES, rangeLabel, PEOPLE_WHY } from '../../shared/authoring/report-shape.js';
import { downloadRoutineReport } from '../../shared/authoring/sheet-files.js';
import { libraryError } from '../../shared/authoring/errors.js';
import { fmtNum, fmtPct, fmtDate, msgText } from '../../shared/authoring/text.js';
import { getRoutineReport, getRoutinePeople } from '../../lib/supabase-routines';

function Tile({ theme, density, label, value, sub }) {
  const T = theme;
  return (
    <Panel theme={T} density={density}>
      <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{label}</div>
      <div className="display" style={{ fontSize: 36, color: T.text, lineHeight: 1.1, marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{sub}</div>
    </Panel>
  );
}

function Bar({ theme, pct, color }) {
  const T = theme;
  return (
    <div style={{ height: 8, background: T.panelSunk, borderRadius: 99, overflow: 'hidden', flex: 1, minWidth: 60 }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%`, height: '100%', background: color || T.accent, borderRadius: 99 }}/>
    </div>
  );
}

// HR → Routine report: today, by day, by team, by exercise, by hour; and
// the names of people who chose to share their progress (when switched on).
function HRRoutineReportPage({ theme, lang, density, setNav, companyName }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const n = (v) => fmtNum(v, lang);
  const gap = DENSITY[density].gap;
  const [range, setRange] = React.useState('14d');
  const [report, setReport] = React.useState(null);
  const [people, setPeople] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [flash, setFlash] = React.useState(null);

  React.useEffect(() => {
    let live = true;
    setLoading(true); setError(null);
    Promise.all([getRoutineReport(range), getRoutinePeople(range).catch(() => null)])
      .then(([r, p]) => { if (live) { setReport(r); setPeople(p); } })
      .catch((e) => { if (live) setError(e); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [range]);

  const shaped = report ? shapeRoutineReport(report, lang) : null;

  async function exportXlsx() {
    setFlash(null);
    try { await downloadRoutineReport(report, people, { lang, companyName }); }
    catch (e) { setFlash({ kind: 'err', text: libraryError(e, lang) }); }
  }

  const header = (
    <HRPageHeader theme={T}
      eyebrow={s('Routine report', 'تقرير الروتين')}
      title={s('How the routine is going', 'الروتين ماشي إزاي')}
      sub={s('Counts only. Nobody is named unless they chose to share.', 'أرقام بس. محدش بيتذكر اسمه غير لو هو اختار يشارك.')}
      right={<>
        <Tabs theme={T} value={range} onChange={setRange} label={s('Period', 'الفترة')}
          tabs={REPORT_RANGES.map((r) => ({ id: r, label: lang === 'ar' ? `${n(parseInt(r, 10))} يوم` : r }))}/>
        <HRButton theme={T} variant="secondary" icon="download" disabled={!report} onClick={exportXlsx}>{s('Export .xlsx', 'صدّر ‎.xlsx')}</HRButton>
      </>}/>
  );

  if (loading && !report) return <>{header}<Loading theme={T} lang={lang}/></>;
  if (error && !report) {
    return <>{header}<Panel theme={T} density={density}><div role="alert" style={{ fontSize: 13, color: T.danger }}>{libraryError(error, lang)}</div></Panel></>;
  }
  if (!shaped.hasRoutine && !shaped.hasTicks) {
    return (
      <>
        {header}
        <EmptyState theme={T} density={density}
          text={s('No routine is assigned yet. Build one and choose who gets it; the numbers show here from the first tick.',
                  'لسه مفيش روتين متوزّع. اعمل واحد واختار مين ياخده؛ الأرقام هتظهر هنا من أول علامة.')}
          action={setNav ? <HRButton theme={T} variant="primary" size="sm" onClick={() => setNav('routines')}>{s('Go to Routines', 'روح للروتين')}</HRButton> : null}/>
      </>
    );
  }

  const { today, totals } = shaped;
  const exCount = shaped.exercises.length;
  const leastFrom = exCount > 5 ? exCount - 3 : exCount;

  return (
    <>
      {header}
      <Flash theme={T} flash={flash}/>
      {shaped.suppressed && (
        <Panel theme={T} density={density} style={{ marginBottom: gap, borderColor: T.caution }}>
          <div style={{ fontSize: 13, color: T.text }}>
            {s(`Fewer than ${shaped.minCohort} people are on the app, so percentages are hidden to keep everyone anonymous.`,
               `أقل من ${n(shaped.minCohort)} على التطبيق، فالنسب مخفية علشان محدش يتعرف.`)}
          </div>
        </Panel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap, marginBottom: gap }}>
        <Tile theme={T} density={density} label={s('Done today', 'اتعمل النهارده')}
          value={`${n(today.done)}/${n(today.due)}`}
          sub={today.pct != null ? s(`${today.pct}% of today’s items`, `${fmtPct(today.pct, lang)} من عناصر النهارده`) : s('items ticked of items due', 'عناصر اتعلّم عليها من المطلوب')}/>
        <Tile theme={T} density={density} label={s('Active today', 'نشطين النهارده')}
          value={n(today.active)}
          sub={s(`of ${today.assigned} people with a routine today`, `من ${n(today.assigned)} عندهم روتين النهارده`)}/>
        <Tile theme={T} density={density} label={s('Completion', 'نسبة الإنجاز')}
          value={fmtPct(totals.pct, lang)}
          sub={s(`${totals.done} of ${totals.due} items · ${rangeLabel(range, 'en').toLowerCase()}`, `${n(totals.done)} من ${n(totals.due)} · ${rangeLabel(range, 'ar')}`)}/>
        <Tile theme={T} density={density} label={s('Full days', 'أيام كاملة')}
          value={n(totals.fullDays)}
          sub={s(`days someone did everything · ${totals.activePeople} people active`, `أيام حد عمل فيها كله · ${n(totals.activePeople)} نشطين`)}/>
      </div>

      <Panel theme={T} density={density} pad={false} style={{ marginBottom: gap }}>
        <PanelHeader theme={T} density={density} title={s('Day by day', 'يوم بيوم')}
          subtitle={s('Items ticked (dark) of items due (light), on each workday', 'العناصر اللي اتعلّم عليها (غامق) من المطلوب (فاتح) في كل يوم شغل')}/>
        <div style={{ padding: DENSITY[density].cardPad, overflowX: 'auto' }}>
          {shaped.byDay.length === 0 ? (
            <div style={{ fontSize: 13, color: T.textMuted }}>{s('Nothing due in this period yet.', 'لسه مفيش حاجة مطلوبة في الفترة دي.')}</div>
          ) : (
            <div role="list" aria-label={s('By day', 'باليوم')} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 150, minWidth: shaped.byDay.length * 26 }}>
              {shaped.byDay.map((d) => (
                <div role="listitem" key={d.date} title={`${d.title}: ${d.done}/${d.due}${d.pct != null ? ` · ${d.pct}%` : ''}`}
                  style={{ flex: 1, minWidth: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ position: 'relative', width: '70%', maxWidth: 28, height: 110, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(100 * (d.due || 0)) / shaped.maxDayDue}%`, background: T.accentSoft, borderRadius: 4 }}/>
                    <div style={{ position: 'relative', width: '100%', height: `${(100 * Math.min(d.done || 0, d.due || d.done || 0)) / shaped.maxDayDue}%`, minHeight: d.done ? 2 : 0, background: T.accent, borderRadius: 4 }}/>
                  </div>
                  <div style={{ fontSize: 10, color: T.textFaint, whiteSpace: 'nowrap' }}>{d.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap, marginBottom: gap }}>
        <Panel theme={T} density={density} pad={false}>
          <PanelHeader theme={T} density={density} title={s('By team', 'بالفريق')}
            subtitle={s(`Teams under ${shaped.minCohort} people are grouped as “Small teams”.`, `الفرق الأقل من ${n(shaped.minCohort)} متجمّعة في «فرق صغيرة».`)}/>
          {shaped.teams.length === 0 ? (
            <div style={{ padding: DENSITY[density].cardPad, fontSize: 13, color: T.textMuted }}>{s('No team is big enough to show yet.', 'مفيش فريق كبير كفاية يظهر لسه.')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: T.textMuted, textAlign: 'start' }}>
                    {[s('Team', 'الفريق'), s('People', 'العدد'), s('Active', 'نشطين'), s('Completion', 'الإنجاز'), s('Items a day', 'في اليوم')].map((h) => (
                      <th key={h} style={{ textAlign: 'start', padding: '8px 14px', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shaped.teams.map((t, i) => (
                    <tr key={t.team_id || (t.small ? 'small' : `no-team-${i}`)} style={{ borderTop: `1px solid ${T.divider}`, color: T.text }}>
                      <td style={{ padding: '9px 14px', fontWeight: 600 }}>
                        {t.label}
                        {t.department && <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400 }}>{t.department}</div>}
                      </td>
                      <td style={{ padding: '9px 14px' }} className="mono">{n(t.members)}</td>
                      <td style={{ padding: '9px 14px' }} className="mono">{fmtPct(t.active_pct, lang)}</td>
                      <td style={{ padding: '9px 14px', minWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Bar theme={T} pct={t.completion_pct}/><span className="mono">{fmtPct(t.completion_pct, lang)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '9px 14px' }} className="mono">{t.avg_items_per_day == null ? '—' : n(t.avg_items_per_day)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {shaped.smallTeamsHidden && (
            <div style={{ padding: '10px 14px', fontSize: 11, color: T.textMuted, borderTop: `1px solid ${T.divider}` }}>
              {s(`Some small teams together are still under ${shaped.minCohort} people, so they aren’t shown.`,
                 `فيه فرق صغيرة مع بعض لسه أقل من ${n(shaped.minCohort)}، فمش ظاهرة.`)}
            </div>
          )}
        </Panel>

        <Panel theme={T} density={density} pad={false}>
          <PanelHeader theme={T} density={density} title={s('Exercises, most to least done', 'التمارين من الأكتر للأقل')}
            subtitle={s('The least done ones may need a better video or a word from the coach.', 'الأقل ممكن تحتاج فيديو أوضح أو كلمة من المدرب.')}/>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {exCount === 0 ? (
              <div style={{ padding: DENSITY[density].cardPad, fontSize: 13, color: T.textMuted }}>{s('No exercises due in this period.', 'مفيش تمارين مطلوبة في الفترة دي.')}</div>
            ) : shaped.exercises.map((x, i) => (
              <div key={x.key || i} style={{ padding: '9px 16px', borderTop: i ? `1px solid ${T.divider}` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{ fontSize: 11, color: T.textFaint, width: 20 }}>{n(i + 1)}</span>
                <span style={{ flex: 1.4, minWidth: 0, fontSize: 13, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.title}</span>
                {i >= leastFrom && exCount > 5 && <Badge theme={T} tone="caution">{s('Least done', 'الأقل')}</Badge>}
                <Bar theme={T} pct={x.pct} color={i >= leastFrom && exCount > 5 ? T.caution : T.accent}/>
                <span className="mono" style={{ fontSize: 11, color: T.textMid, minWidth: 64, textAlign: 'end' }}>{n(x.done)}/{n(x.due)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel theme={T} density={density} pad={false} style={{ marginBottom: gap }}>
        <PanelHeader theme={T} density={density} title={s('When people tick', 'الناس بتعلّم إمتى')}
          subtitle={s(`By hour, company time (${report.timezone || ''}). Helps you pick reminder times.`, `بالساعة، بتوقيت الشركة (${report.timezone || ''}). بيساعدك تختار مواعيد التذكير.`)}/>
        <div style={{ padding: DENSITY[density].cardPad }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }} dir="ltr">
            {shaped.hours.map((h) => (
              <div key={h.hour} title={`${String(h.hour).padStart(2, '0')}:00 · ${h.checks}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: '70%', maxWidth: 24, height: `${(80 * h.checks) / shaped.maxHour}px`, minHeight: h.checks ? 2 : 1, background: h.checks ? T.info : T.divider, borderRadius: 3 }}/>
                <div className="mono" style={{ fontSize: 10, color: T.textFaint }}>{String(h.hour).padStart(2, '0')}</div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <PeoplePanel theme={T} lang={lang} density={density} people={people} setNav={setNav}/>
    </>
  );
}

function PeoplePanel({ theme, lang, density, people, setNav }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const n = (v) => fmtNum(v, lang);
  if (!people || !people.enabled) {
    return (
      <Panel theme={T} density={density}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, fontSize: 13, color: T.textMid, lineHeight: 1.55 }}>
            {s('Names are off. If you turn on “Show names of people who share their progress”, you’ll see only the people who chose to share.',
               'الأسامي مقفولة. لو فتحت «إظهار أسامي اللي بيشاركوا تقدمهم»، هتشوف بس الناس اللي اختاروا يشاركوا.')}
          </div>
          {setNav && <HRButton theme={T} variant="secondary" size="sm" onClick={() => setNav('settings')}>{s('Open Settings', 'افتح الإعدادات')}</HRButton>}
        </div>
      </Panel>
    );
  }
  const list = people.people || [];
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={s('People who share their progress', 'اللي بيشاركوا تقدمهم')}
        subtitle={s(`${people.opted_in} share · ${people.not_shared} don’t (counted, not named)`, `${n(people.opted_in)} بيشاركوا · ${n(people.not_shared)} لأ (بيتعدّوا من غير أسامي)`)}/>
      <div style={{ padding: `10px ${DENSITY[density].cardPad}px`, fontSize: 12, color: T.textMuted, borderBottom: `1px solid ${T.divider}` }}>{msgText(PEOPLE_WHY, lang)}</div>
      {list.length === 0 ? (
        <div style={{ padding: DENSITY[density].cardPad, fontSize: 13, color: T.textMuted }}>{s('Nobody has chosen to share yet.', 'لسه محدش اختار يشارك.')}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {[s('Name', 'الاسم'), s('Team', 'الفريق'), s('Days active', 'أيام نشاط'), s('Items done', 'اتعمل'), s('Full days', 'أيام كاملة'), s('Streak', 'ورا بعض'), s('Last active', 'آخر نشاط')].map((h) => (
                  <th key={h} style={{ textAlign: 'start', padding: '8px 14px', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700, color: T.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.user_id} style={{ borderTop: `1px solid ${T.divider}`, color: T.text }}>
                  <td style={{ padding: '8px 14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><AvatarMark theme={T} name={p.display_name || p.initials || '?'} size={26}/>{p.display_name}</span>
                  </td>
                  <td style={{ padding: '8px 14px', color: T.textMid }}>{p.team_name || '—'}</td>
                  <td style={{ padding: '8px 14px' }} className="mono">{n(p.days_active)}</td>
                  <td style={{ padding: '8px 14px' }} className="mono">{n(p.items_done)}</td>
                  <td style={{ padding: '8px 14px' }} className="mono">{n(p.full_days)}</td>
                  <td style={{ padding: '8px 14px' }} className="mono">{n(p.streak)}</td>
                  <td style={{ padding: '8px 14px', color: T.textMid }}>{p.last_active ? fmtDate(p.last_active, lang) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export { HRRoutineReportPage };
