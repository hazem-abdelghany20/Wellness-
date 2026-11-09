import React from 'react';
import {
  typeStyles, Icon, Card, SectionLabel,
} from '../design-system.jsx';
import { TopBack } from './onboarding.jsx';
import { useAuth } from '../state/auth-context.jsx';
import { useNotifications } from '../hooks/use-notifications.js';
import { useBroadcastMedia } from '../hooks/use-broadcast-media.js';
import { AudioPlayer } from '../components/audio-player.jsx';

const KIND_STYLE = {
  streak:           { icon: 'flame',   tone: 'accent'   },
  challenge_update: { icon: 'trophy',  tone: 'positive' },
  insight:          { icon: 'sparkle', tone: 'info'     },
  checkin_reminder: { icon: 'bell',    tone: 'accent'   },
  system:           { icon: 'sparkle', tone: 'info'     },
};

function pickColor(theme, tone) {
  switch (tone) {
    case 'positive': return theme.positive;
    case 'info':     return theme.info;
    case 'accent':
    default:         return theme.accent;
  }
}

function pickText(n, base, lang) {
  if (!n) return '';
  return n[`${base}_${lang}`] || n[`${base}_en`] || '';
}

function relTime(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return lang === 'ar' ? 'الآن' : 'now';
  if (mins < 60) return `${mins}${lang === 'ar' ? ' د' : 'm'}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return d.toTimeString().slice(0, 5);
  const days = Math.floor(hrs / 24);
  if (days < 7) {
    const dayNames = lang === 'ar'
      ? ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayNames[d.getDay()];
  }
  return d.toISOString().slice(0, 10);
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
}

// focusBroadcastId: opened from a broadcast's push (?open=notifs&broadcast=…):
// that message is highlighted, scrolled to and marked read.
function ScreenNotifs({ theme, t, dir, go, backTo = 'challenges', focusBroadcastId = null, onFocusHandled }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const { session } = useAuth();
  const { list, loading, markRead, markAllRead } = useNotifications(session?.user?.id);
  const audio = useBroadcastMedia(list);
  const [highlight, setHighlight] = React.useState(null);
  const focusRef = React.useRef(null);

  React.useEffect(() => {
    if (!focusBroadcastId || loading) return;
    const n = list.find((x) => x.broadcast_id === focusBroadcastId);
    if (n) {
      setHighlight(n.id);
      if (!n.read) Promise.resolve(markRead(n.id)).catch(() => {});
    }
    onFocusHandled?.();
  }, [focusBroadcastId, loading, list]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (highlight) focusRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [highlight]);

  if (loading) return <NotifsLoading theme={T} dir={dir}/>;

  // Bucket by today vs this-week.
  const todays = [];
  const earlier = [];
  for (const n of list) {
    if (isToday(n.created_at)) todays.push(n); else earlier.push(n);
  }

  const sections = [
    { key: 'today',    label: lang==='ar'?'اليوم':'Today',          items: todays  },
    { key: 'earlier',  label: lang==='ar'?'هذا الأسبوع':'This week', items: earlier },
  ].filter(s => s.items.length > 0);

  return (
    <div style={{ height: '100%', background: T.bg, overflow: 'auto', paddingTop: 'var(--wp-top)', paddingBottom: 40, boxSizing: 'border-box' }}>
      <div style={{ padding: '14px 22px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <TopBack theme={T} onBack={() => go(backTo)} dir={dir}/>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 26, letterSpacing: -0.4, color: T.text, flex: 1 }}>
          {lang==='ar'?'الإشعارات':'Notifications'}
        </div>
        <button onClick={() => markAllRead()}
          style={{ background:'transparent', border:'none', color:T.accent, fontSize:13, fontWeight:600, cursor:'pointer' }}>
          {lang==='ar'?'تعليم الكل':'Mark all read'}
        </button>
      </div>

      {sections.length === 0 && (
        <div style={{ padding: '24px 16px 0' }}>
          <Card theme={T} pad={20}>
            <div style={{ fontSize: 14, color: T.textMuted, textAlign: 'center' }}>
              {lang==='ar' ? 'لا توجد إشعارات بعد.' : 'No notifications yet.'}
            </div>
          </Card>
        </div>
      )}

      {sections.map((sec) => (
        <div key={sec.key}>
          <SectionLabel theme={T} style={{ marginTop: 14 }}>{sec.label}</SectionLabel>
          <div style={{ padding: '0 16px' }}>
            <Card theme={T} pad={0} radius={20}>
              {sec.items.map((n, i) => {
                const media = n.broadcast_id ? audio[n.broadcast_id] : null;
                const style = media ? { icon: 'headphones', tone: 'accent' } : (KIND_STYLE[n.kind] || KIND_STYLE.system);
                const c = pickColor(T, style.tone);
                const unread = !n.read;
                const focused = highlight != null && highlight === n.id;
                const title = pickText(n, 'title', lang);
                const body  = pickText(n, 'body', lang);
                return (
                  <div key={n.id ?? i} ref={focused ? focusRef : undefined}
                    data-notif-id={n.id} aria-current={focused ? 'true' : undefined}
                    style={{
                      background: focused ? T.accentSoft : 'transparent',
                      borderBottom: i < sec.items.length - 1 ? `1px solid ${T.border}` : 'none',
                      borderRadius: focused ? 16 : 0, transition: 'background .3s',
                    }}>
                    <button onClick={() => unread && markRead(n.id)}
                      style={{
                        width: '100%', textAlign: 'start', fontFamily: 'inherit',
                        background: 'transparent', border: 'none', padding: 0,
                        cursor: unread ? 'pointer' : 'default',
                      }}>
                      <div style={{
                        display: 'flex', gap: 12, padding: media ? '14px 16px 4px' : '14px 16px', alignItems: 'flex-start',
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: c + '22', color: c,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}><Icon name={style.icon} size={18}/></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, color: T.text, lineHeight: 1.4, fontWeight: unread ? 600 : 500 }}>
                            {title}
                          </div>
                          {body ? (
                            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, lineHeight: 1.4 }}>
                              {body}
                            </div>
                          ) : null}
                          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{relTime(n.created_at, lang)}</div>
                        </div>
                        {unread && <div style={{ width: 8, height: 8, borderRadius: 999, background: T.accent, marginTop: 6 }}/>}
                      </div>
                    </button>
                    {media && (
                      <div style={{ padding: '0 16px 14px', paddingInlineStart: 64 }}>
                        <AudioPlayer theme={T} lang={lang} broadcastId={n.broadcast_id}
                          durationS={media.media_duration_s} title={title}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotifsLoading({ theme, dir }) {
  const T = theme;
  const text = dir === 'rtl' ? 'جارٍ التحميل…' : 'Loading…';
  return (
    <div style={{
      height: '100%', background: T.bg, paddingTop: 'var(--wp-top)', paddingBottom: 40,
      boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color: T.textMuted, fontSize: 14, letterSpacing: 0.5 }}>{text}</div>
    </div>
  );
}

export { ScreenNotifs };
