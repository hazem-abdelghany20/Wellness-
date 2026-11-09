import React from 'react';
import { Icon } from '../design-system.jsx';
import { getBroadcastAudioUrl } from '../../lib/supabase-broadcasts';
import { fmtDuration } from '../lib/push-ui.js';

// A compact player for an HR audio message (voice note / podcast) on a
// notification: play / pause, where you are, and the length. The signed
// URL is fetched on the first play, not before. One message plays at a time.

let playing = null; // the <audio> element playing now, app-wide

function AudioPlayer({ theme: T, lang, broadcastId, durationS, title }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const ref = React.useRef(null);
  const [status, setStatus] = React.useState('idle'); // idle · loading · playing · paused · error
  const [pos, setPos] = React.useState(0);
  const [dur, setDur] = React.useState(Number(durationS) > 0 ? Number(durationS) : null);
  const loaded = React.useRef(false);

  // Leaving the screen stops the sound.
  React.useEffect(() => {
    const el = ref.current;
    return () => {
      if (!el) return;
      if (!el.paused) el.pause?.();
      if (playing === el) playing = null;
    };
  }, []);

  const start = async (el) => {
    if (playing && playing !== el) playing.pause?.();
    playing = el;
    try {
      await el.play();
    } catch {
      // Blocked (e.g. the phone wants a fresh tap): show play again.
      setStatus('paused');
    }
  };

  const toggle = async () => {
    const el = ref.current;
    if (!el || status === 'loading') return;
    if (status === 'playing') { el.pause(); return; }
    if (loaded.current) { start(el); return; }
    // iPhone only lets a tap start sound: touch the element now, inside the tap.
    try { el.load(); } catch { /* jsdom / old browsers */ }
    setStatus('loading');
    let media = null;
    try { media = await getBroadcastAudioUrl(broadcastId); } catch { media = null; }
    if (!media?.url) { setStatus('error'); return; }
    if (!dur && Number(media.duration_s) > 0) setDur(Number(media.duration_s));
    el.src = media.url;
    loaded.current = true;
    start(el);
  };

  const seek = (e) => {
    const el = ref.current;
    const v = Number(e.target.value);
    setPos(v);
    if (el && loaded.current) { try { el.currentTime = v; } catch { /* not seekable yet */ } }
  };

  const max = dur || 0;
  const label = status === 'playing' ? s('Pause the audio message', 'وقّف الرسالة الصوتية') : s('Play the audio message', 'شغّل الرسالة الصوتية');
  const name = title ? `${label}: ${title}` : label;

  return (
    <div data-testid="audio-player" onClick={(e) => e.stopPropagation()} style={{
      display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '8px 10px',
      background: T.chipBg, border: `1px solid ${T.border}`, borderRadius: 14,
    }}>
      <audio ref={ref} preload="none"
        onPlay={() => setStatus('playing')}
        onPause={() => setStatus((st) => (st === 'error' ? st : 'paused'))}
        onEnded={() => { setStatus('paused'); setPos(0); if (playing === ref.current) playing = null; }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime || 0)}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setDur(d); }}
        onError={() => { if (loaded.current) setStatus('error'); }}/>
      <button type="button" onClick={toggle} aria-label={name} disabled={status === 'loading'} style={{
        width: 38, height: 38, borderRadius: 999, flexShrink: 0, cursor: status === 'loading' ? 'wait' : 'pointer',
        background: T.accent, color: T.accentInk, border: 'none', display: 'grid', placeItems: 'center',
      }}>
        <Icon name={status === 'playing' ? 'pause' : 'play'} size={16}/>
      </button>
      {status === 'error' ? (
        <div role="alert" style={{ flex: 1, fontSize: 12, color: T.textMuted }}>
          {s('This audio can’t play right now.', 'الصوت مش راضي يشتغل دلوقتي.')}
        </div>
      ) : (
        <div dir="ltr" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" min={0} max={max || 1} step="any" value={Math.min(pos, max || 1)} onChange={seek}
            disabled={!max} aria-label={s('Position', 'المكان في الرسالة')}
            aria-valuetext={`${fmtDuration(pos, lang)} / ${fmtDuration(max, lang)}`}
            style={{ flex: 1, minWidth: 0, accentColor: T.accent, margin: 0 }}/>
          <span style={{ fontSize: 12, color: T.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {status === 'loading'
              ? s('Loading…', 'جارٍ التحميل…')
              : <>{(status === 'playing' || pos > 0) && <>{fmtDuration(pos, lang)} / </>}{max ? fmtDuration(max, lang) : '–:––'}</>}
          </span>
        </div>
      )}
    </div>
  );
}

export { AudioPlayer };
