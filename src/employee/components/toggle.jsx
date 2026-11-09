import React from 'react';

// An on/off switch row: label, one plain sentence, and the switch.
// disabled + badge → a "coming soon" row that can't be flipped.
function ToggleRow({ theme, label, hint, checked, onChange, disabled = false, busy = false, badge, id }) {
  const T = theme;
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const off = disabled || busy;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 10px', opacity: disabled ? 0.6 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div id={labelId} style={{ fontSize: 15, color: T.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {label}
          {badge && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.textMuted,
              border: `1px solid ${T.border}`, borderRadius: 999, padding: '2px 8px' }}>{badge}</span>
          )}
        </div>
        {hint && <div id={hintId} style={{ fontSize: 13, color: T.textMuted, marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={!!checked} aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined} disabled={off}
        onClick={off ? undefined : () => onChange?.(!checked)}
        style={{
          width: 52, height: 32, borderRadius: 999, flexShrink: 0, marginTop: 2, position: 'relative',
          background: checked ? T.accent : T.track, border: `1px solid ${checked ? 'transparent' : T.borderStrong}`,
          cursor: off ? 'default' : 'pointer', transition: 'background .2s', padding: 0,
        }}>
        <span aria-hidden="true" style={{
          position: 'absolute', top: 3, insetInlineStart: checked ? 23 : 3, width: 24, height: 24, borderRadius: 999,
          background: checked ? T.accentInk : T.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'inset-inline-start .2s',
        }}/>
      </button>
    </div>
  );
}

export { ToggleRow };
