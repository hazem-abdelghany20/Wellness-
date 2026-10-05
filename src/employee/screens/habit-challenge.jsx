import React from 'react';
import { typeStyles, Icon, Button, Card, SectionLabel } from '../design-system.jsx';
import { useHabitChallenge } from '../hooks/use-habit-challenge.js';
import { getContentBySlug, listSignatureChallenges } from '../../lib/supabase';
import { SignaturePathCard, IconBtn, fmtNum } from '../components/shared.jsx';
import { toPlayerItem } from '../lib/content-item.js';

// Weekly habit challenge: one small daily action, Sun → Thu, chosen by HR.
// No scores and no ranking — a "Did it" tap, five day dots, and one shared
// team bar.

const num = (n, lang) => (lang === 'ar' ? new Intl.NumberFormat('ar-EG').format(n) : String(n));

// 'YYYY-MM-DD' + n days, without local-timezone drift.
function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayLabel(iso, lang) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`));
}

function dateLabel(iso, lang) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`));
}

function ScreenHabitChallenge({ theme, dir, go, state: app }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const { state, loading, saving, error, toggle } = useHabitChallenge();
  const [articleBusy, setArticleBusy] = React.useState(false);
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
          {s('This week', 'تحدي الأسبوع')}
        </div>
        {state?.challenge && (
          <div style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }}>
            {dateLabel(state.challenge.start_date, lang)} {lang === 'ar' ? '←' : '→'} {dateLabel(state.challenge.end_date, lang)}
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

  if (loading && !state) {
    return shell(<div style={{ color: T.textMuted, fontSize: 14, padding: '40px 6px', textAlign: 'center' }}>{s('Loading…', 'جارٍ التحميل…')}</div>);
  }

  if (!state || state.status === 'none') {
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

  const c = state.challenge;
  const p = c.payload || {};
  const pick = (k) => (lang === 'ar' ? (p[`${k}_ar`] || p[`${k}_en`]) : p[`${k}_en`]) || '';
  const title = lang === 'ar' ? (c.title_ar || c.title_en) : c.title_en;
  const evening = p.check_mode === 'next_morning';

  if (state.status === 'upcoming') {
    return shell(
      <Card theme={T} pad={22} radius={22}>
        <div style={{ fontSize: 11, letterSpacing: 1, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
          {s('Starts', 'يبدأ')} {dayLabel(c.start_date, lang)} {dateLabel(c.start_date, lang)}
        </div>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 28, color: T.text, marginTop: 8, lineHeight: 1.15 }}>{title}</div>
        <div style={{ color: T.textMid || T.text, fontSize: 15, lineHeight: 1.5, marginTop: 10 }}>{pick('action')}</div>
      </Card>
    );
  }

  const days = Array.from({ length: state.days_total || 5 }, (_, i) => addDays(c.start_date, i));
  const done = new Set(state.my_dates || []);
  const target = state.target_date;
  const need = state.success_days || 4;
  const count = state.my_count || 0;
  const missedSome = days.some((d) => d < target && !done.has(d));
  const earned = count >= need;

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

  return shell(
    <>
      <Card theme={T} pad={22} radius={24}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center',
            background: (p.badge_color || T.accent) + '26', color: p.badge_color || T.accent,
          }}>
            <Icon name={p.badge_icon || 'trophy'} size={22}/>
          </div>
          <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 26, color: T.text, lineHeight: 1.1, flex: 1 }}>{title}</div>
        </div>
        <div style={{ color: T.text, fontSize: 16, lineHeight: 1.55 }}>{pick('action')}</div>

        <div style={{ marginTop: 20 }}>
          {state.can_log ? (
            state.logged_target ? (
              <Button theme={T} variant="secondary" onClick={toggle} disabled={saving} style={{ width: '100%' }}>
                {saving ? s('Saving…', 'جارٍ الحفظ…') : s('Done ✓  Tap to undo', 'تمام ✓  اضغط للتراجع')}
              </Button>
            ) : (
              <Button theme={T} variant="primary" onClick={toggle} disabled={saving} style={{ width: '100%' }}>
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
          {error && (
            <div style={{ color: T.negative || '#c0392b', fontSize: 13, marginTop: 10, textAlign: 'center' }}>
              {s('Could not save. Try again.', 'ما اتحفظش. جرّب تاني.')}
            </div>
          )}
        </div>

        {/* Five day dots */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
          {days.map((d) => {
            const isDone = done.has(d);
            const isTarget = d === target;
            const isPast = d < target;
            const bg = isDone ? T.accent : 'transparent';
            const border = isDone ? T.accent : isTarget ? T.text : T.border;
            return (
              <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
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

        <div style={{ marginTop: 16, fontSize: 14, color: earned ? T.positive || T.accent : T.textMuted, textAlign: 'center', lineHeight: 1.5 }}>
          {earned
            ? s('You made it. Your reward lands in Mine after the week ends.', 'كمّلتها 🎉 مكافأتك هتنزل في «حسابي» بعد ما الأسبوع يخلص.')
            : s(`${count} of ${need} days for the reward`, `${num(count, lang)} من ${num(need, lang)} أيام للمكافأة`)}
        </div>
        {missedSome && !earned && pick('missed') && (
          <div style={{ marginTop: 8, fontSize: 13, color: T.textMuted, textAlign: 'center', lineHeight: 1.5 }}>{pick('missed')}</div>
        )}
      </Card>

      <SectionLabel theme={T} style={{ padding: '0 6px', margin: '6px 0 0' }}>{s('Your team', 'فريقك')}</SectionLabel>
      <Card theme={T} pad={18} radius={20}>
        {state.team_pct != null ? (
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
        )}
      </Card>

      <SectionLabel theme={T} style={{ padding: '0 6px', margin: '6px 0 0' }}>{s('Why this helps', 'ليه ده مفيد')}</SectionLabel>
      <Card theme={T} pad={18} radius={20}>
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
      </Card>
    </>
  );
}

export { ScreenHabitChallenge };
