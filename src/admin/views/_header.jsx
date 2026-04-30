import React from 'react';

function AdminPageHeader({ theme, eyebrow, title, sub, right }) {
  const T = theme;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
      <div>
        <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>{eyebrow}</div>
        <h1 className="display" style={{ margin: 0, fontSize: 38, color: T.text, letterSpacing: -1, fontWeight: 400 }}>
          {title}<span style={{ color: T.accent, marginInlineStart: 8 }}>.</span>
        </h1>
        {sub && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>{sub}</div>}
      </div>
      {right && <div style={{ display: 'flex', gap: 8 }}>{right}</div>}
    </div>
  );
}

export { AdminPageHeader };
