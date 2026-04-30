import React from 'react';

function HRPageHeader({ theme, eyebrow, title, sub, right }) {
  const T = theme;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }}>
      <div>
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>{eyebrow}</div>
        <h1 className="display" style={{ margin: 0, fontSize: 38, color: T.text, letterSpacing: -0.8, fontWeight: 400, lineHeight: 1 }}>{title}</h1>
        {sub && <div style={{ fontSize: 14, color: T.textMuted, marginTop: 8 }}>{sub}</div>}
      </div>
      {right && <div style={{ display: 'flex', gap: 10 }}>{right}</div>}
    </div>
  );
}

export { HRPageHeader };
