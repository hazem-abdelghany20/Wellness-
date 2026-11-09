import React from 'react';
import { Icon } from '../design-system.jsx';
import { mediaFromPayload, youtubeEmbedUrl } from '../../shared/habit-meta.js';

// "Watch how" block on the weekly habit card: the template's how-to video
// (uploaded or YouTube) or image. Renders nothing when there is no media.
// Never autoplays. Also used by the admin builder's live preview.
function HabitMedia({ theme, lang, payload, title = '', style = {} }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const m = mediaFromPayload(payload);
  if (!m) return null;

  const isImage = m.type === 'image';
  // Exercise media (resolveMedia) can carry a poster: show it first, load the clip on play.
  const poster = typeof payload?.poster_url === 'string' && /^https?:\/\//i.test(payload.poster_url) ? payload.poster_url : null;
  const label = isImage ? s('See how', 'شوف إزاي') : s('Watch how', 'اتفرج إزاي');
  const a11y = title ? s(`How to do it: ${title}`, `إزاي تعملها: ${title}`) : s('How to do it', 'إزاي تعملها');
  const frame = {
    position: 'relative', borderRadius: 16, overflow: 'hidden',
    background: '#000', border: `1px solid ${T.border}`,
  };

  let body = null;
  if (m.type === 'youtube') {
    body = (
      <div style={{ ...frame, height: 0, paddingTop: '56.25%' }}>
        <iframe
          src={youtubeEmbedUrl(m.youtube_id)}
          title={a11y}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      </div>
    );
  } else if (m.type === 'video') {
    body = (
      <div style={frame}>
        <video src={m.url} controls playsInline preload={poster ? 'none' : 'metadata'} aria-label={a11y}
          poster={poster || undefined}
          style={{ display: 'block', width: '100%', maxHeight: 420, background: '#000' }}/>
      </div>
    );
  } else {
    body = (
      <div style={{ ...frame, background: T.surfaceAlt }}>
        <img src={m.url} alt={a11y} loading="lazy"
          style={{ display: 'block', width: '100%', maxHeight: 420, objectFit: 'contain' }}/>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 18, ...style }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
        fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: T.textMuted,
      }}>
        <Icon name={isImage ? 'image' : 'play'} size={14}/>
        {label}
      </div>
      {body}
    </div>
  );
}

export { HabitMedia };
