import React from 'react';

// --- design-system.jsx ---
// Design System — Wellness+
// Two themes: 'brand' (deep green + amber, default/dark) and 'light' (calm)
// Type: Inter + Fraunces alternative — use Plus Jakarta Sans + Instrument Serif via Google Fonts

const THEMES = {
  brand: {
    name: 'Brand',
    bg: '#0E2A26',
    bgElev: '#143531',
    surface: '#18413C',
    surfaceAlt: '#1E4D47',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.14)',
    text: '#F5F1E8',
    textMuted: 'rgba(245,241,232,0.68)',
    textFaint: 'rgba(245,241,232,0.42)',
    accent: '#F5B544',       // amber
    accentInk: '#1A1206',
    accentSoft: 'rgba(245,181,68,0.14)',
    positive: '#6FC79B',
    negative: '#E27F6A',
    info: '#8FB3C9',
    sheet: '#18413C',
    track: 'rgba(255,255,255,0.10)',
    chipBg: 'rgba(255,255,255,0.06)',
    overlay: 'rgba(8,22,20,0.55)',
    isDark: true,
  },
  light: {
    name: 'Light',
    bg: '#F6F3EC',            // warm off-white
    bgElev: '#FBF8F1',
    surface: '#FFFFFF',
    surfaceAlt: '#F1EDE3',
    border: 'rgba(25,40,38,0.08)',
    borderStrong: 'rgba(25,40,38,0.14)',
    text: '#121F1D',
    textMuted: 'rgba(18,31,29,0.62)',
    textFaint: 'rgba(18,31,29,0.38)',
    accent: '#1F5A4E',        // deep green accent
    accentInk: '#FFFFFF',
    accentSoft: 'rgba(31,90,78,0.10)',
    positive: '#2E7D5E',
    negative: '#B25541',
    info: '#3F6B83',
    sheet: '#FFFFFF',
    track: 'rgba(18,31,29,0.08)',
    chipBg: 'rgba(18,31,29,0.04)',
    overlay: 'rgba(18,31,29,0.32)',
    isDark: false,
  },
};

// ── Typography ────────────────────────────────────────────
const typeStyles = (t) => ({
  displayFont: `'Instrument Serif', 'Fraunces', Georgia, serif`,
  sansFont: `'Plus Jakarta Sans', -apple-system, system-ui, sans-serif`,
  monoFont: `'JetBrains Mono', ui-monospace, Menlo, monospace`,
});

// ── Icons (24px, stroke 1.6) ──────────────────────────────
function Icon({ name, size = 22, stroke, fill = 'none', style = {} }) {
  const s = { width: size, height: size, display: 'inline-block', flexShrink: 0, ...style };
  const sw = 1.6;
  const paths = {
    home: <><path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5z"/></>,
    check: <><path d="M20 6L9 17l-5-5"/></>,
    flame: <><path d="M12 3c1 3.5 4 4.5 4 8.5a4 4 0 1 1-8 0c0-1.2.4-2 1.2-2.8C8.5 7.5 9 5.5 9 4c1 1 2 2 3 2s0-2 0-3z"/></>,
    heart: <><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 18a2 2 0 0 0 4 0"/></>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.8-4 4-6 7-6s6.2 2 7 6"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></>,
    moon: <><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></>,
    bolt: <><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></>,
    wind: <><path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h9"/></>,
    smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="10" r=".8" fill="currentColor"/><circle cx="15" cy="10" r=".8" fill="currentColor"/></>,
    play: <><path d="M7 5v14l12-7-12-7z" fill="currentColor"/></>,
    pause: <><rect x="7" y="5" width="3.5" height="14" fill="currentColor"/><rect x="13.5" y="5" width="3.5" height="14" fill="currentColor"/></>,
    trophy: <><path d="M8 4h8v4a4 4 0 0 1-8 0V4z"/><path d="M5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3"/><path d="M10 13v3h4v-3M8 21h8M12 16v5"/></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
    chev: <><path d="M9 6l6 6-6 6"/></>,
    chevDown: <><path d="M6 9l6 6 6-6"/></>,
    chevUp: <><path d="M6 15l6-6 6 6"/></>,
    close: <><path d="M6 6l12 12M18 6L6 18"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    arrow: <><path d="M5 12h14M13 5l7 7-7 7"/></>,
    arrowL: <><path d="M19 12H5M11 5l-7 7 7 7"/></>,
    qr: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M20 14v3M14 20h3M20 20v1"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>,
    shield: <><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20c.8-3.5 3.2-5 6-5s5.2 1.5 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M21 17c-.5-2-2-3-4-3"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    dot: <><circle cx="12" cy="12" r="3" fill="currentColor"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 8v.5M12 11v5"/></>,
    leaf: <><path d="M4 20c0-8 6-14 16-14 0 10-6 16-14 16 0 0-1-1-2-2z"/><path d="M4 20L14 10"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.5-4.5"/></>,
    book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h13"/></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>,
    camera: <><path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z"/><circle cx="12" cy="13" r="3.5"/></>,
    headphones: <><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M3 18a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2v2zM21 18a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2v2z"/></>,
    library: <><rect x="4" y="4" width="5" height="16" rx="1"/><rect x="11" y="4" width="5" height="16" rx="1"/><path d="M18 5l3 1-2.5 14-3-1z"/></>,
    phone: <><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/></>,
    video: <><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></>,
    chat: <><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4V5z"/></>,
    star: <><path d="M12 3l2.7 6 6.3.6-4.8 4.3 1.4 6.4L12 17l-5.6 3.3L7.8 14 3 9.6l6.3-.6L12 3z" fill="currentColor" stroke="none"/></>,
    chevR: <><path d="M9 6l6 6-6 6"/></>,
    chevL: <><path d="M15 6l-6 6 6 6"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" style={s} fill={fill} stroke={stroke || 'currentColor'} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </svg>
  );
}

// ── Avatar ────────────────────────────────────────────────
const AVATAR_OPTIONS = ['monogram', 'orbit', 'wave', 'bloom', 'stone', 'ember'];

function AvatarDisplay({ theme, kind = 'monogram', name = '?', size = 64 }) {
  const t = theme;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const palettes = {
    monogram: { bg: t.accentSoft, fg: t.accent, ring: t.border },
    orbit:    { bg: '#2B4B8C',    fg: '#C9D9FF', ring: 'transparent' },
    wave:     { bg: '#1C6B5B',    fg: '#B5F0DC', ring: 'transparent' },
    bloom:    { bg: '#C17A52',    fg: '#FFE6CC', ring: 'transparent' },
    stone:    { bg: '#4A4A42',    fg: '#E8E5D9', ring: 'transparent' },
    ember:    { bg: '#8A3B2A',    fg: '#F3CDB8', ring: 'transparent' },
  };
  const p = palettes[kind] || palettes.monogram;
  const inner = (() => {
    if (kind === 'monogram') {
      return (
        <div style={{ fontFamily: typeStyles(t).displayFont, fontSize: size * 0.42, color: p.fg, letterSpacing: -0.5 }}>
          {initial}
        </div>
      );
    }
    if (kind === 'orbit') {
      return (
        <svg width={size} height={size} viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill={p.bg}/>
          <circle cx="32" cy="32" r="20" fill="none" stroke={p.fg} strokeWidth="1.5" opacity="0.5"/>
          <circle cx="32" cy="12" r="5" fill={p.fg}/>
          <circle cx="46" cy="38" r="3" fill={p.fg} opacity="0.7"/>
        </svg>
      );
    }
    if (kind === 'wave') {
      return (
        <svg width={size} height={size} viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill={p.bg}/>
          <path d="M6 36 Q16 28 26 36 T46 36 T66 36" stroke={p.fg} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <path d="M6 46 Q16 38 26 46 T46 46 T66 46" stroke={p.fg} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5"/>
        </svg>
      );
    }
    if (kind === 'bloom') {
      return (
        <svg width={size} height={size} viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill={p.bg}/>
          {[0,60,120,180,240,300].map(a => (
            <ellipse key={a} cx="32" cy="20" rx="4" ry="10" fill={p.fg} opacity="0.8" transform={`rotate(${a} 32 32)`}/>
          ))}
          <circle cx="32" cy="32" r="4" fill={p.fg}/>
        </svg>
      );
    }
    if (kind === 'stone') {
      return (
        <svg width={size} height={size} viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill={p.bg}/>
          <ellipse cx="32" cy="36" rx="18" ry="10" fill={p.fg} opacity="0.6"/>
          <ellipse cx="32" cy="28" rx="14" ry="7" fill={p.fg} opacity="0.8"/>
          <ellipse cx="32" cy="22" rx="9" ry="4.5" fill={p.fg}/>
        </svg>
      );
    }
    if (kind === 'ember') {
      return (
        <svg width={size} height={size} viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill={p.bg}/>
          <path d="M32 14 C22 22 22 32 27 38 C22 40 20 46 24 50 C28 54 38 54 42 50 C46 46 44 40 39 38 C44 32 44 22 32 14z" fill={p.fg}/>
        </svg>
      );
    }
  })();
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, overflow: 'hidden',
      background: p.bg, border: `1px solid ${p.ring}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{inner}</div>
  );
}
function Button({ children, onClick, variant = 'primary', size = 'lg', theme, style = {}, disabled = false, icon, iconR }) {
  const t = theme;
  const sizes = {
    lg: { h: 54, px: 22, fs: 16, r: 16 },
    md: { h: 44, px: 18, fs: 15, r: 14 },
    sm: { h: 34, px: 14, fs: 13, r: 10 },
  };
  const s = sizes[size];
  const variants = {
    primary: { bg: t.accent, color: t.accentInk, border: 'none' },
    secondary: { bg: 'transparent', color: t.text, border: `1px solid ${t.borderStrong}` },
    ghost: { bg: 'transparent', color: t.text, border: 'none' },
    soft: { bg: t.accentSoft, color: t.accent, border: 'none' },
    surface: { bg: t.surface, color: t.text, border: `1px solid ${t.border}` },
  };
  const v = variants[variant];
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      height: s.h, padding: `0 ${s.px}px`, borderRadius: s.r,
      background: v.bg, color: v.color, border: v.border,
      fontFamily: typeStyles(t).sansFont, fontSize: s.fs, fontWeight: 600,
      letterSpacing: -0.1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      gap: 8, cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'transform .15s ease, background .2s ease',
      ...style,
    }} onMouseDown={(e)=>{e.currentTarget.style.transform='scale(0.98)';}}
       onMouseUp={(e)=>{e.currentTarget.style.transform='';}}
       onMouseLeave={(e)=>{e.currentTarget.style.transform='';}}>
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
      {iconR && <Icon name={iconR} size={18} />}
    </button>
  );
}

// ── Surface / Card ────────────────────────────────────────
function Card({ theme, children, style = {}, onClick, pad = 16, radius = 20, alt = false }) {
  const t = theme;
  return (
    <div onClick={onClick} style={{
      background: alt ? t.surfaceAlt : t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: radius, padding: pad,
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>{children}</div>
  );
}

// ── Tag / Chip ────────────────────────────────────────────
function Chip({ theme, children, active = false, onClick, icon, style = {} }) {
  const t = theme;
  return (
    <button onClick={onClick} style={{
      height: 34, padding: '0 12px', borderRadius: 999,
      background: active ? t.accent : t.chipBg,
      color: active ? t.accentInk : t.text,
      border: `1px solid ${active ? 'transparent' : t.border}`,
      fontFamily: typeStyles(t).sansFont, fontSize: 13, fontWeight: 500,
      letterSpacing: -0.1, display: 'inline-flex', alignItems: 'center', gap: 6,
      cursor: 'pointer', whiteSpace: 'nowrap',
      ...style,
    }}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}

// ── Section Label ─────────────────────────────────────────
function SectionLabel({ theme, children, right, style = {} }) {
  const t = theme;
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '0 20px', margin: '4px 0 10px', ...style,
    }}>
      <div style={{
        fontFamily: typeStyles(t).sansFont, fontSize: 12,
        fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase',
        color: t.textMuted,
      }}>{children}</div>
      {right && <div style={{ color: t.textMuted, fontSize: 12 }}>{right}</div>}
    </div>
  );
}

// ── Brand lockup (placeholder until real mark lands) ──────
function WellnessMark({ theme, size = 22, showText = true }) {
  const t = theme;
  const h = size;
  const w = h * (551 / 274);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <img src="assets/wellness-mark.png" alt="Wellness+" style={{ height: h, width: w, display: 'block' }}/>
      {showText && (
        <span style={{
          fontFamily: typeStyles(t).displayFont, fontSize: Math.round(size * 0.9), fontWeight: 500,
          color: t.text, letterSpacing: -0.3,
        }}>
          Wellness<span style={{ color: t.accent }}>+</span>
        </span>
      )}
    </div>
  );
}

// ── Tiny sparkline / bar viz ──────────────────────────────
function Sparkline({ theme, values, height = 40, stroke, width = '100%' }) {
  const t = theme;
  const c = stroke || t.accent;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return [x, y];
  });
  const d = pts.map(([x,y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const darea = `${d} L100,100 L0,100 Z`;
  return (
    <svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sparkg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={c} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={darea} fill="url(#sparkg)"/>
      <path d={d} fill="none" stroke={c} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Ring progress ─────────────────────────────────────────
function Ring({ theme, value = 0, size = 64, stroke = 6, color, bg, children }) {
  const t = theme;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, value)));
  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} stroke={bg || t.track} strokeWidth={stroke} fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={color || t.accent} strokeWidth={stroke} fill="none"
                strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
                transform={`rotate(-90 ${size/2} ${size/2})`}
                style={{ transition: 'stroke-dashoffset .6s ease' }}/>
      </svg>
      {children && <div style={{ position: 'absolute' }}>{children}</div>}
    </div>
  );
}

// ── Slider (controlled) ───────────────────────────────────
function Slider({ theme, value, onChange, min = 0, max = 10, step = 1, labels, accent }) {
  const t = theme;
  const pct = ((value - min) / (max - min)) * 100;
  const c = accent || t.accent;
  return (
    <div style={{ width: '100%' }}>
      <div style={{ position: 'relative', height: 44, display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 999,
          background: t.track,
        }}/>
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: 8, borderRadius: 999,
          background: c, transition: 'width .15s ease',
        }}/>
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 14px)`,
          width: 28, height: 28, borderRadius: 999, background: t.surface,
          border: `2px solid ${c}`, boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
          transition: 'left .15s ease',
        }}/>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer',
          }}/>
      </div>
      {labels && (
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 11, color: t.textMuted, marginTop: 2,
          fontFamily: typeStyles(t).sansFont, letterSpacing: 0.3,
        }}>
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  THEMES, typeStyles, Icon, Button, Card, Chip, SectionLabel,
  WellnessMark, Sparkline, Ring, Slider,
});

export {
  THEMES, typeStyles, Icon, AvatarDisplay, AVATAR_OPTIONS, Button, Card, Chip,
  SectionLabel, WellnessMark, Sparkline, Ring, Slider,
};
