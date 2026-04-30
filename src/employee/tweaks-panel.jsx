import React from 'react';
import { Icon, typeStyles } from './design-system.jsx';

function TweaksPanel({ theme, open, onClose, cfg, setCfg }) {
  const T = theme;
  if (!open) return null;
  const Row = ({ label, children }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: T.textMuted, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
  const OptRow = ({ opts, value, onChange }) => (
    <div style={{ display: 'flex', gap: 6 }}>
      {opts.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          flex: 1, height: 34, borderRadius: 10,
          background: value === k ? T.accent : T.chipBg,
          color: value === k ? T.accentInk : T.text,
          border: `1px solid ${value === k ? 'transparent' : T.border}`,
          fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>{l}</button>
      ))}
    </div>
  );
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, width: 300, zIndex: 100,
      background: T.surface, border: `1px solid ${T.borderStrong}`,
      borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      padding: 18, direction: 'ltr', fontFamily: typeStyles(T).sansFont, color: T.text,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: typeStyles(T).displayFont, fontSize: 20, letterSpacing: -0.3 }}>Tweaks</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}>
          <Icon name="close" size={18}/>
        </button>
      </div>
      <Row label="Theme">
        <OptRow opts={[['brand','Brand (Dark)'],['light','Light']]} value={cfg.theme} onChange={v => setCfg({ ...cfg, theme: v })}/>
      </Row>
      <Row label="Language">
        <OptRow opts={[['en','English'],['ar','العربية']]} value={cfg.lang} onChange={v => setCfg({ ...cfg, lang: v })}/>
      </Row>
      <Row label="Home layout">
        <OptRow opts={[['list','List'],['stack','Stack'],['agenda','Agenda']]} value={cfg.homeVariant} onChange={v => setCfg({ ...cfg, homeVariant: v })}/>
      </Row>
      <Row label="Check-in style">
        <OptRow opts={[['sliders','Sliders'],['emoji','Emoji'],['cards','Cards']]} value={cfg.checkinVariant} onChange={v => setCfg({ ...cfg, checkinVariant: v })}/>
      </Row>
      <Row label="Leaderboard">
        <OptRow opts={[['podium','Podium'],['list','List']]} value={cfg.leaderboardVariant} onChange={v => setCfg({ ...cfg, leaderboardVariant: v })}/>
      </Row>
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 8 }}>Tap Profile to re-run onboarding.</div>
      <button onClick={() => setCfg({ ...cfg, screen: 'join', onboarded: false })} style={{
        marginTop: 10, width: '100%', height: 36, borderRadius: 10,
        background: T.chipBg, border: `1px solid ${T.border}`, color: T.text,
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>Restart onboarding</button>
    </div>
  );
}

export { TweaksPanel };
