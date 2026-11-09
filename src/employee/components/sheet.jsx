import React from 'react';
import { typeStyles, Icon } from '../design-system.jsx';

// Bottom sheet inside the phone frame (same look as the avatar picker on Me).
// Esc, the close button or a tap on the dim area closes it.
function Sheet({ theme, lang, title, onClose, children, footer, labelId }) {
  const T = theme;
  const id = labelId || 'wp-sheet-title';
  const ref = React.useRef(null);
  React.useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, background: T.overlay, zIndex: 50,
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', boxSizing: 'border-box', background: T.sheet,
          borderTopLeftRadius: 28, borderTopRightRadius: 28, border: `1px solid ${T.border}`,
          maxHeight: 'calc(100% - var(--wp-top) - 12px)', display: 'flex', flexDirection: 'column',
          paddingBottom: 'calc(var(--wp-tabpad) + 8px)', outline: 'none',
          animation: 'sheetUp .25s ease both',
        }}>
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 14px' }}/>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div id={id} style={{ fontFamily: typeStyles(T).displayFont, fontSize: 26, color: T.text, letterSpacing: -0.3, lineHeight: 1.15, minWidth: 0 }}>
              {title}
            </div>
            <button onClick={onClose} aria-label={lang === 'ar' ? 'إغلاق' : 'Close'} style={{
              width: 36, height: 36, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
              background: T.chipBg, border: `1px solid ${T.border}`, color: T.text,
              display: 'grid', placeItems: 'center',
            }}><Icon name="close" size={16}/></button>
          </div>
        </div>
        <div style={{ overflow: 'auto', padding: '14px 20px 6px', flex: 1, minHeight: 0 }}>{children}</div>
        {footer && <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>{footer}</div>}
      </div>
      <style>{`@keyframes sheetUp{0%{transform:translateY(24px);opacity:0}100%{transform:none;opacity:1}}
        @media (prefers-reduced-motion: reduce){[role=dialog]{animation:none!important}}`}</style>
    </div>
  );
}

export { Sheet };
