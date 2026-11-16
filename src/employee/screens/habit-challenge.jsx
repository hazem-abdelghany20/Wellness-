import React from 'react';
import { typeStyles, Icon, Button, Card, SectionLabel } from '../design-system.jsx';
import { useHabitChallenges } from '../hooks/use-habit-challenge.js';
import { getContentBySlug, listSignatureChallenges } from '../../lib/supabase';
import { SignaturePathCard, IconBtn, fmtNum } from '../components/shared.jsx';
import { toPlayerItem } from '../lib/content-item.js';
import { HabitMedia } from '../components/habit-media.jsx';
import { challengeDays, dotRows, challengeDayOf } from '../lib/challenge-days.js';

// Habit challenges: one small daily action each, on workdays (Sun → Thu),
// chosen by HR. No scores and no ranking — a "Did it" tap, a dot per workday
// (from the server's `days`), and one shared team bar.
//
// Sprint 4: HR can run several at once, each with its own dates (3 days,
// 5 weeks…). One challenge looks as it always did. Several stack as cards,
// each with its dates, "day X of Y", its own button and dots; the rest
// (video, team bar, why) opens under "More". A challenge made of routine
// exercises counts by itself: no button, it lists what to tick in Today.

const num = (n, lang) => (lang === 'ar' ? new Intl.NumberFormat('ar-EG').format(n) : String(n));

function dayLabel(iso, lang) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`));
}

function dateLabel(iso, lang) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`));
}

const dateRange = (c, lang) => `${dateLabel(c.start_date, lang)} ${lang === 'ar' ? '←' : '→'} ${dateLabel(c.end_date, lang)}`;

// A challenge that counts by itself: what to tick in Today, and the way there.
function AutoFromRoutine({ theme: T, lang, state, go, hasRoutine }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const items = Array.isArray(state.routine_items) ? state.routine_items : [];
  return (
    <div data-testid="challenge-auto">
      <div style={{ color: T.textMuted, fontSize: 14, lineHeight: 1.5 }}>
        {s('This one counts by itself. Tick these in Today:', 'ده بيتحسب لوحده. علّم على دول في «النهارده»:')}
      </div>
      {items.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
          {items.map((it) => {
            const title = lang === 'ar' ? (it.title_ar || it.title_en) : (it.title_en || it.title_ar);
            const due = !!it.due_today;
            return (
              <li key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                <span role={it.checked ? 'img' : undefined} aria-label={it.checked ? s('Ticked', 'اتعلّم عليها') : undefined}
                  aria-hidden={it.checked ? undefined : 'true'}
                  style={{
                    width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center',
                    background: it.checked ? T.accent : 'transparent', color: T.accentInk,
                    border: `2px solid ${it.checked ? T.accent : T.borderStrong}`, opacity: due || it.checked ? 1 : 0.5,
                  }}>
                  {it.checked ? <Icon name="check" size={12}/> : null}
                </span>
                <bdi style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.35, color: due ? T.text : T.textMuted }}>{title}</bdi>
                {!due && <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>{s('Not today', 'مش النهارده')}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {state.logged_target && (
        <div style={{ color: T.positive || T.accent, fontSize: 14, marginTop: 12, textAlign: 'center' }}>
          {s('Today is counted ✓', 'النهارده اتحسب ✓')}
        </div>
      )}
      {hasRoutine && (
        <Button theme={T} variant={state.logged_target ? 'secondary' : 'primary'} onClick={() => go('today')} style={{ width: '100%', marginTop: 14 }}>
          {s('Go to Today', 'روح على «النهارده»')}
        </Button>
      )}
    </div>
  );
}

// One challenge. Alone on the screen (stacked = false) it is the card plus
// the "Your team" and "Why this helps" cards. In a stack it is one card:
// title, dates · day X of Y, the action, its button and dots, with the rest
// under "More".
function ChallengeView({ theme: T, lang, state, stacked = false, open = true, onToggleOpen, saving, saveFailed, onLog, go, hasRoutine }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const [articleBusy, setArticleBusy] = React.useState(false);
  const c = state.challenge;
  const p = c.payload || {};
  const pick = (k) => (lang === 'ar' ? (p[`${k}_ar`] || p[`${k}_en`]) : p[`${k}_en`]) || '';
  const title = lang === 'ar' ? (c.title_ar || c.title_en) : c.title_en;
  const evening = p.check_mode === 'next_morning';
  const auto = !!state.auto_from_routine;
  const detailsId = `wp-challenge-more-${c.id}`;

  if (state.status === 'upcoming') {
    return (
      <Card theme={T} pad={22} radius={stacked ? 24 : 22}>
        <div data-challenge-id={c.id}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
            {s('Starts', 'يبدأ')} {dayLabel(c.start_date, lang)} {dateLabel(c.start_date, lang)}
          </div>
          <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: stacked ? 24 : 28, color: T.text, marginTop: 8, lineHeight: 1.15 }}>{title}</div>
          {stacked && <div style={{ color: T.textMuted, fontSize: 13, marginTop: 4 }}>{dateRange(c, lang)}</div>}
          <div style={{ color: T.textMid || T.text, fontSize: 15, lineHeight: 1.5, marginTop: 10 }}>{pick('action')}</div>
          <HabitMedia theme={T} lang={lang} payload={p} title={title}/>
        </div>
      </Card>
    );
  }

  const days = challengeDays(state);
  const rows = dotRows(days);
  const multiWeek = rows.length > 1;
  const done = new Set((state.my_dates || []).map((d) => String(d).slice(0, 10)));
  const target = state.target_date;
  const need = state.success_days || 4;
  const count = state.my_count || 0;
  const missedSome = days.some((d) => d < target && !done.has(d));
  const earned = count >= need;
  const dayOf = challengeDayOf(state, days);

  const openArticle = async () => {
    if (!p.article_slug) return;
    setArticleBusy(true);
    try {
      const row = await getContentBySlug(p.article_slug);
      if (row) {
        go('player', { item: toPlayerItem(row) });
      }
    } finally { setArticleBusy(false); }
  };

  const doneLabel = evening
    ? s('✓ Did it last night', '✓ عملتها امبارح بالليل')
    : s('✓ Did it today', '✓ عملتها النهارده');

  const main = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: stacked ? 6 : 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', flexShrink: 0,
          background: (p.badge_color || T.accent) + '26', color: p.badge_color || T.accent,
        }}>
          <Icon name={p.badge_icon || 'trophy'} size={22}/>
        </div>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: stacked ? 24 : 26, color: T.text, lineHeight: 1.1, flex: 1 }}>{title}</div>
      </div>
      {stacked && (
        <div style={{ color: T.textMuted, fontSize: 13, marginBottom: 12 }}>
          {dateRange(c, lang)}
          {dayOf && <> · <span style={{ color: T.text, fontWeight: 600 }}>{s(`Day ${dayOf.day} of ${dayOf.total}`, `اليوم ${num(dayOf.day, lang)} من ${num(dayOf.total, lang)}`)}</span></>}
        </div>
      )}
      {!(auto && (state.routine_items || []).length > 0) && (
        <div style={{ color: T.text, fontSize: 16, lineHeight: 1.55 }}>{pick('action')}</div>
      )}
      {/* How-to video or image, only when the template has one */}
      {(!stacked || open) && <HabitMedia theme={T} lang={lang} payload={p} title={title}/>}

      <div style={{ marginTop: 20 }}>
        {auto ? (
          <AutoFromRoutine theme={T} lang={lang} state={state} go={go} hasRoutine={hasRoutine}/>
        ) : state.can_log ? (
          state.logged_target ? (
            <Button theme={T} variant="secondary" onClick={onLog} disabled={saving} style={{ width: '100%' }}>
              {saving ? s('Saving…', 'جارٍ الحفظ…') : s('Done ✓  Tap to undo', 'تمام ✓  اضغط للتراجع')}
            </Button>
          ) : (
            <Button theme={T} variant="primary" onClick={onLog} disabled={saving} style={{ width: '100%' }}>
              {saving ? s('Saving…', 'جارٍ الحفظ…') : doneLabel}
            </Button>
          )
        ) : (
          <div style={{ color: T.textMuted, fontSize: 14, lineHeight: 1.5, textAlign: 'center', padding: '6px 0' }}>
            {evening
              ? s('Tonight is night one. Come back tomorrow morning to log it.', 'الليلة دي أول ليلة. ارجع بكره الصبح سجّلها.')
              : s('This week is over. Rewards land in Mine.', 'الأسبوع خلص. المكافآت بتنزل في «حسابي».')}
          </div>
        )}
        {saveFailed && (
          <div role="alert" style={{ color: T.negative || '#c0392b', fontSize: 13, marginTop: 10, textAlign: 'center' }}>
            {s('Could not save. Try again.', 'ما اتحفظش. جرّب تاني.')}
          </div>
        )}
      </div>

      {/* A dot per workday, from the server's days: one row per week, lined up
          under Sun…Thu when the challenge runs over several weeks. */}
      {rows.map((w, wi) => (
        <div key={w.weekStart} style={{ marginTop: wi === 0 ? 22 : 14 }}>
          {multiWeek && (
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.textMuted, marginBottom: 8 }}>
              {s(`Week ${wi + 1} of ${rows.length}`, `الأسبوع ${num(wi + 1, lang)} من ${num(rows.length, lang)}`)}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {w.slots.map((d, si) => {
              if (!d) return <div key={`gap-${si}`} aria-hidden="true" style={{ flex: 1 }}/>;
              const isDone = done.has(d);
              const isTarget = d === target;
              const isPast = d < target;
              const bg = isDone ? T.accent : 'transparent';
              const border = isDone ? T.accent : isTarget ? T.text : T.border;
              return (
                <div key={d} data-day={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 999, background: bg,
                    border: `2px solid ${border}`, display: 'grid', placeItems: 'center',
                    color: isDone ? T.accentInk : T.textFaint, opacity: isPast && !isDone ? 0.55 : 1,
                  }}>
                    {isDone ? <Icon name="check" size={16}/> : null}
                  </div>
                  <div style={{ fontSize: 11, color: isTarget ? T.text : T.textMuted, fontWeight: isTarget ? 700 : 500 }}>
                    {dayLabel(d, lang)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 16, fontSize: 14, color: earned ? T.positive || T.accent : T.textMuted, textAlign: 'center', lineHeight: 1.5 }}>
        {earned
          ? s('You made it. Your reward lands in Mine after the week ends.', 'كمّلتها 🎉 مكافأتك هتنزل في «حسابي» بعد ما الأسبوع يخلص.')
          : s(`${count} of ${need} days for the reward`, `${num(count, lang)} من ${num(need, lang)} أيام للمكافأة`)}
      </div>
      {missedSome && !earned && pick('missed') && (
        <div style={{ marginTop: 8, fontSize: 13, color: T.textMuted, textAlign: 'center', lineHeight: 1.5 }}>{pick('missed')}</div>
      )}
    </>
  );

  const team = state.team_pct != null ? (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 14, color: T.text }}>{s('Days done together', 'الأيام اللي اتعملت مع بعض')}</div>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 26, color: T.text }}>{num(state.team_pct, lang)}{lang === 'ar' ? '٪' : '%'}</div>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: T.track, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, state.team_pct)}%`, height: '100%', background: T.accent, borderRadius: 99, transition: 'width .4s ease' }}/>
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 10 }}>
        {s('One bar for everyone. No ranking.', 'شريط واحد للكل. مفيش ترتيب.')}
      </div>
    </>
  ) : (
    <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
      {s('Team progress appears once the group is big enough to stay anonymous.', 'تقدم الفريق بيظهر لما المجموعة تبقى كبيرة كفاية علشان محدش يتعرف.')}
    </div>
  );

  // HR's own challenges may have no "why" text: then there is nothing to show.
  const hasWhy = !!(pick('why') || pick('tip') || p.article_slug);
  const why = (
    <>
      <div style={{ fontSize: 15, color: T.text, lineHeight: 1.55 }}>{pick('why')}</div>
      {pick('tip') && (
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5, marginTop: 12 }}>
          <span style={{ fontWeight: 700 }}>{s('Tip: ', 'نصيحة: ')}</span>{pick('tip')}
        </div>
      )}
      {p.article_slug && (
        <div style={{ marginTop: 16 }}>
          <Button theme={T} variant="soft" size="sm" icon="book" onClick={openArticle} disabled={articleBusy}>
            {s('Read the article', 'اقرا المقال')}
          </Button>
        </div>
      )}
    </>
  );

  if (!stacked) {
    return (
      <>
        <Card theme={T} pad={22} radius={24}><div data-challenge-id={c.id}>{main}</div></Card>

        <SectionLabel theme={T} style={{ padding: '0 6px', margin: '6px 0 0' }}>{s('Your team', 'فريقك')}</SectionLabel>
        <Card theme={T} pad={18} radius={20}>{team}</Card>

        <SectionLabel theme={T} style={{ padding: '0 6px', margin: '6px 0 0' }}>{s('Why this helps', 'ليه ده مفيد')}</SectionLabel>
        <Card theme={T} pad={18} radius={20}>{why}</Card>
      </>
    );
  }

  const subLabel = (text) => (
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.textMuted, marginBottom: 8 }}>{text}</div>
  );
  return (
    <Card theme={T} pad={22} radius={24}>
      <div data-challenge-id={c.id}>
        {main}
        {open && (
          <div id={detailsId} style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            {subLabel(s('Your team', 'فريقك'))}
            {team}
            {hasWhy && (
              <div style={{ marginTop: 18 }}>
                {subLabel(s('Why this helps', 'ليه ده مفيد'))}
                {why}
              </div>
            )}
          </div>
        )}
        <button type="button" onClick={onToggleOpen} aria-expanded={!!open} aria-controls={open ? detailsId : undefined}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', minHeight: 44,
            marginTop: 12, marginBottom: -10, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
            color: T.accent, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
          }}>
          {open ? s('Show less', 'اعرض أقل') : s('More about this challenge', 'تفاصيل أكتر عن التحدي')}
          <Icon name={open ? 'chevUp' : 'chevDown'} size={14}/>
        </button>
      </div>
    </Card>
  );
}

// hasRoutine: Today exists for this person (a routine is assigned), so a
// challenge that counts from the routine can send them there.
function ScreenHabitChallenge({ theme, dir, go, state: app, hasRoutine = false }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const { list, loading, saving, error, toggle } = useHabitChallenges();
  const challenges = list || [];
  const single = challenges.length === 1 ? challenges[0] : null;
  const many = challenges.length > 1;
  // In a stack, the first card shows its details; "More" opens another one.
  const [openId, setOpenId] = React.useState(undefined);
  const shownId = openId === undefined ? (challenges[0]?.challenge?.id ?? null) : openId;
  const singleWeeks = single ? dotRows(challengeDays(single)).length : 1;
  const unread = app?.unreadCount || 0;
  // Sabr / Niyyah / Ramadan: optional personal paths, separate from the
  // weekly challenge HR runs. A company's own run hides once its end date
  // has passed; the shared paths (no company) are self-paced, so the dates
  // they were seeded with don't apply.
  const [paths, setPaths] = React.useState([]);
  React.useEffect(() => {
    let alive = true;
    const today = new Date().toISOString().slice(0, 10);
    listSignatureChallenges()
      .then((rows) => { if (alive) setPaths((rows || []).filter((r) => !r.company_id || !r.end_date || r.end_date >= today)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const pathsSection = paths.length > 0 && (
    <div style={{ marginTop: 18 }}>
      <SectionLabel theme={T} style={{ padding: '0 6px', margin: '0 0 10px' }}>{s('Personal paths', 'مسارات شخصية')}</SectionLabel>
      <div style={{ color: T.textMuted, fontSize: 13, padding: '0 6px 12px', lineHeight: 1.5 }}>
        {s('Optional, at your own pace.', 'اختيارية، على راحتك.')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {paths.map((sig) => (
          <SignaturePathCard key={sig.id} theme={T} lang={lang} sig={sig} onOpen={() => go('competition-path', { id: sig.id })}/>
        ))}
      </div>
    </div>
  );

  const shell = (children) => (
    <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 'var(--wp-top)', paddingBottom: 'var(--wp-tabpad)', boxSizing: 'border-box' }}>
      <div style={{ padding: '16px 22px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
       <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 30, letterSpacing: -0.5, color: T.text }}>
          {many
            ? s('Your challenges', 'تحدياتك')
            : singleWeeks > 1 ? s('Your challenge', 'التحدي بتاعك') : s('This week', 'تحدي الأسبوع')}
        </div>
        {single?.challenge && (
          <div style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }}>
            {dateRange(single.challenge, lang)}
          </div>
        )}
        {many && (
          <div style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }}>
            {s('Each one counts on its own.', 'كل واحد بيتحسب لوحده.')}
          </div>
        )}
       </div>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <IconBtn theme={T} icon="bell" onClick={() => go('notifs')}
            aria-label={s(`Notifications${unread ? ` (${unread} new)` : ''}`, `الإشعارات${unread ? ` (${fmtNum(unread, lang)} جديدة)` : ''}`)}/>
          {unread > 0 && (
            <span aria-hidden="true" style={{
              position: 'absolute', top: -2, insetInlineEnd: -2, minWidth: 18, height: 18, padding: '0 5px',
              borderRadius: 999, background: T.accent, color: T.accentInk, fontSize: 10, fontWeight: 700,
              display: 'grid', placeItems: 'center', border: `2px solid ${T.bg}`, boxSizing: 'border-box',
            }}>{unread > 9 ? '9+' : fmtNum(unread, lang)}</span>
          )}
        </div>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>{children}{pathsSection}</div>
    </div>
  );

  if (loading && !list) {
    return shell(<div style={{ color: T.textMuted, fontSize: 14, padding: '40px 6px', textAlign: 'center' }}>{s('Loading…', 'جارٍ التحميل…')}</div>);
  }

  if (!challenges.length) {
    return shell(
      <Card theme={T} pad={22} radius={22}>
        <div style={{ fontSize: 18, color: T.text, fontWeight: 600, marginBottom: 6 }}>
          {s('No challenge this week', 'مفيش تحدي الأسبوع ده')}
        </div>
        <div style={{ color: T.textMuted, fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
          {s('Your HR team picks one small challenge each week. Meanwhile, read something short from the library.',
             'فريق الـ HR بيختار تحدي صغير كل أسبوع. لحد ما يبدأ، اقرا حاجة قصيرة من المكتبة.')}
        </div>
        <Button theme={T} variant="soft" size="md" icon="library" onClick={() => go('library')}>
          {s('Open library', 'افتح المكتبة')}
        </Button>
      </Card>
    );
  }

  const view = (st, stacked) => {
    const id = st.challenge.id;
    return (
      <ChallengeView key={id} theme={T} lang={lang} state={st} stacked={stacked} go={go} hasRoutine={hasRoutine}
        open={!stacked || shownId === id} onToggleOpen={() => setOpenId(shownId === id ? null : id)}
        saving={saving === id} saveFailed={!!error && error.id === id} onLog={() => toggle(id)}/>
    );
  };

  if (single) return shell(view(single, false));

  return shell(
    <div role="list" aria-label={s('Your challenges', 'تحدياتك')} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {challenges.map((st) => <div role="listitem" key={st.challenge.id}>{view(st, true)}</div>)}
    </div>
  );
}

export { ScreenHabitChallenge };
