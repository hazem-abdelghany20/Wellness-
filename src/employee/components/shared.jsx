import React from 'react';
import { Icon } from '../design-system.jsx';

// Small pieces shared by the Challenges, Library and Me screens.

// Arabic-Indic digits in AR so numbers match the surrounding text.
export const fmtNum = (n, lang) => (lang === 'ar' ? new Intl.NumberFormat('ar-EG', { useGrouping: false }).format(n) : String(n));

function kindLabel(kind, lang) {
  const map = {
    audio:   { en: 'AUDIO',   ar: 'صوت' },
    video:   { en: 'VIDEO',   ar: 'فيديو' },
    article: { en: 'ARTICLE', ar: 'مقال' },
  };
  const m = map[kind] || { en: (kind || '').toUpperCase(), ar: (kind || '') };
  return m[lang] || m.en;
}

function SignaturePathCard({ theme, lang, sig, onOpen }) {
  const T = theme;
  const title = (lang === 'ar' && sig.title_ar) ? sig.title_ar : sig.title_en;
  const desc = (lang === 'ar' && sig.description_ar) ? sig.description_ar : sig.description_en;
  const accent = sig.badge_color || T.accent;
  const days = sig.duration_days;
  const subtle = sig.theme === 'sabr' ? (lang === 'ar' ? 'صبر' : 'Sabr')
    : sig.theme === 'niyyah' ? (lang === 'ar' ? 'نيّة' : 'Niyyah')
    : (lang === 'ar' ? 'مسار' : 'Path');
  return (
    <button onClick={onOpen} type="button" style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18,
      padding: 14, color: T.text, fontFamily: 'inherit', cursor: 'pointer',
      textAlign: 'start', width: '100%',
      borderInlineStart: `4px solid ${accent}`,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: accent + '22', color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={sig.theme === 'sabr' ? 'leaf' : sig.theme === 'niyyah' ? 'target' : 'trophy'} size={22}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 2 }}>
          {subtle}{days ? ` · ${lang === 'ar' ? new Intl.NumberFormat('ar-EG').format(days) : days} ${lang === 'ar' ? 'يوماً' : 'days'}` : ''}
        </div>
        <div style={{ fontSize: 15, color: T.text, fontWeight: 600, lineHeight: 1.2 }}>{title}</div>
        {desc && (
          <div style={{
            fontSize: 12, color: T.textMuted, marginTop: 4, lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{desc}</div>
        )}
      </div>
      <Icon name={lang === 'ar' ? 'chevL' : 'chev'} size={16} style={{ color: T.textMuted, flexShrink: 0 }}/>
    </button>
  );
}

function IconBtn({ theme, icon, onClick, 'aria-label': ariaLabel, title }) {
  // No onClick = v1 placeholder → auto-disable + Coming soon tooltip
  // (same pattern as the shared HR HRButton + employee Button).
  const isStub = !onClick;
  return (
    <button onClick={isStub ? undefined : onClick} aria-label={ariaLabel} disabled={isStub}
      title={title || (isStub ? 'Coming soon' : undefined)}
      style={{
        width: 40, height: 40, borderRadius: 999,
        background: theme.chipBg, border: `1px solid ${theme.border}`,
        color: theme.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: isStub ? 'default' : 'pointer',
        opacity: isStub ? 0.45 : 1,
      }}><Icon name={icon} size={18}/></button>
  );
}

export { kindLabel, SignaturePathCard, IconBtn };
