import React from 'react';
import { typeStyles, Icon, Button, Card, SectionLabel } from '../design-system.jsx';
import { useScorecard } from '../hooks/use-scorecard.js';
import { fmtNum } from '../components/shared.jsx';

// Score tab: your points, and your team's average next to the company's.
// Points come from the challenge and the library only. No names, no ranking:
// group numbers are averages and only show for groups of 5+.

// A full challenge week: 5 days × 10 + 20 bonus. The ring fills against it.
const FULL_WEEK = 70;
const POINTS = { habit_days: 10, weeks_done: 20, articles: 5 };

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Counts from 0 up to `value` once, easing out.
function useCountUp(value, duration = 900, delay = 0) {
  const [n, setN] = React.useState(reducedMotion() ? value : 0);
  React.useEffect(() => {
    if (reducedMotion()) { setN(value); return undefined; }
    let raf; let start;
    const timer = setTimeout(() => {
      const step = (t) => {
        if (start === undefined) start = t;
        const p = Math.min(1, (t - start) / duration);
        setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [value, duration, delay]);
  return n;
}

// True one frame after mount, so CSS transitions run from their start state.
function useMounted(delay = 60) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const id = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(id);
  }, [delay]);
  return on;
}

function CountUp({ value, lang, delay }) {
  return <>{fmtNum(useCountUp(value || 0, 900, delay), lang)}</>;
}

function weekLabel(iso, lang) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`));
}

// Staggered entrance for each block.
const enter = (i) => ({ animation: `scIn .55s cubic-bezier(.2,.8,.2,1) ${0.08 * i}s both` });

function ScoreRing({ theme: T, value, lang }) {
  const size = 188, stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const on = useMounted(120);
  const frac = Math.min(1, value / FULL_WEEK);
  const over = value >= FULL_WEEK;
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      {/* soft glow behind the ring */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 18, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.accent}33 0%, transparent 70%)`,
        opacity: on ? 1 : 0, transition: 'opacity 1.2s ease .3s',
      }}/>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        <defs>
          <linearGradient id="scRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={T.accent}/>
            <stop offset="100%" stopColor={T.positive || T.accent}/>
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.track} strokeWidth={stroke} fill="none"/>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#scRing)" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={on ? c * (1 - frac) : c} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1)' }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 58, lineHeight: 1, color: T.text, letterSpacing: -1 }}>
          <CountUp value={value} lang={lang} delay={150}/>
        </div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6, letterSpacing: 0.3 }}>
          {lang === 'ar' ? 'نقطة الأسبوع ده' : 'points this week'}
        </div>
        {over && (
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: T.accent, animation: 'scPop .5s ease 1.3s both' }}>
            {lang === 'ar' ? 'أسبوع كامل ✦' : 'Full week ✦'}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ theme: T, label, value, lang, delay }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '12px 6px', borderRadius: 16, background: T.chipBg, border: `1px solid ${T.border}` }}>
      <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 26, color: T.text, lineHeight: 1 }}>
        <CountUp value={value} lang={lang} delay={delay}/>
      </div>
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function WeekBars({ theme: T, weeks, lang }) {
  const on = useMounted(200);
  const max = Math.max(FULL_WEEK, ...weeks.map((w) => w.points));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 132, padding: '4px 2px 0' }}>
      {weeks.map((w, i) => {
        const current = i === weeks.length - 1;
        const h = w.points > 0 ? Math.max(6, (w.points / max) * 100) : 3;
        return (
          <div key={w.week_start} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%' }}>
            <div style={{ fontSize: 11, color: current ? T.text : T.textMuted, fontWeight: current ? 700 : 500,
              opacity: on ? 1 : 0, transition: `opacity .4s ease ${0.6 + i * 0.07}s` }}>
              {w.points > 0 ? fmtNum(w.points, lang) : ''}
            </div>
            <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%', height: on ? `${h}%` : '0%', borderRadius: 10,
                background: current
                  ? `linear-gradient(to top, ${T.accent}, ${T.positive || T.accent})`
                  : (w.points > 0 ? T.accent + '55' : T.track),
                boxShadow: current && w.points > 0 ? `0 6px 18px ${T.accent}40` : 'none',
                transition: `height .9s cubic-bezier(.2,.8,.2,1) ${i * 0.07}s`,
              }}/>
            </div>
            <div style={{ fontSize: 10, color: current ? T.text : T.textFaint, whiteSpace: 'nowrap', fontWeight: current ? 700 : 400 }}>
              {current ? (lang === 'ar' ? 'دلوقتي' : 'Now') : weekLabel(w.week_start, lang)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Three horizontal bars: you, team average, company average.
function CompareBars({ theme: T, rows, lang }) {
  const on = useMounted(250);
  const max = Math.max(10, ...rows.map((r) => r.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rows.map((r, i) => (
        <div key={r.key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
            <div style={{ fontSize: 13, color: r.strong ? T.text : T.textMid || T.text, fontWeight: r.strong ? 700 : 500 }}>{r.label}</div>
            <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 20, color: T.text }}>
              <CountUp value={r.value} lang={lang} delay={250 + i * 120}/>
            </div>
          </div>
          <div style={{ height: 10, borderRadius: 99, background: T.track, overflow: 'hidden' }}>
            <div style={{
              width: on ? `${Math.max(r.value > 0 ? 3 : 0, (r.value / max) * 100)}%` : '0%', height: '100%', borderRadius: 99,
              background: r.strong ? `linear-gradient(to right, ${T.accent}, ${T.positive || T.accent})` : r.color,
              transition: `width 1s cubic-bezier(.2,.8,.2,1) ${0.15 + i * 0.12}s`,
            }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScreenScorecard({ theme, dir, go }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const { data, loading, error, refetch } = useScorecard();

  const shell = (children) => (
    <div className="wp-score" style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 'var(--wp-top)', paddingBottom: 'var(--wp-tabpad)', boxSizing: 'border-box' }}>
      <div style={{ padding: '16px 22px 14px' }}>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 30, letterSpacing: -0.5, color: T.text }}>
          {s('Your score', 'نقاطك')}
        </div>
        <div style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }}>
          {s('Only you see your points.', 'نقاطك محدش يشوفها غيرك.')}
        </div>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      <style>{`
        @keyframes scIn { 0%{opacity:0;transform:translateY(14px) scale(.985);} 100%{opacity:1;transform:none;} }
        @keyframes scPop { 0%{opacity:0;transform:scale(.6);} 70%{transform:scale(1.08);} 100%{opacity:1;transform:scale(1);} }
        @keyframes scPulse { 0%,100%{opacity:.45;} 50%{opacity:.9;} }
        @media (prefers-reduced-motion: reduce) { .wp-score * { animation: none !important; transition: none !important; } }
      `}</style>
    </div>
  );

  if (loading && !data) {
    return shell(
      <>
        {[220, 150, 180].map((h, i) => (
          <div key={i} style={{ height: h, borderRadius: 24, background: T.surface, border: `1px solid ${T.border}`, animation: `scPulse 1.4s ease ${i * 0.15}s infinite` }}/>
        ))}
      </>
    );
  }

  if (error || !data) {
    return shell(
      <Card theme={T} pad={22} radius={22}>
        <div style={{ fontSize: 16, color: T.text, fontWeight: 600, marginBottom: 12 }}>
          {s('Could not load your score.', 'مقدرناش نحمّل نقاطك.')}
        </div>
        <Button theme={T} variant="soft" size="md" onClick={refetch}>{s('Try again', 'جرّب تاني')}</Button>
      </Card>
    );
  }

  const me = data.me;
  const parts = me.week_parts;
  const group = data.team || data.company;
  const isTeam = !!data.team;
  const quiet = me.week === 0;

  const breakdown = [
    { key: 'habit_days', icon: 'check', color: T.accent, label: s('Challenge days', 'أيام التحدي'), count: parts.habit_days },
    { key: 'weeks_done', icon: 'trophy', color: '#F5B544', label: s('Week completed', 'أسبوع مكتمل'), count: parts.weeks_done },
    { key: 'articles', icon: 'book', color: T.positive || T.accent, label: s('Articles finished', 'مقالات خلصتها'), count: parts.articles },
  ];

  return shell(
    <>
      {/* Hero: this week's ring + all-time stats */}
      <Card theme={T} pad={22} radius={26} style={{ ...enter(0), overflow: 'hidden', position: 'relative' }}>
        <ScoreRing theme={T} value={me.week} lang={lang}/>
        <div style={{ textAlign: 'center', fontSize: 13, color: T.textMuted, marginTop: 14, lineHeight: 1.5 }}>
          {quiet
            ? s('A fresh week. Log today in the challenge to get going.', 'أسبوع جديد. سجّل النهارده في التحدي وابدأ.')
            : s(`A full challenge week is ${FULL_WEEK} points.`, `أسبوع التحدي الكامل = ${fmtNum(FULL_WEEK, lang)} نقطة.`)}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <Stat theme={T} label={s('All time', 'من الأول')} value={me.total} lang={lang} delay={300}/>
          <Stat theme={T} label={s('Best week', 'أحسن أسبوع')} value={me.best_week} lang={lang} delay={420}/>
          <Stat theme={T} label={s('Weeks completed', 'أسابيع مكتملة')} value={me.total_parts.weeks_done} lang={lang} delay={540}/>
        </div>
        {quiet && (
          <div style={{ marginTop: 16 }}>
            <Button theme={T} variant="primary" icon="trophy" onClick={() => go('challenges')} style={{ width: '100%' }}>
              {s('Go to this week’s challenge', 'روح لتحدي الأسبوع')}
            </Button>
          </div>
        )}
      </Card>

      {/* Where this week's points came from */}
      <div style={enter(1)}>
        <SectionLabel theme={T} style={{ padding: '0 6px', margin: '4px 0 10px' }}>{s('This week', 'الأسبوع ده')}</SectionLabel>
        <Card theme={T} pad={6} radius={20}>
          {breakdown.map((b, i) => (
            <div key={b.key} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px',
              borderTop: i ? `1px solid ${T.border}` : 'none',
              animation: `scIn .5s cubic-bezier(.2,.8,.2,1) ${0.25 + i * 0.08}s both`,
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: b.color + '22', color: b.color, flexShrink: 0 }}>
                <Icon name={b.icon} size={18}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{b.label}</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                  {fmtNum(b.count, lang)} × {fmtNum(POINTS[b.key], lang)}
                </div>
              </div>
              <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 22, color: b.count ? T.text : T.textFaint }}>
                <bdi dir="ltr">+<CountUp value={b.count * POINTS[b.key]} lang={lang} delay={400 + i * 100}/></bdi>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Last 6 weeks */}
      <div style={enter(2)}>
        <SectionLabel theme={T} style={{ padding: '0 6px', margin: '4px 0 10px' }}>{s('Last 6 weeks', 'آخر ٦ أسابيع')}</SectionLabel>
        <Card theme={T} pad={18} radius={20}>
          <WeekBars theme={T} weeks={me.weekly || []} lang={lang}/>
        </Card>
      </div>

      {/* Team */}
      <div style={enter(3)}>
        <SectionLabel theme={T} style={{ padding: '0 6px', margin: '4px 0 10px' }}
          right={group ? s(`${group.active} of ${group.members} active this week`, `${fmtNum(group.active, lang)} من ${fmtNum(group.members, lang)} شاركوا الأسبوع ده`) : null}>
          {isTeam ? s(`Team · ${data.team.name}`, `الفريق · ${data.team.name}`) : s('Your team', 'فريقك')}
        </SectionLabel>
        <Card theme={T} pad={20} radius={20}>
          {group ? (
            <>
              <CompareBars theme={T} lang={lang} rows={[
                { key: 'me', label: s('You', 'إنت'), value: me.week, strong: true },
                ...(data.team ? [{ key: 'team', label: s('Team average', 'متوسط الفريق'), value: data.team.avg_week, color: T.accent + '88' }] : []),
                ...(data.company ? [{ key: 'company', label: s('Company average', 'متوسط الشركة'), value: data.company.avg_week, color: T.textFaint }] : []),
              ]}/>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 16, lineHeight: 1.5 }}>
                {isTeam
                  ? s('Averages per person this week. No names, no ranking.', 'متوسط لكل شخص الأسبوع ده. من غير أسامي ومن غير ترتيب.')
                  : s('Your team is under 5 people, so you see the company average to keep everyone anonymous.',
                      'فريقك أقل من ٥ أشخاص، فبتشوف متوسط الشركة علشان محدش يتعرف.')}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: T.chipBg, color: T.textMuted, flexShrink: 0 }}>
                <Icon name="users" size={18}/>
              </div>
              <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.55 }}>
                {s('Team scores appear once at least 5 people have joined, so nobody can be singled out.',
                   'نقاط الفريق بتظهر لما ٥ أشخاص على الأقل ينضموا، علشان محدش يتعرف.')}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* How points work */}
      <div style={enter(4)}>
        <SectionLabel theme={T} style={{ padding: '0 6px', margin: '4px 0 10px' }}>{s('How points work', 'النقاط بتتحسب إزاي')}</SectionLabel>
        <Card theme={T} pad={18} radius={20} alt>
          {[
            [s('Each challenge day you log', 'كل يوم تسجّله في التحدي'), '+10'],
            [s('Complete the week (4 of 5 days)', 'تكمّل الأسبوع (٤ من ٥ أيام)'), '+20'],
            [s('Each article you read to the end', 'كل مقال تقراه للآخر'), '+5'],
          ].map(([label, pts], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 14, color: T.text }}>
              <span>{label}</span>
              <bdi dir="ltr" style={{ fontWeight: 700, color: T.accent }}>{lang === 'ar' ? pts.replace(/\d+/, (d) => fmtNum(Number(d), 'ar')) : pts}</bdi>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

export { ScreenScorecard };
