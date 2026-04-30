import React from 'react';
import { HRIcon } from '../shared/components.jsx';

function TweaksPanel({ theme, open, onClose, cfg, setCfg, S }) {
  const T = theme;
  if (!open) return null;
  const Row = ({ label, children }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
  const Seg = ({ opts, value, onChange }) => (
    <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 10, border: `1px solid ${T.border}` }}>
      {opts.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          flex: 1, padding: '7px 10px', borderRadius: 7,
          background: value === k ? T.panel : 'transparent',
          color: value === k ? T.text : T.textMuted,
          border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          boxShadow: value === k ? T.shadowSm : 'none',
          whiteSpace: 'nowrap',
        }}>{l}</button>
      ))}
    </div>
  );
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, width: 300, zIndex: 200, direction: 'ltr',
      background: T.panel, border: `1px solid ${T.borderStrong}`, borderRadius: 14,
      boxShadow: '0 24px 60px rgba(0,0,0,0.35)', padding: 18,
      color: T.text, fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="display" style={{ fontSize: 20, letterSpacing: -0.3 }}>{S.tweaks}</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}>
          <HRIcon name="close" size={16}/>
        </button>
      </div>
      <Row label={S.theme}>
        <Seg opts={[['dark','Dark'],['light','Light']]} value={cfg.theme} onChange={v => setCfg({ ...cfg, theme: v })}/>
      </Row>
      <Row label={S.language}>
        <Seg opts={[['en','English'],['ar','العربية']]} value={cfg.lang} onChange={v => setCfg({ ...cfg, lang: v })}/>
      </Row>
      <Row label={S.density}>
        <Seg opts={[['compact','Compact'],['comfortable','Comfortable']]} value={cfg.density} onChange={v => setCfg({ ...cfg, density: v })}/>
      </Row>
      <Row label={S.chartStyle}>
        <Seg opts={[['line','Line'],['area','Area'],['bar','Bar']]} value={cfg.chartStyle} onChange={v => setCfg({ ...cfg, chartStyle: v })}/>
      </Row>
      <Row label={S.layout}>
        <Seg opts={[['default','Default'],['wide','Wide chart'],['split','Split']]} value={cfg.layout} onChange={v => setCfg({ ...cfg, layout: v })}/>
      </Row>
    </div>
  );
}

export { TweaksPanel };
