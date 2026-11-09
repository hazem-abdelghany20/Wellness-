import React from 'react';
import { typeStyles, Icon, Button, Card, Chip, SectionLabel, AvatarDisplay } from '../design-system.jsx';
import { fmtNum } from './shared.jsx';
import { useRecognitionBoard } from '../hooks/use-recognition.js';
import { topTodayLine } from '../lib/recognition.js';
import { setMyPrefs } from '../../lib/supabase-routines';

// The company board (sprint 2 item 15). Effort only: items ticked and
// streaks, never points or anything about health. Teams have no names of
// people; names appear only in 'named' mode, only for people who opted in,
// and never as a bottom list.

const INVITE_KEY = 'wp.board-invite-dismissed';
const TEAMS_SHOWN = 5;

function Names({ theme: T, lang, people, more }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const parts = [];
  people.forEach((p, i) => {
    if (i > 0) {
      const last = i === people.length - 1 && !more;
      parts.push(<span key={`s${i}`}>{last ? s(' and ', ' و') : s(', ', '، ')}</span>);
    }
    parts.push(<bdi key={p.user_id || i} style={{ color: T.text, fontWeight: 600 }}>{p.display_name}</bdi>);
  });
  if (more > 0) {
    parts.push(<span key="more">{people.length ? s(` and ${more} more`, ` و${fmtNum(more, 'ar')} كمان`) : s(`${more} ${more === 1 ? 'person' : 'people'}`, `${fmtNum(more, 'ar')} أشخاص`)}</span>);
  }
  return <>{parts}</>;
}

function PersonRow({ theme: T, lang, person, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
      <AvatarDisplay theme={T} kind={person.avatar_kind || 'monogram'} name={person.display_name || '?'} size={30}/>
      <bdi style={{ flex: 1, minWidth: 0, fontSize: 14, color: T.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {person.display_name}
      </bdi>
      <div style={{ fontSize: 13, color: T.textMuted, whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function readDismissed() {
  try { return globalThis.sessionStorage?.getItem(INVITE_KEY) === '1'; } catch { return false; }
}

function RecognitionBoard({ theme, lang, style }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const [period, setPeriod] = React.useState('today');
  const { view, loading, refetch } = useRecognitionBoard(period);
  const [dismissed, setDismissed] = React.useState(readDismissed);
  const [optingIn, setOptingIn] = React.useState(false);
  const [optError, setOptError] = React.useState(false);

  if (!view) {
    // Off for this company (or not loaded yet / failed): show nothing.
    return null;
  }

  const when = view.period === 'week' ? s('this week', 'الأسبوع ده') : s('today', 'النهارده');
  const n = (x) => fmtNum(x, lang);
  const teams = view.teams.slice(0, TEAMS_SHOWN);
  const moreTeams = Math.max(0, view.teams.length - teams.length);

  const optIn = async () => {
    setOptingIn(true); setOptError(false);
    try { await setMyPrefs({ recognition_opt_in: true }); await refetch(); }
    catch { setOptError(true); }
    finally { setOptingIn(false); }
  };
  const notNow = () => {
    setDismissed(true);
    try { globalThis.sessionStorage?.setItem(INVITE_KEY, '1'); } catch { /* storage blocked */ }
  };

  return (
    <div style={style} data-testid="recognition-board">
      <SectionLabel theme={T} style={{ padding: '0 6px', margin: '4px 0 10px' }}>{s('Company board', 'لوحة الشركة')}</SectionLabel>
      <Card theme={T} pad={18} radius={20}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }} role="group" aria-label={s('Period', 'الفترة')}>
          {[['today', s('Today', 'النهارده')], ['week', s('This week', 'الأسبوع ده')]].map(([k, label]) => (
            <Chip key={k} theme={T} active={period === k} onClick={() => setPeriod(k)}>{label}</Chip>
          ))}
        </div>

        {loading && view.period !== period ? (
          <div style={{ fontSize: 13, color: T.textMuted, padding: '6px 0' }}>{s('Loading…', 'جارٍ التحميل…')}</div>
        ) : (
          <>
            {teams.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 }}>
                  {s('Teams', 'الفرق')}
                </div>
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }} aria-label={s('Teams', 'الفرق')}>
                  {teams.map((t) => (
                    <li key={t.team_id || t.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, gap: 8 }}>
                        <div style={{ fontSize: 14, color: T.text, fontWeight: t.rank === 1 ? 700 : 500, minWidth: 0 }}>
                          {t.rank === 1 && <Icon name="trophy" size={14} style={{ color: T.accent, marginInlineEnd: 6, verticalAlign: '-2px' }}/>}
                          <bdi>{t.name}</bdi>
                        </div>
                        <div style={{ fontSize: 13, color: T.textMuted, whiteSpace: 'nowrap' }}>
                          {s(`${t.active_pct}% active`, `${n(t.active_pct)}٪ شاركوا`)}
                        </div>
                      </div>
                      <div style={{ height: 8, borderRadius: 99, background: T.track, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, Number(t.active_pct) || 0)}%`, height: '100%', borderRadius: 99, background: t.rank === 1 ? T.accent : T.accent + '88' }}/>
                      </div>
                    </li>
                  ))}
                </ol>
                {moreTeams > 0 && (
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>
                    {s(`+ ${moreTeams} more teams`, `+ ${n(moreTeams)} فرق كمان`)}
                  </div>
                )}
              </div>
            )}

            {view.named && (
              <div style={{ marginTop: teams.length ? 18 : 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {view.named.didEverythingCount > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>
                      {s('Did everything today', 'عملوا كل حاجة النهارده')}
                    </div>
                    <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.5 }}>
                      <Names theme={T} lang={lang} people={view.named.didEverything.names} more={view.named.didEverything.more}/>
                    </div>
                  </div>
                )}
                {view.named.top.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2 }}>
                      {s(`Most done ${when}`, `الأكتر ${when}`)}
                    </div>
                    {view.named.top.map((p) => (
                      <PersonRow key={p.user_id} theme={T} lang={lang} person={p}
                        value={s(`${p.items_done} done`, `${n(p.items_done)} خلّصها`)}/>
                    ))}
                  </div>
                )}
                {view.named.longestStreak.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2 }}>
                      {s('Longest streak', 'أطول سلسلة أيام')}
                    </div>
                    {view.named.longestStreak.map((p) => (
                      <PersonRow key={p.user_id} theme={T} lang={lang} person={p}
                        value={s(`${p.streak} ${p.streak === 1 ? 'day' : 'days'}`, `${n(p.streak)} يوم`)}/>
                    ))}
                  </div>
                )}
              </div>
            )}

            {view.empty && (
              <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.5 }}>
                {s(`Nobody is on the board ${when} yet. Tick something to get your team going.`,
                   `لسه محدش على اللوحة ${when}. علّم على أي حاجة وشجّع فريقك.`)}
              </div>
            )}
          </>
        )}

        {/* You */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 12, display: 'grid', placeItems: 'center', background: T.accentSoft, color: T.accent, flexShrink: 0 }}>
            <Icon name="user" size={16}/>
          </div>
          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.45, flex: 1 }}>
            <span style={{ fontWeight: 700 }}>{s('You', 'إنت')}</span>
            {' · '}
            {s(`${view.me.itemsDone} done ${when}`, `${n(view.me.itemsDone)} خلّصتها ${when}`)}
            {view.me.streak > 0 && <> · {s(`${view.me.streak}-day streak`, `${n(view.me.streak)} يوم ورا بعض`)}</>}
            {view.mode === 'named' && (
              <div style={{ color: T.textMuted }}>
                {view.me.optedIn
                  ? s('Your name can show on the board. Change it in Me.', 'اسمك ممكن يظهر على اللوحة. تقدر تغيّرها من «أنا».')
                  : s('Your name is not on the board.', 'اسمك مش ظاهر على اللوحة.')}
              </div>
            )}
          </div>
        </div>

        {view.inviteOptIn && !dismissed && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 16, background: T.accentSoft, border: `1px solid ${T.border}` }}
            role="region" aria-label={s('Show your name on the company board?', 'تظهر اسمك في لوحة الشركة؟')}>
            <div style={{ fontSize: 15, color: T.text, fontWeight: 700, marginBottom: 6 }}>
              {s('Show your name on the company board?', 'تظهر اسمك في لوحة الشركة؟')}
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
              {s('Your company can show the names of people who did their routine. Only what you did is shown, never anything about your health. You can turn it off any time in Me.',
                 'الشركة ممكن تعرض أسامي الناس اللي عملت الروتين. بيظهر بس اللي عملته، عمره ما هيظهر حاجة عن صحتك. تقدر تقفلها في أي وقت من «أنا».')}
            </div>
            {optError && (
              <div role="alert" style={{ fontSize: 13, color: T.negative, marginTop: 8 }}>{s('Could not save. Try again.', 'ما اتحفظش. جرّب تاني.')}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button theme={T} variant="primary" size="md" onClick={optIn} disabled={optingIn} style={{ flex: 2 }}>
                {optingIn ? s('Saving…', 'جارٍ الحفظ…') : s('Yes, show my name', 'أيوه، اظهر اسمي')}
              </Button>
              <Button theme={T} variant="secondary" size="md" onClick={notNow} style={{ flex: 1 }}>
                {s('Not now', 'مش دلوقتي')}
              </Button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 14, lineHeight: 1.5 }}>
          {view.mode === 'named'
            ? s('Effort only: items ticked and streaks. Names only of people who chose to show theirs. Never points or anything about health.',
                'المجهود بس: اللي اتعلّم عليه وكام يوم ورا بعض. الأسامي بس للي اختاروا يظهروها. عمر النقط أو أي حاجة عن الصحة ما بتظهر.')
            : s('Teams only, no names. Small teams are left out so nobody can be singled out.',
                'فرق بس، من غير أسامي. الفرق الصغيرة مش بتظهر علشان محدش يتعرف.')}
        </div>
      </Card>
    </div>
  );
}

// One line on the Today tab: "Top team today: Finance · 3 did everything today".
function TopTodayStrip({ theme, lang, onSeeBoard }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const { view } = useRecognitionBoard('today');
  const line = topTodayLine(view);
  if (!line) return null;
  return (
    <Card theme={T} pad={12} radius={18} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 12, display: 'grid', placeItems: 'center', background: T.accentSoft, color: T.accent, flexShrink: 0 }}>
        <Icon name="trophy" size={16}/>
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.text, lineHeight: 1.4 }} data-testid="top-today">
        {line.team && <>{s('Top team today: ', 'أحسن فريق النهارده: ')}<bdi style={{ fontWeight: 700 }}>{line.team}</bdi></>}
        {line.team && line.didEverything > 0 && ' · '}
        {line.didEverything > 0 && s(
          `${line.didEverything} ${line.didEverything === 1 ? 'person' : 'people'} did everything today`,
          `${fmtNum(line.didEverything, 'ar')} عملوا كل حاجة النهارده`)}
      </div>
      {onSeeBoard && (
        <button onClick={onSeeBoard} style={{
          background: 'transparent', border: 'none', color: T.accent, fontWeight: 700, fontSize: 13,
          cursor: 'pointer', padding: '6px 4px', whiteSpace: 'nowrap', fontFamily: 'inherit',
        }}>{s('See board', 'شوف اللوحة')}</button>
      )}
    </Card>
  );
}

export { RecognitionBoard, TopTodayStrip };
