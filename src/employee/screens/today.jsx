import React from 'react';
import { typeStyles, Icon, Button, Card, SectionLabel, Ring } from '../design-system.jsx';
import { IconBtn, fmtNum } from '../components/shared.jsx';
import { HabitMedia } from '../components/habit-media.jsx';
import { Sheet } from '../components/sheet.jsx';
import { TopTodayStrip } from '../components/recognition-board.jsx';
import { Confetti } from '../confetti.jsx';
import { ReminderPrompt } from '../components/reminders.jsx';
import { useRoutineWeek } from '../hooks/use-routine-week.js';
import { resolveMedia, getMediaUrl, itemText } from '../../lib/supabase-routines';
import {
  withClock, companyClock, fmtTime, fmtDateLong, todayFocus, bodyAreasText, hasMedia,
  sourceFileOf, pick, dayTitleText, weekdayShort,
} from '../lib/routine-today.js';

// Today tab (sprint 2 item 5): the routine HR set, as a timed checklist.
// One glance: the next item is highlighted. One tap: the circle ticks it.
// Past items say "Not yet", never red or "missed". Only today's items.

const CLOCK_MS = 30 * 1000;

// Company-local "now", moving on while the app is open. Starts from the
// server's time; asks for a refresh when the company's day changes.
function useCompanyNow(state, onNewDay) {
  const [now, setNow] = React.useState(null);
  const tz = state?.timezone;
  const date = state?.date;
  const newDay = React.useRef(onNewDay);
  newDay.current = onNewDay;
  React.useEffect(() => {
    setNow(null);
    if (!tz || !date) return undefined;
    const id = setInterval(() => {
      const c = companyClock(tz);
      if (!c) return;
      if (c.date > date) newDay.current?.();
      else setNow(c.time);
    }, CLOCK_MS);
    return () => clearInterval(id);
  }, [tz, date]);
  return now;
}

function useSignedUrl(ref) {
  const [url, setUrl] = React.useState(null);
  const key = ref ? `${ref.bucket}/${ref.path}` : '';
  React.useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!ref) return undefined;
    getMediaUrl({ bucket: ref.bucket, path: ref.path })
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
}

function TimeLabel({ theme: T, time, lang, style }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {time ? <bdi dir="ltr">{fmtTime(time, lang)}</bdi> : s('Any time', 'أي وقت')}
    </span>
  );
}

// Tick circle. role=checkbox so screen readers say "ticked / not ticked".
function TickButton({ theme: T, checked, label, onToggle, size = 40, busy }) {
  return (
    <button type="button" role="checkbox" aria-checked={!!checked} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onToggle(!checked); }}
      style={{
        width: size + 8, height: size + 8, margin: -4, padding: 4, flexShrink: 0, cursor: 'pointer',
        background: 'transparent', border: 'none', display: 'grid', placeItems: 'center',
      }}>
      <span aria-hidden="true" style={{
        width: size, height: size, borderRadius: 999, display: 'grid', placeItems: 'center',
        background: checked ? T.accent : 'transparent',
        border: `2px solid ${checked ? T.accent : T.borderStrong}`,
        color: checked ? T.accentInk : T.textFaint, transition: 'background .15s, border-color .15s, transform .15s',
        transform: busy ? 'scale(.94)' : 'none',
      }}>
        {checked ? <Icon name="check" size={Math.round(size * 0.48)}/> : null}
      </span>
    </button>
  );
}

function ItemMeta({ theme: T, item, lang }) {
  const { setsReps } = itemText(item, lang);
  const areas = bodyAreasText(item.exercise, lang);
  const bits = [setsReps, areas].filter(Boolean);
  if (!bits.length) return null;
  return (
    <div style={{ fontSize: 13, color: T.textMuted, marginTop: 3, lineHeight: 1.4 }}>
      {bits.map((b, i) => (
        <React.Fragment key={i}>{i > 0 && ' · '}<bdi>{b}</bdi></React.Fragment>
      ))}
    </div>
  );
}

function ItemRow({ theme: T, lang, item, isNext, onOpen, onToggle }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const { title } = itemText(item, lang);
  const media = hasMedia(item.exercise);
  return (
    <div role="listitem" data-item-id={item.id} data-next={isNext ? 'true' : undefined} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 16,
      background: isNext ? T.accentSoft : T.surface,
      border: `1px solid ${isNext ? T.accent : T.border}`,
    }}>
      <button type="button" onClick={() => onOpen(item.id)} style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: 0,
        background: 'transparent', border: 'none', color: T.text, cursor: 'pointer',
        textAlign: 'start', fontFamily: 'inherit',
      }}>
        <TimeLabel theme={T} time={item.at_time} lang={lang} style={{
          width: 50, flexShrink: 0, fontSize: item.at_time ? 14 : 11, fontWeight: 700,
          color: isNext ? T.accent : T.textMuted, lineHeight: 1.2,
        }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, lineHeight: 1.3,
            color: item.checked ? T.textMuted : T.text,
          }}><bdi>{title}</bdi></div>
          <ItemMeta theme={T} item={item} lang={lang}/>
          {item.is_past && !item.checked && !isNext && (
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>{s('Not yet', 'لسه')}</div>
          )}
        </div>
        {media && (
          <span aria-hidden="true" style={{
            width: 30, height: 30, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center',
            background: T.chipBg, color: T.text, border: `1px solid ${T.border}`,
          }}><Icon name="play" size={12}/></span>
        )}
      </button>
      <TickButton theme={T} checked={item.checked} label={title} onToggle={(v) => onToggle(item.id, v)}/>
    </div>
  );
}

function NextCard({ theme: T, lang, item, onOpen, onToggle }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const { title } = itemText(item, lang);
  const media = hasMedia(item.exercise);
  return (
    <section aria-label={s('Next up', 'اللي عليه الدور')} style={{
      background: T.surface, border: `2px solid ${T.accent}`, borderRadius: 24, padding: 18,
      boxShadow: `0 10px 30px ${T.accent}22`,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.accent }}>
        {s('Next', 'اللي عليه الدور')} · <TimeLabel theme={T} time={item.at_time} lang={lang}/>
      </div>
      <button type="button" onClick={() => onOpen(item.id)} style={{
        display: 'block', width: '100%', padding: 0, marginTop: 6, background: 'transparent', border: 'none',
        textAlign: 'start', cursor: 'pointer', fontFamily: 'inherit', color: T.text,
      }}>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 28, lineHeight: 1.12, letterSpacing: -0.3 }}><bdi>{title}</bdi></div>
        <ItemMeta theme={T} item={item} lang={lang}/>
      </button>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {media && (
          <Button theme={T} variant="soft" size="md" icon="play" onClick={() => onOpen(item.id)} style={{ flex: 1 }}>
            {s('Watch how', 'اتفرج إزاي')}
          </Button>
        )}
        <Button theme={T} variant="primary" size="md" icon="check" onClick={() => onToggle(item.id, true)} style={{ flex: media ? 1 : undefined, width: media ? undefined : '100%' }}>
          {s('Done', 'خلّصتها')}
        </Button>
      </div>
    </section>
  );
}

function ProgressCard({ theme: T, lang, progress, streak }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const n = (x) => fmtNum(x, lang);
  const { done = 0, total = 0, points = 0, all_done: allDone } = progress || {};
  return (
    <Card theme={T} pad={16} radius={22} style={{
      display: 'flex', alignItems: 'center', gap: 16,
      background: allDone ? T.accentSoft : T.surface, border: `1px solid ${allDone ? T.accent : T.border}`,
    }}>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}
        aria-label={s(`${done} of ${total} done`, `${n(done)} من ${n(total)} خلصوا`)}>
        <Ring theme={T} value={total ? done / total : 0} size={76} stroke={8}>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.text, textAlign: 'center' }}>
            {allDone ? <Icon name="check" size={24} style={{ color: T.accent }}/> : <bdi dir="ltr">{n(done)}/{n(total)}</bdi>}
          </div>
        </Ring>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, lineHeight: 1.25 }}>
          {allDone ? s('All done for today!', 'خلّصت كل حاجة النهارده!') : s(`${done} of ${total} done`, `${n(done)} من ${n(total)} خلصوا`)}
        </div>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>
          <bdi dir="ltr">+{n(points)}</bdi> {s('points today', 'نقطة النهارده')}
        </div>
        {streak > 0 && (
          <div style={{ fontSize: 13, color: T.text, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="flame" size={15} style={{ color: T.accent }}/>
            {s(`${streak}-day streak`, `${n(streak)} يوم ورا بعض`)}
          </div>
        )}
      </div>
    </Card>
  );
}

// readOnly (week view, another day): watch and read only — no Done, no Mute.
// dayLabel names that day in the pills.
function ExerciseSheet({ theme: T, lang, item, onClose, onToggle, onMute, readOnly = false, dayLabel }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const { title, setsReps } = itemText(item, lang);
  const ex = item.exercise;
  const media = hasMedia(ex);
  const [payload, setPayload] = React.useState(null);
  const [mediaState, setMediaState] = React.useState(media ? 'loading' : 'none');
  React.useEffect(() => {
    let alive = true;
    if (!media) { setMediaState('none'); return undefined; }
    setMediaState('loading');
    resolveMedia(ex)
      .then((p) => { if (!alive) return; setPayload(p); setMediaState(p ? 'ready' : 'error'); })
      .catch(() => { if (alive) setMediaState('error'); });
    return () => { alive = false; };
  }, [ex?.id, ex?.media_path, ex?.media_youtube_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const how = pick(ex, 'how', lang);
  const helps = pick(ex, 'helps', lang);
  const note = pick(item, 'note', lang);
  const areas = bodyAreasText(ex, lang);
  const label = (t) => (
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.textMuted, marginBottom: 4 }}>{t}</div>
  );

  return (
    <Sheet theme={T} lang={lang} title={<bdi>{title}</bdi>} onClose={onClose} labelId="wp-exercise-title"
      footer={readOnly ? null : (
        <>
          {item.checked ? (
            <Button theme={T} variant="secondary" onClick={() => onToggle(item.id, false)} style={{ width: '100%' }}>
              {s('Done ✓  Tap to undo', 'تمام ✓  اضغط للتراجع')}
            </Button>
          ) : (
            <Button theme={T} variant="primary" icon="check" onClick={() => { onToggle(item.id, true); onClose(); }} style={{ width: '100%' }}>
              {s('Done', 'خلّصتها')}
            </Button>
          )}
        </>
      )}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {dayLabel && <span style={pill(T)}>{dayLabel}</span>}
        <span style={pill(T)}><Icon name="calendar" size={13}/><TimeLabel theme={T} time={item.at_time} lang={lang}/></span>
        {setsReps && <span style={pill(T)}><bdi>{setsReps}</bdi></span>}
        {areas && <span style={pill(T)}>{areas}</span>}
      </div>

      {mediaState === 'loading' && (
        <div style={{ marginTop: 16, height: 180, borderRadius: 16, background: T.surfaceAlt, display: 'grid', placeItems: 'center', color: T.textMuted, fontSize: 13 }}>
          {s('Loading the video…', 'جارٍ تحميل الفيديو…')}
        </div>
      )}
      {mediaState === 'ready' && <HabitMedia theme={T} lang={lang} payload={payload} title={title} style={{ marginTop: 16 }}/>}
      {mediaState === 'error' && (
        <div style={{ marginTop: 16, fontSize: 13, color: T.textMuted }}>{s('The video can’t load right now.', 'الفيديو مش راضي يحمّل دلوقتي.')}</div>
      )}

      {how && <div style={{ marginTop: 18 }}>{label(s('How to do it', 'إزاي تعملها'))}<div style={{ fontSize: 15, color: T.text, lineHeight: 1.55 }}>{how}</div></div>}
      {helps && <div style={{ marginTop: 14 }}>{label(s('What it helps', 'بتفيد في إيه'))}<div style={{ fontSize: 15, color: T.text, lineHeight: 1.55 }}>{helps}</div></div>}
      {note && <div style={{ marginTop: 14 }}>{label(s('Note', 'ملاحظة'))}<div style={{ fontSize: 15, color: T.text, lineHeight: 1.55 }}>{note}</div></div>}

      {!readOnly && <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onMute(item.id, !item.muted)} aria-pressed={!!item.muted} style={{
          background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 999, padding: '7px 12px',
          color: T.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="bell" size={14}/>
          {item.muted ? s('Muted · Unmute', 'مكتوم · رجّعه') : s('Mute this one', 'اكتم ده')}
        </button>
        <span style={{ fontSize: 12, color: T.textMuted }}>
          {item.muted
            ? s('No reminder for this one. The others still come.', 'مش هيجيلك تذكير للتمرين ده. الباقيين هيوصلوا عادي.')
            : s('Stops this one’s reminder. The others still come.', 'بيوقف تذكير التمرين ده بس. الباقيين هيوصلوا عادي.')}
        </span>
      </div>}
    </Sheet>
  );
}

const pill = (T) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999,
  background: T.chipBg, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 600,
});

// todayItems / onToggle / onMute: today's live list, so an item opened from
// today's column keeps its Done and Mute. Other days open read-only.
function WeekSheet({ theme: T, lang, onClose, sourceUrl, sourceKind, todayItems, onToggle, onMute }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const n = (x) => fmtNum(x, lang);
  const { week, loading, error, refetch } = useRoutineWeek(true);
  const [picked, setPicked] = React.useState(null);
  const [viewing, setViewing] = React.useState(null); // { id, date }
  const days = week?.days || [];
  const day = days.find((d) => d.date === picked) || days.find((d) => d.is_today) || days[0];

  if (viewing) {
    const vDay = days.find((d) => d.date === viewing.date);
    const weekItem = vDay?.items.find((i) => i.id === viewing.id);
    const live = vDay?.is_today ? (todayItems || []).find((i) => i.id === viewing.id) : null;
    if (weekItem || live) {
      const back = () => setViewing(null);
      if (live) {
        return <ExerciseSheet theme={T} lang={lang} item={{ ...weekItem, ...live, exercise: live.exercise || weekItem?.exercise || null }}
          onClose={back} onToggle={onToggle} onMute={onMute}/>;
      }
      return <ExerciseSheet theme={T} lang={lang} item={weekItem} onClose={back} readOnly
        dayLabel={fmtDateLong(vDay.date, lang)}/>;
    }
  }

  let body;
  if (loading && !week) {
    body = <div style={{ color: T.textMuted, fontSize: 14, padding: '20px 0', textAlign: 'center' }}>{s('Loading…', 'جارٍ التحميل…')}</div>;
  } else if (error && !week) {
    body = (
      <div style={{ padding: '10px 0' }}>
        <div style={{ color: T.text, fontSize: 15, marginBottom: 12 }}>{s('Could not load your week.', 'مقدرناش نحمّل الأسبوع.')}</div>
        <Button theme={T} variant="soft" size="md" onClick={refetch}>{s('Try again', 'جرّب تاني')}</Button>
      </div>
    );
  } else {
    const focus = dayTitleText(day?.day_title, lang);
    body = (
      <>
        {(week?.routines || []).map((r) => {
          const note = pick(r, 'note', lang);
          return (
            <div key={r.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 15, color: T.text, fontWeight: 700 }}><bdi>{pick(r, 'title', lang)}</bdi></div>
              {note && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2, lineHeight: 1.5 }}>{note}</div>}
            </div>
          );
        })}
        <div role="group" aria-label={s('Days', 'الأيام')} style={{ display: 'flex', gap: 6, margin: '4px 0 14px' }}>
          {days.map((d) => {
            const sel = day && d.date === day.date;
            return (
              <button key={d.date} type="button" aria-pressed={!!sel} onClick={() => setPicked(d.date)}
                aria-label={s(`${weekdayShort(d.weekday, 'en')}: ${d.done} of ${d.due} done`, `${weekdayShort(d.weekday, 'ar')}: ${n(d.done)} من ${n(d.due)}`)}
                style={{
                  flex: 1, minWidth: 0, padding: '10px 2px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                  background: sel ? T.accent : T.chipBg, color: sel ? T.accentInk : T.text,
                  border: `1px solid ${d.is_today && !sel ? T.accent : sel ? 'transparent' : T.border}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{weekdayShort(d.weekday, lang)}</span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>
                  {d.all_done ? <Icon name="check" size={14}/> : d.due ? <bdi dir="ltr">{n(d.done)}/{n(d.due)}</bdi> : '–'}
                </span>
              </button>
            );
          })}
        </div>
        {day && (
          <div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 8 }}>
              {fmtDateLong(day.date, lang)}
              {focus && <> · <span style={{ color: T.text, fontWeight: 600 }}>{s('Focus: ', 'التركيز: ')}{focus}</span></>}
            </div>
            {day.items.length === 0 ? (
              <div style={{ fontSize: 14, color: T.textMuted, padding: '8px 0' }}>{s('Nothing on this day.', 'مفيش حاجة اليوم ده.')}</div>
            ) : (
              <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {day.items.map((it) => {
                  const { title, setsReps } = itemText(it, lang);
                  const media = hasMedia(it.exercise);
                  return (
                    <div role="listitem" key={it.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <button type="button" onClick={() => setViewing({ id: it.id, date: day.date })} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px',
                        background: 'transparent', border: 'none', color: T.text, cursor: 'pointer',
                        textAlign: 'start', fontFamily: 'inherit',
                      }}>
                        <TimeLabel theme={T} time={it.at_time} lang={lang} style={{ width: 48, flexShrink: 0, fontSize: 13, fontWeight: 700, color: T.textMuted }}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}><bdi>{title}</bdi></div>
                          {setsReps && <div style={{ fontSize: 12, color: T.textMuted }}><bdi>{setsReps}</bdi></div>}
                        </div>
                        {media && (
                          <span aria-hidden="true" style={{
                            width: 26, height: 26, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center',
                            background: T.chipBg, color: T.text, border: `1px solid ${T.border}`,
                          }}><Icon name="play" size={10}/></span>
                        )}
                        {it.checked
                          ? <Icon name="check" size={18} style={{ color: T.accent }}/>
                          : !day.is_future && <span style={{ fontSize: 12, color: T.textMuted }}>{s('Not yet', 'لسه')}</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {week?.totals && (
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 14 }}>
            {s(`This week: ${week.totals.done} of ${week.totals.due} done · ${week.totals.all_done_days} full ${week.totals.all_done_days === 1 ? 'day' : 'days'}`,
               `الأسبوع ده: ${n(week.totals.done)} من ${n(week.totals.due)} · ${n(week.totals.all_done_days)} يوم كامل`)}
          </div>
        )}
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener" style={{ ...linkBtn(T), marginTop: 16 }}>
            <Icon name={sourceKind === 'pdf' ? 'file' : 'image'} size={16}/>
            {s('Original table', 'الجدول الأصلي')} <span aria-hidden="true">↗</span>
          </a>
        )}
      </>
    );
  }

  return <Sheet theme={T} lang={lang} title={s('This week', 'الأسبوع ده')} onClose={onClose} labelId="wp-week-title">{body}</Sheet>;
}

const linkBtn = (T) => ({
  display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px', borderRadius: 14,
  border: `1px solid ${T.borderStrong}`, color: T.text, fontSize: 15, fontWeight: 600, textDecoration: 'none',
  boxSizing: 'border-box',
});

// openItemId: opened from a reminder (?open=today&item=…): that item's
// sheet opens once today's list is here; onOpenHandled clears it.
function ScreenToday({ theme, dir, go, state: app, routine, openItemId = null, onOpenHandled }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const unread = app?.unreadCount || 0;
  const { state: raw, loading, error, saveError, toggle, mute, refetch } = routine || {};

  const now = useCompanyNow(raw, () => refetch?.({ silent: true }));
  const today = React.useMemo(() => withClock(raw, now), [raw, now]);
  const [openId, setOpenId] = React.useState(null);
  const [weekOpen, setWeekOpen] = React.useState(false);

  React.useEffect(() => {
    if (!openItemId || !today) return;
    if ((today.items || []).some((i) => i.id === openItemId)) { setWeekOpen(false); setOpenId(openItemId); }
    onOpenHandled?.();
  }, [openItemId, today]); // eslint-disable-line react-hooks/exhaustive-deps

  // Confetti once, when the last item gets ticked (not on load).
  const allDone = !!today?.progress?.all_done;
  const loaded = !!today;
  const prevAllDone = React.useRef(null); // null until the first list arrives
  const [burst, setBurst] = React.useState(0);
  React.useEffect(() => {
    if (!loaded) return;
    if (prevAllDone.current === false && allDone) setBurst((b) => b + 1);
    prevAllDone.current = allDone;
  }, [allDone, loaded]);

  const source = sourceFileOf(today?.routines);
  const sourceUrl = useSignedUrl(source);

  const onToggle = (id, checked) => { toggle?.(id, checked); };
  const openItem = today?.items?.find((i) => i.id === openId) || null;
  const next = !allDone && today?.next_item_id ? today.items.find((i) => i.id === today.next_item_id) : null;
  const focus = todayFocus(today, lang);
  const routineNote = (today?.routines || []).map((r) => pick(r, 'note', lang)).find(Boolean);

  const header = (
    <div style={{ padding: '16px 22px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        {today?.date && <div style={{ color: T.textMuted, fontSize: 13 }}>{fmtDateLong(today.date, lang)}</div>}
        <h1 style={{ fontFamily: typeStyles(T).displayFont, fontSize: 32, letterSpacing: -0.5, color: T.text, margin: '2px 0 0', fontWeight: 400, lineHeight: 1.1 }}>
          {s('Today', 'النهارده')}
        </h1>
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
  );

  const weekButtons = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <Button theme={T} variant="secondary" size="md" icon="calendar" onClick={() => setWeekOpen(true)}>
        {s('This week', 'الأسبوع ده')}
      </Button>
      {sourceUrl && (
        <a href={sourceUrl} target="_blank" rel="noopener" style={linkBtn(T)}>
          <Icon name={source?.kind === 'pdf' ? 'file' : 'image'} size={16}/>
          {s('Original table', 'الجدول الأصلي')} <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  );

  const shell = (children) => (
    <div dir={dir} data-testid="screen-today" style={{ position: 'absolute', inset: 0, background: T.bg }}>
      <div style={{ height: '100%', overflow: 'auto', paddingTop: 'var(--wp-top)', paddingBottom: 'var(--wp-tabpad)', boxSizing: 'border-box' }}>
        {header}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      </div>
      <Confetti theme={T} run={burst}/>
      {openItem && (
        <ExerciseSheet theme={T} lang={lang} item={openItem} onClose={() => setOpenId(null)}
          onToggle={onToggle} onMute={(id, m) => mute?.(id, m)}/>
      )}
      {weekOpen && (
        <WeekSheet theme={T} lang={lang} onClose={() => setWeekOpen(false)} sourceUrl={sourceUrl} sourceKind={source?.kind}
          todayItems={today?.items} onToggle={onToggle} onMute={(id, m) => mute?.(id, m)}/>
      )}
    </div>
  );

  if (!today && (loading || !error)) {
    return shell(<div style={{ color: T.textMuted, fontSize: 14, padding: '40px 6px', textAlign: 'center' }}>{s('Loading…', 'جارٍ التحميل…')}</div>);
  }

  if (!today) {
    return shell(
      <Card theme={T} pad={22} radius={22}>
        <div style={{ fontSize: 17, color: T.text, fontWeight: 600, marginBottom: 12 }}>{s('Could not load today’s list.', 'مقدرناش نحمّل قايمة النهارده.')}</div>
        <Button theme={T} variant="soft" size="md" onClick={() => refetch?.()}>{s('Try again', 'جرّب تاني')}</Button>
      </Card>
    );
  }

  const emptyCard = (title, body) => (
    <Card theme={T} pad={22} radius={22}>
      <div style={{ width: 48, height: 48, borderRadius: 16, background: T.accentSoft, color: T.accent, display: 'grid', placeItems: 'center', marginBottom: 14 }}>
        <Icon name="sun" size={24}/>
      </div>
      <div style={{ fontSize: 19, color: T.text, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ color: T.textMuted, fontSize: 14, lineHeight: 1.55, marginBottom: 18 }}>{body}</div>
      {today.assigned && weekButtons}
    </Card>
  );

  if (!today.assigned) {
    return shell(emptyCard(
      s('No routine yet', 'مفيش روتين لسه'),
      s('When your HR team sets a daily routine, it shows up here. Meanwhile, try this week’s challenge.',
        'لما فريق الـ HR يحط روتين يومي، هيظهر هنا. لحد ما ده يحصل، جرّب تحدي الأسبوع.'),
    ));
  }

  if (!today.is_workday) {
    return shell(emptyCard(
      s('Nothing today. Enjoy your day off', 'مفيش حاجة النهارده. استمتع بإجازتك'),
      s('Your routine is for workdays, Sunday to Thursday. It’s back on Sunday.', 'الروتين بتاعك لأيام الشغل من الأحد للخميس. راجع يوم الأحد.'),
    ));
  }

  if (!today.items?.length) {
    return shell(emptyCard(
      s('Nothing on your list today', 'مفيش حاجة في قايمتك النهارده'),
      s('Your routine has nothing for today. Take a short walk if you can.', 'الروتين مفيهوش حاجة النهارده. لو تقدر، اتمشى شوية.'),
    ));
  }

  return shell(
    <>
      {(focus || routineNote) && (
        <div style={{ marginTop: -4 }}>
          {focus && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: T.accentSoft, color: T.text, fontSize: 14 }}>
              <Icon name="target" size={15} style={{ color: T.accent }}/>
              <span>{s('Today’s focus: ', 'تركيز النهارده: ')}<strong>{focus}</strong></span>
            </div>
          )}
          {routineNote && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 8, padding: '0 4px', lineHeight: 1.5 }}>{routineNote}</div>}
        </div>
      )}

      <ProgressCard theme={T} lang={lang} progress={today.progress} streak={today.streak}/>

      {next && <NextCard theme={T} lang={lang} item={next} onOpen={setOpenId} onToggle={onToggle}/>}

      <ReminderPrompt theme={T} lang={lang} remindersOn={!!today.reminders?.enabled}/>

      {saveError && (
        <div role="alert" style={{ fontSize: 13, color: T.negative, textAlign: 'center' }}>
          {s('Could not save that. Check your connection and tap again.', 'ما اتحفظش. اتأكد من النت واضغط تاني.')}
        </div>
      )}

      <TopTodayStrip theme={T} lang={lang} onSeeBoard={() => go('score')}/>

      <div>
        <SectionLabel theme={T} style={{ padding: '0 6px', margin: '4px 0 10px' }}
          right={<bdi dir="ltr">{fmtNum(today.progress.done, lang)}/{fmtNum(today.progress.total, lang)}</bdi>}>
          {s('Today’s list', 'قايمة النهارده')}
        </SectionLabel>
        <div role="list" aria-label={s('Today’s list', 'قايمة النهارده')} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {today.items.map((it) => (
            <ItemRow key={it.id} theme={T} lang={lang} item={it} isNext={next?.id === it.id}
              onOpen={setOpenId} onToggle={onToggle}/>
          ))}
        </div>
      </div>

      {weekButtons}
    </>
  );
}

export { ScreenToday };
