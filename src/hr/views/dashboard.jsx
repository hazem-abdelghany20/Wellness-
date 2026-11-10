import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { Broadcasts } from '../sections.jsx';
import { useParticipation } from '../hooks/use-participation.js';
import { useBroadcasts } from '../hooks/use-broadcasts.js';
import { useHRAuth } from '../state/auth-context.jsx';
import { JoinLinkCard } from '../../shared/join-link-card.jsx';
import { DashboardTeamsCard } from './dashboard-teams.jsx';

// HR dashboard: participation only. Who takes part in the weekly
// challenge, who completes it, what people read, and (when a routine is
// assigned) today's routine ticks. No health data.

// Compact "Today's routine" card: shown only while a routine is assigned.
function TodayRoutineCard({ theme, lang, density, routine, onOpen }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const num = (n) => (n == null ? '—' : lang === 'ar' ? new Intl.NumberFormat('ar-EG').format(n) : String(n));
  const r = routine || {};
  const pct = r.pct_today;
  return (
    <Panel theme={T} density={density} style={{ marginBottom: DENSITY[density].gap }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 150 }}>
          <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{s("Today's routine", 'روتين النهارده')}</div>
          <div className="display" style={{ fontSize: 30, color: T.text, lineHeight: 1.1, marginTop: 4 }}>
            {num(r.done_today ?? 0)}<span style={{ color: T.textFaint, fontSize: 20 }}> / {num(r.due_today ?? 0)}</span>
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{s('items done of items due', 'عناصر اتعملت من المطلوب')}</div>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ height: 10, borderRadius: 99, background: T.panelSunk, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%`, height: '100%', background: T.accent, borderRadius: 99 }}/>
          </div>
          <div style={{ fontSize: 12, color: T.textMid, marginTop: 8 }}>
            {pct != null ? s(`${pct}% done`, `${num(pct)}٪ اتعمل`) : s('% hidden: fewer than 5 people', 'النسبة مخفية: أقل من ٥')}
            {' · '}{s(`${r.active_today ?? 0} of ${r.assigned_today ?? 0} people active today`, `${num(r.active_today ?? 0)} من ${num(r.assigned_today ?? 0)} نشطين النهارده`)}
          </div>
        </div>
        <HRButton theme={T} size="sm" variant="secondary" iconR="arrow" onClick={onOpen}>{s('See the report', 'شوف التقرير')}</HRButton>
      </div>
    </Panel>
  );
}

function HRDashboard({ theme, S, cfg, density, gap, range, companyName, firstName, setNav }) {
  const T = theme;
  const lang = cfg.lang;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const num = (n) => (n == null ? '—' : lang === 'ar' ? new Intl.NumberFormat('ar-EG').format(n) : String(n));
  const { data, loading, error } = useParticipation(range);
  const { list: broadcasts } = useBroadcasts();
  const { company } = useHRAuth();

  const hour = new Date().getHours();
  const partOfDay = lang === 'ar'
    ? (hour < 12 ? 'صباح الخير' : 'مساء الخير')
    : (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
  const greeting = firstName ? `${partOfDay}, ${firstName}` : partOfDay;
  const rangeLabel = { '7d': s('last 7 days', 'آخر ٧ أيام'), '30d': s('last 30 days', 'آخر ٣٠ يوم'), '90d': s('last 90 days', 'آخر ٩٠ يوم') }[range] || range;

  if (loading && !data) {
    return <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>{s('Loading…', 'جارٍ التحميل…')}</div>;
  }

  const d = data || {};
  const members = d.members ?? 0;
  const tiles = [
    { label: s('On the app', 'على التطبيق'), value: num(members), sub: s('employees', 'موظف') },
    { label: s('Took part', 'شاركوا'), value: num(d.took_part),
      sub: d.participation_pct != null ? s(`${d.participation_pct}% of employees`, `${num(d.participation_pct)}٪ من الموظفين`) : s('in a weekly challenge', 'في تحدي أسبوعي') },
    { label: s('Completed a challenge', 'كمّلوا تحدي'), value: num(d.completed), sub: s('4 of 5 days or more', '٤ من ٥ أيام أو أكتر') },
    { label: s('Articles read', 'مقالات اتقرت'), value: num(d.reads),
      sub: s(`${d.readers ?? 0} readers · ${d.finished_reads ?? 0} to the end`, `${num(d.readers)} قارئ · ${num(d.finished_reads)} للآخر`) },
  ];

  const weekly = d.weekly || [];
  const maxW = Math.max(1, ...weekly.map((w) => Math.max(w.took_part || 0, w.readers || 0)));
  const cur = d.current;
  const fmtDate = (iso) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <div className="display" style={{ fontSize: 38, color: T.text, letterSpacing: -0.8, lineHeight: 1 }}>{greeting}</div>
        <div style={{ fontSize: 14, color: T.textMuted, marginTop: 8 }}>
          <strong style={{ color: T.textMid }}>{companyName || ''}</strong>{companyName ? ' · ' : ''}{rangeLabel} · {s('participation only, no health data', 'المشاركة بس، من غير أي بيانات صحية')}
        </div>
      </div>

      {error && (
        <Panel theme={T} density={density} style={{ marginBottom: gap }}>
          <div style={{ fontSize: 13, color: T.danger }}>{s('Could not load the dashboard.', 'تعذّر تحميل اللوحة.')}</div>
        </Panel>
      )}

      {/* Getting started: until a handful of people are on the app, put the
          join link where HR lands. */}
      {company?.code && members < 5 && (
        <Panel theme={T} density={density} pad={false} style={{ marginBottom: gap }}>
          <PanelHeader theme={T} density={density}
            title={s('Invite your team', 'ادعُ فريقك')}
            subtitle={s('Share the join link or QR, or import everyone from a sheet.', 'شارك رابط الانضمام أو رمز QR، أو استورد الجميع من ملف.')}
            right={<HRButton theme={T} size="sm" variant="secondary" icon="people" onClick={() => setNav && setNav('people')}>{s('Import people', 'استيراد الأشخاص')}</HRButton>}/>
          <div style={{ padding: DENSITY[density].cardPad }}>
            <JoinLinkCard theme={T} lang={lang} code={company.code} companyName={company.name} compact/>
          </div>
        </Panel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap, marginBottom: gap }}>
        {tiles.map((t) => (
          <Panel key={t.label} theme={T} density={density}>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{t.label}</div>
            <div className="display" style={{ fontSize: 40, color: T.text, lineHeight: 1.1, marginTop: 8 }}>{t.value}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{t.sub}</div>
          </Panel>
        ))}
      </div>

      {d.routine?.has_routine && (
        <TodayRoutineCard theme={T} lang={lang} density={density} routine={d.routine} onOpen={() => setNav && setNav('report')}/>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap, marginBottom: gap }}>
        <Panel theme={T} density={density} pad={false}>
          <PanelHeader theme={T} density={density} title={s("This week's challenge", 'تحدي الأسبوع')}
            right={<HRButton theme={T} size="sm" onClick={() => setNav && setNav('challenges')}>{s('Manage', 'إدارة')}</HRButton>}/>
          <div style={{ padding: DENSITY[density].cardPad }}>
            {cur ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 18, color: T.text, fontWeight: 700 }}>{lang === 'ar' ? (cur.title_ar || cur.title_en) : cur.title_en}</div>
                  <Badge theme={T} tone={cur.status === 'active' ? 'positive' : 'neutral'}>{cur.status === 'active' ? s('Running', 'شغال') : s('Upcoming', 'جاي')}</Badge>
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>
                  {cur.team_name || s('All staff', 'كل الموظفين')} · {fmtDate(cur.start_date)} {lang === 'ar' ? '←' : '→'} {fmtDate(cur.end_date)}
                </div>
                <div style={{ fontSize: 14, color: T.textMid, marginTop: 16 }}>
                  {cur.status === 'active'
                    ? s(`${cur.participants} taking part so far · results after Thursday`, `${num(cur.participants)} بيشاركوا لحد دلوقتي · النتيجة بعد الخميس`)
                    : s('Starts on Sunday.', 'يبدأ يوم الأحد.')}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
                {s('No challenge is running or scheduled.', 'مفيش تحدي شغال أو متجدول.')}
                <div style={{ marginTop: 12 }}>
                  <HRButton theme={T} variant="primary" size="sm" onClick={() => setNav && setNav('challenges')}>{s('Pick one', 'اختار تحدي')}</HRButton>
                </div>
              </div>
            )}
          </div>
        </Panel>

        <Panel theme={T} density={density} pad={false}>
          <PanelHeader theme={T} density={density} title={s('Week by week', 'أسبوع بأسبوع')}
            subtitle={s('People taking part and people reading', 'اللي بيشاركوا واللي بيقروا')}/>
          <div style={{ padding: DENSITY[density].cardPad }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
              {weekly.map((w) => (
                <div key={w.week_start} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 110 }}>
                    <div title={`${w.took_part}`} style={{ width: 10, height: `${(100 * (w.took_part || 0)) / maxW}%`, minHeight: 2, background: T.accent, borderRadius: 3 }}/>
                    <div title={`${w.readers}`} style={{ width: 10, height: `${(100 * (w.readers || 0)) / maxW}%`, minHeight: 2, background: T.info || T.textMuted, borderRadius: 3, opacity: 0.8 }}/>
                  </div>
                  <div style={{ fontSize: 10, color: T.textFaint }}>{fmtDate(w.week_start)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: T.textMuted }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: T.accent, marginInlineEnd: 6 }}/>{s('Took part in the challenge', 'شاركوا في التحدي')}</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: T.info || T.textMuted, marginInlineEnd: 6 }}/>{s('Read an article', 'قروا مقال')}</span>
            </div>
          </div>
        </Panel>
      </div>

      <div style={{ marginBottom: gap }}>
        <DashboardTeamsCard theme={T} lang={lang} density={density} companyId={company?.id || null} setNav={setNav}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap, marginBottom: gap }}>
        <Panel theme={T} density={density} pad={false}>
          <PanelHeader theme={T} density={density} title={s('Most read', 'الأكتر قراية')} subtitle={rangeLabel}/>
          <div>
            {(d.top_articles || []).length === 0 ? (
              <div style={{ padding: DENSITY[density].cardPad, fontSize: 13, color: T.textMuted }}>{s('No reads yet.', 'لسه مفيش قراية.')}</div>
            ) : (d.top_articles || []).map((a, i, arr) => (
              <div key={a.id} style={{
                padding: `12px ${DENSITY[density].cardPad}px`, display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lang === 'ar' ? (a.title_ar || a.title_en) : a.title_en}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>{num(a.reads)} {s('reads', 'قراية')}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Broadcasts theme={T} S={S} lang={lang} density={density} list={broadcasts} onNew={() => setNav && setNav('broadcasts')}/>
      </div>
    </>
  );
}

export { HRDashboard };
