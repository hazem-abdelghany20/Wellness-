import React from 'react';
// --- hr-components.jsx ---
// HR Portal — primitives: Icon, Button, Card, Badge, Sparkline, Trend chart, Avatar, Toggle

function HRIcon({ name, size = 18, stroke, style = {} }) {
  const sw = 1.6;
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    teams: <><circle cx="9" cy="8" r="3"/><path d="M3 20c.8-3.5 3.2-5 6-5s5.2 1.5 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M21 17c-.5-2-2-3-4-3"/></>,
    people: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.8-4 4-6 7-6s6.2 2 7 6"/></>,
    safety: <><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></>,
    content: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 4v16"/></>,
    challenges: <><path d="M8 4h8v4a4 4 0 0 1-8 0V4z"/><path d="M5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3"/><path d="M10 13v3h4v-3M8 21h8M12 16v5"/></>,
    broadcasts: <><path d="M3 10v4a1 1 0 0 0 1 1h4l6 5V4L8 9H4a1 1 0 0 0-1 1z"/><path d="M18 8a5 5 0 0 1 0 8"/></>,
    reports: <><path d="M9 3h7l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4"/><path d="M9 3v4h7"/><path d="M8 13h8M8 17h5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.5-4.5"/></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 18a2 2 0 0 0 4 0"/></>,
    download: <><path d="M12 4v12M6 10l6 6 6-6"/><path d="M4 20h16"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    chev: <><path d="M9 6l6 6-6 6"/></>,
    chevDown: <><path d="M6 9l6 6 6-6"/></>,
    chevUp: <><path d="M6 15l6-6 6 6"/></>,
    arrow: <><path d="M5 12h14M13 5l7 7-7 7"/></>,
    close: <><path d="M6 6l12 12M18 6L6 18"/></>,
    check: <><path d="M20 6L9 17l-5-5"/></>,
    flag: <><path d="M4 3v18"/><path d="M4 4h13l-2 4 2 4H4"/></>,
    more: <><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></>,
    filter: <><path d="M4 5h16M7 12h10M10 19h4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    up: <><path d="M6 15l6-6 6 6"/></>,
    down: <><path d="M6 9l6 6 6-6"/></>,
    flat: <><path d="M4 12h16"/></>,
    moon: <><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></>,
    leaf: <><path d="M4 20c0-8 6-14 16-14 0 10-6 16-14 16 0 0-1-1-2-2z"/><path d="M4 20L14 10"/></>,
    bolt: <><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></>,
    smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="10" r=".8" fill="currentColor"/><circle cx="15" cy="10" r=".8" fill="currentColor"/></>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></>,
    shield: <><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    play: <><path d="M7 5v14l12-7-12-7z" fill="currentColor"/></>,
    book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h13"/></>,
    headphones: <><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M3 18a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2v2zM21 18a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2v2z"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></>,
    phone: <><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke || 'currentColor'} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', flexShrink: 0, ...style }}>
      {paths[name] || null}
    </svg>
  );
}

function HRButton({ children, onClick, variant = 'primary', size = 'md', icon, iconR, style = {}, theme }) {
  const T = theme;
  const sizes = {
    sm: { h: 30, px: 12, fs: 12, r: 8,  iconSize: 14 },
    md: { h: 36, px: 14, fs: 13, r: 10, iconSize: 16 },
    lg: { h: 44, px: 18, fs: 14, r: 12, iconSize: 18 },
  };
  const s = sizes[size];
  const variants = {
    primary:   { bg: T.accent, color: T.accentInk, border: 'transparent' },
    secondary: { bg: T.panel, color: T.text, border: T.borderStrong },
    ghost:     { bg: 'transparent', color: T.textMid, border: 'transparent' },
    soft:      { bg: T.accentSoft, color: T.accent, border: 'transparent' },
    danger:    { bg: T.panel, color: T.danger, border: T.borderStrong },
  };
  const v = variants[variant];
  return (
    <button onClick={onClick} style={{
      height: s.h, padding: `0 ${s.px}px`, borderRadius: s.r,
      background: v.bg, color: v.color, border: `1px solid ${v.border}`,
      fontSize: s.fs, fontWeight: 600, cursor: 'pointer', letterSpacing: -0.1,
      display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
      transition: 'background .15s, border-color .15s',
      ...style,
    }}>
      {icon && <HRIcon name={icon} size={s.iconSize}/>}
      {children && <span>{children}</span>}
      {iconR && <HRIcon name={iconR} size={s.iconSize}/>}
    </button>
  );
}

function Panel({ theme, children, style = {}, pad = true, density = 'comfortable' }) {
  const T = theme;
  const d = DENSITY[density];
  return (
    <div style={{
      background: T.panel, border: `1px solid ${T.border}`,
      borderRadius: 14, boxShadow: T.shadowSm,
      padding: pad ? d.cardPad : 0,
      ...style,
    }}>{children}</div>
  );
}

function PanelHeader({ theme, title, subtitle, right, density = 'comfortable', style = {} }) {
  const T = theme;
  const d = DENSITY[density];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: `${d.cardPad - 2}px ${d.cardPad}px ${density === 'compact' ? 10 : 14}px`,
      borderBottom: `1px solid ${T.divider}`,
      ...style,
    }}>
      <div>
        <div style={{ fontSize: density === 'compact' ? 13 : 14, fontWeight: 700, color: T.text, letterSpacing: -0.1 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function Badge({ theme, tone = 'neutral', children, dot = false, style = {} }) {
  const T = theme;
  const tones = {
    neutral:  { bg: T.panelSunk, color: T.textMid, bd: T.border },
    positive: { bg: T.isDark ? 'rgba(111,199,155,0.12)' : 'rgba(46,125,94,0.10)', color: T.positive, bd: 'transparent' },
    caution:  { bg: T.isDark ? 'rgba(245,181,68,0.15)'  : 'rgba(180,134,31,0.12)', color: T.caution,  bd: 'transparent' },
    danger:   { bg: T.isDark ? 'rgba(226,127,106,0.15)' : 'rgba(162,67,43,0.12)',  color: T.danger,   bd: 'transparent' },
    info:     { bg: T.isDark ? 'rgba(143,179,201,0.14)' : 'rgba(63,107,131,0.10)', color: T.info,     bd: 'transparent' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 999,
      background: t.bg, color: t.color, border: `1px solid ${t.bd}`,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.1, lineHeight: 1.2,
      ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: t.color }}/>}
      {children}
    </span>
  );
}

function Delta({ theme, value, suffix = '', invert = false }) {
  const T = theme;
  if (value === 0) return <span style={{ color: T.textMuted, fontSize: 12, fontWeight: 600 }}>·</span>;
  const up = value > 0;
  const good = invert ? !up : up;
  const color = good ? T.positive : T.danger;
  return (
    <span style={{ color, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }} className="mono">
      <HRIcon name={up ? 'up' : 'down'} size={12}/>
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

// Sparkline / line / area — chartStyle = 'line' | 'area' | 'bar'
function Spark({ theme, values, height = 40, width = 120, color, chartStyle = 'area', showDots = false }) {
  const T = theme;
  const c = color || T.accent;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 6) - 3]);
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  if (chartStyle === 'bar') {
    const bw = Math.max(2, stepX * 0.55);
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        {pts.map(([x, y], i) => (
          <rect key={i} x={x - bw/2} y={y} width={bw} height={height - y - 1} rx={1.5} fill={c} opacity={0.85}/>
        ))}
      </svg>
    );
  }
  const area = d + ` L${width} ${height} L0 ${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {chartStyle === 'area' && <path d={area} fill={c} opacity={T.isDark ? 0.18 : 0.12}/>}
      <path d={d} stroke={c} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {showDots && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={1.8} fill={c}/>)}
    </svg>
  );
}

// Multi-series trend chart
function TrendChart({ theme, series, labels, height = 260, chartStyle = 'line', activeKeys }) {
  const T = theme;
  const width = 820;
  const padL = 44, padR = 20, padT = 20, padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const activeSeries = series.filter(s => !activeKeys || activeKeys.includes(s.key));
  const all = activeSeries.flatMap(s => s.values);
  const minV = 0;
  const maxV = 10;
  const n = labels.length;
  const stepX = plotW / (n - 1);

  const yToPx = (v) => padT + plotH - ((v - minV) / (maxV - minV)) * plotH;
  const xToPx = (i) => padL + i * stepX;

  // gridlines at 0, 2.5, 5, 7.5, 10
  const grid = [0, 2.5, 5, 7.5, 10];

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {grid.map(g => (
        <g key={g}>
          <line x1={padL} x2={width - padR} y1={yToPx(g)} y2={yToPx(g)} stroke={T.divider} strokeWidth="1" strokeDasharray={g === 0 ? '' : '2 3'}/>
          <text x={padL - 10} y={yToPx(g) + 4} fontSize="10" fill={T.textFaint} textAnchor="end" fontFamily="IBM Plex Mono">{g}</text>
        </g>
      ))}
      {labels.map((lab, i) => (
        <text key={i} x={xToPx(i)} y={height - 10} fontSize="10" fill={T.textFaint} textAnchor="middle">{lab}</text>
      ))}
      {activeSeries.map((s, si) => {
        const color = s.color;
        const pts = s.values.map((v, i) => [xToPx(i), yToPx(v)]);
        const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
        if (chartStyle === 'bar') {
          const bw = Math.max(4, stepX * 0.12);
          const offset = (si - (activeSeries.length - 1) / 2) * (bw + 2);
          return (
            <g key={s.key}>
              {pts.map(([x, y], i) => (
                <rect key={i} x={x - bw/2 + offset} y={y} width={bw} height={padT + plotH - y} rx="1.5" fill={color} opacity="0.85"/>
              ))}
            </g>
          );
        }
        const area = d + ` L${xToPx(s.values.length - 1)} ${padT + plotH} L${padL} ${padT + plotH} Z`;
        return (
          <g key={s.key}>
            {chartStyle === 'area' && <path d={area} fill={color} opacity={T.isDark ? 0.15 : 0.08}/>}
            <path d={d} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.5" fill={color}/>)}
          </g>
        );
      })}
    </svg>
  );
}

function Bullet({ theme, value, max = 10, thresholds = [4, 6.5], color }) {
  const T = theme;
  const c = color || T.accent;
  const pct = Math.min(1, Math.max(0, value / max));
  return (
    <div style={{ position: 'relative', height: 8, background: T.panelSunk, borderRadius: 999, width: '100%', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${pct * 100}%`, background: c, borderRadius: 999,
      }}/>
      {thresholds.map((t, i) => (
        <div key={i} style={{
          position: 'absolute', top: -2, bottom: -2,
          left: `${(t / max) * 100}%`, width: 1, background: T.textFaint, opacity: 0.4,
        }}/>
      ))}
    </div>
  );
}

function AvatarMark({ name = '?', size = 32, theme, kind = 'auto' }) {
  const T = theme;
  const initials = (name || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  // hash name → palette
  const palettes = [
    { bg: '#2B4B8C', fg: '#C9D9FF' },
    { bg: '#1C6B5B', fg: '#B5F0DC' },
    { bg: '#C17A52', fg: '#FFE6CC' },
    { bg: '#4A4A42', fg: '#E8E5D9' },
    { bg: '#8A3B2A', fg: '#F3CDB8' },
    { bg: '#6D4F8F', fg: '#E2D4F7' },
  ];
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const p = palettes[Math.abs(h) % palettes.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: p.bg, color: p.fg, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, letterSpacing: -0.2,
    }}>{initials}</div>
  );
}

function Toggle({ theme, value, onChange, size = 'md' }) {
  const T = theme;
  const w = size === 'sm' ? 34 : 42;
  const h = size === 'sm' ? 20 : 24;
  const k = h - 6;
  return (
    <button onClick={() => onChange(!value)} style={{
      width: w, height: h, borderRadius: 999,
      background: value ? T.accent : T.panelSunk,
      border: `1px solid ${value ? 'transparent' : T.border}`,
      padding: 0, cursor: 'pointer', position: 'relative', transition: 'background .2s',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: value ? w - k - 3 : 2,
        width: k, height: k, borderRadius: 999, background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .2s',
      }}/>
    </button>
  );
}

Object.assign(window, {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart, Bullet, AvatarMark, Toggle,
});

export { HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart, Bullet, AvatarMark, Toggle };
