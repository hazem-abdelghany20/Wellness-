import React from 'react';
import * as ReactDOM from 'react-dom/client';
// --- hr-tokens.jsx ---
// Design tokens + i18n for HR Portal

const HR_THEMES = {
  light: {
    name: 'Light',
    isDark: false,
    bg: '#F6F3EC',
    page: '#EFEADD',
    panel: '#FFFFFF',
    panelAlt: '#FBF8F1',
    panelSunk: '#F1ECDE',
    border: 'rgba(20,45,42,0.09)',
    borderStrong: 'rgba(20,45,42,0.16)',
    divider: 'rgba(20,45,42,0.06)',
    text: '#0D2321',
    textMid: '#3B4F4C',
    textMuted: 'rgba(13,35,33,0.58)',
    textFaint: 'rgba(13,35,33,0.38)',
    ink: '#0D2321',
    accent: '#1F5A4E',       // deep green
    accentInk: '#FFFFFF',
    accentSoft: 'rgba(31,90,78,0.10)',
    warm: '#C27A38',          // amber in light ctx
    warmSoft: 'rgba(194,122,56,0.12)',
    positive: '#2E7D5E',
    caution:  '#B4861F',
    danger:   '#A2432B',
    info:     '#3F6B83',
    series: ['#1F5A4E', '#C27A38', '#3F6B83', '#A2432B', '#6D4F8F'],
    sidebarBg: '#0E2A26',
    sidebarText: 'rgba(245,241,232,0.72)',
    sidebarActive: '#F5B544',
    sidebarActiveText: '#1A1206',
    sidebarMark: '#F5F1E8',
    shadowSm: '0 1px 2px rgba(13,35,33,0.05)',
    shadowMd: '0 6px 18px rgba(13,35,33,0.06)',
  },
  dark: {
    name: 'Dark',
    isDark: true,
    bg: '#0B1F1C',
    page: '#0A1B19',
    panel: '#112B27',
    panelAlt: '#143532',
    panelSunk: '#0E2522',
    border: 'rgba(245,241,232,0.07)',
    borderStrong: 'rgba(245,241,232,0.14)',
    divider: 'rgba(245,241,232,0.05)',
    text: '#F5F1E8',
    textMid: 'rgba(245,241,232,0.82)',
    textMuted: 'rgba(245,241,232,0.58)',
    textFaint: 'rgba(245,241,232,0.34)',
    ink: '#F5F1E8',
    accent: '#F5B544',        // amber
    accentInk: '#1A1206',
    accentSoft: 'rgba(245,181,68,0.14)',
    warm: '#F5B544',
    warmSoft: 'rgba(245,181,68,0.14)',
    positive: '#6FC79B',
    caution:  '#F5B544',
    danger:   '#E27F6A',
    info:     '#8FB3C9',
    series: ['#F5B544', '#6FC79B', '#8FB3C9', '#E27F6A', '#B9A0D9'],
    sidebarBg: '#081714',
    sidebarText: 'rgba(245,241,232,0.68)',
    sidebarActive: '#F5B544',
    sidebarActiveText: '#1A1206',
    sidebarMark: '#F5F1E8',
    shadowSm: '0 1px 2px rgba(0,0,0,0.25)',
    shadowMd: '0 10px 30px rgba(0,0,0,0.4)',
  },
};

const DENSITY = {
  compact:    { row: 40, cellPadY: 8,  cardPad: 16, gap: 14, kpiPad: 16 },
  comfortable:{ row: 52, cellPadY: 12, cardPad: 20, gap: 20, kpiPad: 22 },
};

const HR_STRINGS = {
  en: {
    dashboard: 'Dashboard', teams: 'Teams', people: 'People',
    safety: 'Safety', content: 'Content', challenges: 'Challenges',
    broadcasts: 'Broadcasts', reports: 'Reports', settings: 'Settings',
    overview: 'Overview',
    tenant: 'Nile Group',
    search: 'Search teams, people, content…',
    today: 'Today', week: 'This week', month: 'This month', quarter: 'This quarter',
    exportPdf: 'Export report',
    wellbeingIndex: 'Wellbeing Index',
    weeklyActive: 'Weekly active',
    atRiskTeams: 'At-risk teams',
    safetyFlags: 'Safety flags',
    vsPrior: 'vs. prior period',
    seven: '7d', thirty: '30d', ninety: '90d',
    wellbeingTrends: 'Wellbeing trends',
    sleep: 'Sleep', stress: 'Stress', energy: 'Energy', mood: 'Mood',
    teamBreakdown: 'Team breakdown',
    filterAll: 'All departments',
    team: 'Team', head: 'Head', size: 'Size', index: 'Index', trend: 'Trend', risk: 'Risk',
    safetyQueue: 'Safety escalation queue',
    activeBroadcasts: 'Broadcasts',
    draftPost: 'New broadcast',
    contentPins: 'Pinned for your org',
    activeChallenges: 'Active challenges',
    newChallenge: 'New challenge',
    lastUpdated: 'Last updated',
    rolesSeats: 'Seats · Roles',
    seatsUsed: 'seats active of',
    density: 'Density', layout: 'Layout', chartStyle: 'Chart style', theme: 'Theme', language: 'Language',
    tweaks: 'Tweaks',
    low: 'Low', med: 'Elevated', high: 'High',
    resolved: 'Resolved', open: 'Open', review: 'Review',
    viewAll: 'View all',
    peopleYouManage: 'People you manage',
    greeting: 'Good morning, Hana',
    subGreet: 'Here\u2019s your org\u2019s wellbeing snapshot for',
    actions: 'Actions',
    notifs: 'Notifications',
    engagement: 'Engagement',
    downTrend: 'Down', upTrend: 'Up', flat: 'Flat',
    nudge: 'Send nudge', message: 'Message', viewProfile: 'View profile',
  },
  ar: {
    dashboard: 'لوحة التحكم', teams: 'الفرق', people: 'الأشخاص',
    safety: 'السلامة', content: 'المحتوى', challenges: 'التحديات',
    broadcasts: 'البث', reports: 'التقارير', settings: 'الإعدادات',
    overview: 'نظرة عامة',
    tenant: 'مجموعة النيل',
    search: 'ابحث عن الفرق، الأشخاص، المحتوى…',
    today: 'اليوم', week: 'هذا الأسبوع', month: 'هذا الشهر', quarter: 'هذا الربع',
    exportPdf: 'تصدير التقرير',
    wellbeingIndex: 'مؤشر الرفاهية',
    weeklyActive: 'النشاط الأسبوعي',
    atRiskTeams: 'الفرق المعرضة للخطر',
    safetyFlags: 'إشارات السلامة',
    vsPrior: 'مقارنة بالفترة السابقة',
    seven: '٧ي', thirty: '٣٠ي', ninety: '٩٠ي',
    wellbeingTrends: 'اتجاهات الرفاهية',
    sleep: 'النوم', stress: 'التوتر', energy: 'الطاقة', mood: 'المزاج',
    teamBreakdown: 'تفاصيل الفرق',
    filterAll: 'كل الأقسام',
    team: 'الفريق', head: 'القائد', size: 'العدد', index: 'المؤشر', trend: 'الاتجاه', risk: 'المخاطر',
    safetyQueue: 'قائمة تصعيد السلامة',
    activeBroadcasts: 'البث',
    draftPost: 'بث جديد',
    contentPins: 'مثبَّت لمنظمتك',
    activeChallenges: 'تحديات نشطة',
    newChallenge: 'تحدي جديد',
    lastUpdated: 'آخر تحديث',
    rolesSeats: 'المقاعد · الأدوار',
    seatsUsed: 'مقعد نشط من',
    density: 'الكثافة', layout: 'التخطيط', chartStyle: 'نمط الرسم', theme: 'المظهر', language: 'اللغة',
    tweaks: 'التعديلات',
    low: 'منخفض', med: 'مرتفع', high: 'عالٍ',
    resolved: 'تم الحل', open: 'مفتوح', review: 'للمراجعة',
    viewAll: 'عرض الكل',
    peopleYouManage: 'الأشخاص الذين تديرهم',
    greeting: 'صباح الخير، هناء',
    subGreet: 'لمحة عن رفاهية منظمتك ',
    actions: 'إجراءات',
    notifs: 'الإشعارات',
    engagement: 'المشاركة',
    downTrend: 'منخفض', upTrend: 'مرتفع', flat: 'ثابت',
    nudge: 'إرسال تحفيز', message: 'رسالة', viewProfile: 'عرض الملف',
  },
};

Object.assign(window, { HR_THEMES, DENSITY, HR_STRINGS });
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
// --- hr-sections.jsx ---
// HR Portal sections: KPI strip, trends chart, at-risk teams, team breakdown, safety queue,
// broadcasts, content pins, active challenges, sidebar, topbar, people drawer.

// ── DATA ─────────────────────────────────────────────────────────
const HR_DATA = {
  kpis: [
    { key: 'index',  label: 'wellbeingIndex', value: 6.8, suffix: '/10', delta: 0.4, invert: false,
      spark: [6.1, 6.2, 6.0, 6.3, 6.5, 6.6, 6.8] },
    { key: 'active', label: 'weeklyActive',   value: 1284, suffix: '',  delta: 2.3, invert: false, fmt: (v) => v.toLocaleString(),
      spark: [1180, 1210, 1165, 1220, 1245, 1260, 1284] },
    { key: 'risk',   label: 'atRiskTeams',    value: 4, suffix: '',  delta: -1, invert: true,
      spark: [6, 5, 6, 5, 5, 5, 4] },
    { key: 'safety', label: 'safetyFlags',    value: 7, suffix: ' open', delta: 2, invert: true,
      spark: [3, 4, 4, 5, 6, 6, 7] },
  ],
  trends: {
    labels: ['Apr 1','Apr 4','Apr 7','Apr 10','Apr 13','Apr 16','Apr 19','Apr 22'],
    labelsAr: ['١ إبريل','٤','٧','١٠','١٣','١٦','١٩','٢٢ إبريل'],
    series: [
      { key: 'sleep',  name: 'Sleep',  values: [6.3, 6.5, 6.2, 6.6, 6.8, 6.7, 7.0, 7.1] },
      { key: 'stress', name: 'Stress', values: [6.2, 6.4, 6.5, 6.8, 6.3, 6.0, 5.7, 5.5] },
      { key: 'energy', name: 'Energy', values: [5.8, 5.9, 6.0, 6.2, 6.3, 6.5, 6.6, 6.7] },
      { key: 'mood',   name: 'Mood',   values: [6.4, 6.5, 6.6, 6.5, 6.7, 6.8, 6.9, 7.0] },
    ],
  },
  atRisk: [
    { team: 'Customer Ops — Tier 2', head: 'Marwan El-Sayed', size: 28, index: 4.6, trend: -0.8, risk: 'high',
      reason: { en: 'Elevated stress × 3 weeks', ar: 'توتر مرتفع لـ 3 أسابيع' } },
    { team: 'Finance — Accounts Payable', head: 'Farida Hassan', size: 16, index: 5.1, trend: -0.4, risk: 'high',
      reason: { en: 'Sleep dropped 1.2h', ar: 'انخفاض النوم 1.2س' } },
    { team: 'Field Sales — Delta', head: 'Khaled Ibrahim', size: 22, index: 5.4, trend: -0.2, risk: 'med',
      reason: { en: 'Engagement down 18%', ar: 'انخفاض المشاركة 18%' } },
    { team: 'Logistics — Night shift', head: 'Rania Nour', size: 19, index: 5.5, trend: -0.3, risk: 'med',
      reason: { en: 'Low recovery score', ar: 'انخفاض التعافي' } },
  ],
  teams: [
    { team: 'Engineering — Platform', dept: 'Tech',       head: 'Yousef Kamal',  size: 42, index: 7.4, trend: 0.3, risk: 'low',
      sleep: 7.2, stress: 4.9, energy: 6.8, mood: 7.1 },
    { team: 'Engineering — Mobile',   dept: 'Tech',       head: 'Dina Abbas',    size: 18, index: 6.9, trend: 0.1, risk: 'low',
      sleep: 6.8, stress: 5.4, energy: 6.6, mood: 7.0 },
    { team: 'Customer Ops — Tier 1',  dept: 'Support',    head: 'Omar Fathy',    size: 31, index: 6.1, trend: -0.1, risk: 'med',
      sleep: 6.1, stress: 6.6, energy: 5.8, mood: 6.4 },
    { team: 'Customer Ops — Tier 2',  dept: 'Support',    head: 'Marwan El-Sayed', size: 28, index: 4.6, trend: -0.8, risk: 'high',
      sleep: 5.2, stress: 7.8, energy: 4.9, mood: 5.1 },
    { team: 'Finance — Accounts Payable', dept: 'Finance', head: 'Farida Hassan', size: 16, index: 5.1, trend: -0.4, risk: 'high',
      sleep: 5.4, stress: 7.2, energy: 5.2, mood: 5.6 },
    { team: 'Finance — FP&A',          dept: 'Finance',    head: 'Sara Mansour',  size: 12, index: 6.8, trend: 0.2, risk: 'low',
      sleep: 6.8, stress: 5.6, energy: 6.6, mood: 6.9 },
    { team: 'Field Sales — Delta',     dept: 'Sales',      head: 'Khaled Ibrahim', size: 22, index: 5.4, trend: -0.2, risk: 'med',
      sleep: 5.8, stress: 6.8, energy: 5.4, mood: 5.6 },
    { team: 'Logistics — Day',         dept: 'Ops',        head: 'Hossam El-Din', size: 35, index: 6.4, trend: 0.1, risk: 'low',
      sleep: 6.4, stress: 6.0, energy: 6.2, mood: 6.5 },
    { team: 'Logistics — Night shift', dept: 'Ops',        head: 'Rania Nour',    size: 19, index: 5.5, trend: -0.3, risk: 'med',
      sleep: 5.3, stress: 6.7, energy: 5.4, mood: 5.8 },
    { team: 'People & Culture',        dept: 'HR',         head: 'Hana El-Masry', size: 9,  index: 7.8, trend: 0.4, risk: 'low',
      sleep: 7.4, stress: 4.6, energy: 7.2, mood: 7.6 },
  ],
  people: [
    { name: 'Amira Mostafa', role: 'Senior Analyst', team: 'Finance — Accounts Payable', index: 4.8, trend: -0.6, last: '2d ago', flag: false },
    { name: 'Mahmoud Fayed', role: 'Support Lead',   team: 'Customer Ops — Tier 2',       index: 5.2, trend: -0.4, last: '1d ago', flag: true  },
    { name: 'Nour Saeed',    role: 'Account Mgr',    team: 'Field Sales — Delta',         index: 5.6, trend: -0.2, last: 'Today',  flag: false },
    { name: 'Tariq Helmy',   role: 'Engineer II',    team: 'Engineering — Platform',      index: 7.1, trend: 0.2,  last: 'Today',  flag: false },
    { name: 'Laila Adib',    role: 'FP&A Analyst',   team: 'Finance — FP&A',              index: 6.9, trend: 0.1,  last: 'Today',  flag: false },
  ],
  safety: [
    { id: 'SF-204', who: 'Anonymous · Tier 2', severity: 'high',   opened: '2h ago', note: { en: 'Self-reported burnout — asked to speak to someone', ar: 'إرهاق مُبلَّغ ذاتياً — طلب التحدث مع شخص ما' }, status: 'open' },
    { id: 'SF-203', who: 'Anonymous · Logistics Night', severity: 'high', opened: '5h ago', note: { en: 'Three consecutive nights < 4h sleep', ar: 'ثلاث ليالٍ متتالية < 4س نوم' }, status: 'open' },
    { id: 'SF-201', who: 'Anonymous · Support',    severity: 'med', opened: 'Yesterday', note: { en: 'Stress spike after schedule change', ar: 'ارتفاع التوتر بعد تغيير الجدول' }, status: 'review' },
    { id: 'SF-199', who: 'Anonymous · Sales Delta', severity: 'med', opened: '2d ago',   note: { en: 'Low mood pattern × 2 weeks', ar: 'نمط مزاج منخفض لـ أسبوعين' }, status: 'review' },
  ],
  broadcasts: [
    { id: 1, title: { en: 'Ramadan wind-down tips', ar: 'نصائح الاسترخاء الرمضانية' }, segment: { en: 'All staff', ar: 'كل الموظفين' }, opens: '78%', sent: 'Mon · 09:00' },
    { id: 2, title: { en: 'Mindfulness week starts Monday', ar: 'أسبوع اليقظة يبدأ الإثنين' }, segment: { en: 'Egypt · all depts', ar: 'مصر · كل الأقسام' }, opens: '64%', sent: 'Apr 15' },
    { id: 3, title: { en: 'Reach out — Support Tier 2', ar: 'تواصل — دعم المستوى 2' }, segment: { en: 'Team · 28 people', ar: 'الفريق · 28 شخصاً' }, opens: '—', sent: 'Draft' },
  ],
  content: [
    { kind: 'audio',   title: { en: 'Sleep onset — a cue for tonight', ar: 'بداية النوم — إشارة لهذه الليلة' }, mins: 6, pinned: true },
    { kind: 'video',   title: { en: 'Desk mobility flow',               ar: 'حركات مكتبية' }, mins: 4, pinned: true },
    { kind: 'article', title: { en: 'Build an evening wind-down',      ar: 'بناء روتين استرخاء مسائي' }, mins: 5, pinned: false },
  ],
  challenges: [
    { title: { en: 'Move April',         ar: 'تحرَّك أبريل' },       joined: 412, target: '150k steps · team',  end: '8 days left' },
    { title: { en: 'Lights out by 11',   ar: 'النوم قبل الـ11' },     joined: 287, target: '21 days · individual', end: '14 days left' },
    { title: { en: '3-min reset daily',   ar: 'استراحة 3 دقائق يوميًا' }, joined: 198, target: '30 days · team',    end: '20 days left' },
  ],
};

// ── SIDEBAR ──────────────────────────────────────────────────────
function Sidebar({ theme, S, active, onNav, collapsed }) {
  const T = theme;
  const items = [
    { id: 'dashboard', key: 'dashboard' },
    { id: 'teams', key: 'teams' },
    { id: 'people', key: 'people' },
    { id: 'safety', key: 'safety', badge: 7 },
    { id: 'content', key: 'content' },
    { id: 'challenges', key: 'challenges' },
    { id: 'broadcasts', key: 'broadcasts' },
    { id: 'reports', key: 'reports' },
  ];
  const w = collapsed ? 68 : 232;
  return (
    <aside style={{
      width: w, flexShrink: 0, background: T.sidebarBg, color: T.sidebarText,
      display: 'flex', flexDirection: 'column', transition: 'width .2s',
      borderInlineEnd: `1px solid rgba(245,241,232,0.06)`,
      position: 'sticky', top: 0, height: '100vh', zIndex: 10,
    }}>
      <div style={{ padding: collapsed ? '18px 14px' : '18px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="assets/wellness-mark.png" alt="" style={{ height: 22, filter: 'brightness(0) invert(1)' }}/>
        {!collapsed && (
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: T.sidebarMark, letterSpacing: -0.3, lineHeight: 1 }}>
            Wellness<span style={{ color: T.sidebarActive }}>+</span>
          </div>
        )}
      </div>

      <div style={{ padding: collapsed ? '6px 10px' : '6px 14px', marginTop: 10 }}>
        {!collapsed && (
          <div style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(245,241,232,0.42)', padding: '6px 8px 6px', fontWeight: 700 }}>
            {S.overview}
          </div>
        )}
        {items.map(it => {
          const isActive = active === it.id;
          return (
            <button key={it.id} onClick={() => onNav(it.id)} style={{
              width: '100%', padding: collapsed ? '10px 12px' : '9px 12px',
              display: 'flex', alignItems: 'center', gap: 12, justifyContent: collapsed ? 'center' : 'flex-start',
              background: isActive ? 'rgba(245,181,68,0.12)' : 'transparent',
              color: isActive ? T.sidebarActive : T.sidebarText,
              border: 'none', borderRadius: 10, cursor: 'pointer', marginBottom: 2,
              fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
              borderInlineStart: isActive ? `2px solid ${T.sidebarActive}` : '2px solid transparent',
            }}>
              <HRIcon name={it.id} size={18}/>
              {!collapsed && <span style={{ flex: 1, textAlign: 'start' }}>{S[it.key]}</span>}
              {!collapsed && it.badge && (
                <span style={{
                  minWidth: 20, height: 18, padding: '0 6px', borderRadius: 999,
                  background: '#E27F6A', color: '#1a0a06',
                  fontSize: 10, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{it.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }}/>
      <div style={{ padding: collapsed ? '10px' : '10px 14px', borderTop: '1px solid rgba(245,241,232,0.06)' }}>
        <button onClick={() => onNav('settings')} style={{
          width: '100%', padding: collapsed ? '10px 12px' : '9px 12px',
          display: 'flex', alignItems: 'center', gap: 12, justifyContent: collapsed ? 'center' : 'flex-start',
          background: 'transparent', color: T.sidebarText, border: 'none', cursor: 'pointer',
          borderRadius: 10, fontSize: 13, fontWeight: 500,
        }}>
          <HRIcon name="settings" size={18}/>
          {!collapsed && <span>{S.settings}</span>}
        </button>
      </div>
    </aside>
  );
}

// ── TOP BAR ─────────────────────────────────────────────────────
function TopBar({ theme, S, dir, range, onRange, onExport, onTweaks }) {
  const T = theme;
  return (
    <div style={{
      height: 64, borderBottom: `1px solid ${T.border}`, background: T.panel,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 18, position: 'sticky', top: 0, zIndex: 5,
    }}>
      {/* search */}
      <div style={{
        flex: 1, maxWidth: 480, height: 38, background: T.panelSunk, borderRadius: 10,
        border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10,
      }}>
        <HRIcon name="search" size={16} stroke={T.textMuted}/>
        <input placeholder={S.search} style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: T.text, fontSize: 13, textAlign: dir === 'rtl' ? 'right' : 'left',
        }}/>
        <span className="mono" style={{
          padding: '2px 6px', borderRadius: 5, border: `1px solid ${T.border}`,
          fontSize: 10, color: T.textMuted,
        }}>⌘K</span>
      </div>

      <div style={{ flex: 1 }}/>

      {/* range */}
      <div style={{ display: 'flex', background: T.panelSunk, borderRadius: 10, padding: 3, border: `1px solid ${T.border}` }}>
        {[['7d', S.seven], ['30d', S.thirty], ['90d', S.ninety]].map(([k, l]) => (
          <button key={k} onClick={() => onRange(k)} style={{
            padding: '6px 12px', borderRadius: 7,
            background: range === k ? T.panel : 'transparent',
            color: range === k ? T.text : T.textMuted,
            border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            boxShadow: range === k ? T.shadowSm : 'none',
          }}>{l}</button>
        ))}
      </div>

      <HRButton theme={T} variant="secondary" icon="download" onClick={onExport}>{S.exportPdf}</HRButton>

      <div style={{ width: 1, height: 28, background: T.border }}/>

      <button style={{
        background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative',
        color: T.textMid, display: 'flex', alignItems: 'center',
      }}>
        <HRIcon name="bell" size={18}/>
        <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 999, background: T.danger }}/>
      </button>

      <div onClick={onTweaks} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <AvatarMark theme={T} name="Hana El-Masry" size={34}/>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>Hana El-Masry</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>HR Director · {S.tenant}</div>
        </div>
        <HRIcon name="chevDown" size={14} stroke={T.textMuted}/>
      </div>
    </div>
  );
}

// ── KPI STRIP ───────────────────────────────────────────────────
function KpiStrip({ theme, S, density, chartStyle }) {
  const T = theme;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: DENSITY[density].gap }}>
      {HR_DATA.kpis.map((k, i) => (
        <Panel key={k.key} theme={T} density={density}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              {S[k.label]}
            </div>
            <Delta theme={T} value={k.delta} suffix={k.key === 'active' ? '%' : ''} invert={k.invert}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div className="display" style={{ fontSize: density === 'compact' ? 34 : 40, color: T.text, letterSpacing: -1, lineHeight: 1, fontWeight: 400 }}>
              {k.fmt ? k.fmt(k.value) : k.value}
              <span style={{ fontSize: 16, color: T.textMuted, marginInlineStart: 4 }}>{k.suffix}</span>
            </div>
            <Spark theme={T} values={k.spark} width={90} height={36} chartStyle={chartStyle}
              color={k.key === 'risk' || k.key === 'safety' ? T.danger : (k.key === 'index' ? T.positive : T.accent)}/>
          </div>
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8 }}>{S.vsPrior}</div>
        </Panel>
      ))}
    </div>
  );
}

// ── TRENDS CHART ────────────────────────────────────────────────
function TrendsCard({ theme, S, lang, chartStyle, density }) {
  const T = theme;
  const [active, setActive] = React.useState(new Set(['sleep', 'stress', 'energy', 'mood']));
  const series = HR_DATA.trends.series.map((s, i) => ({ ...s, color: T.series[i] }));
  const toggle = (k) => {
    const n = new Set(active); n.has(k) ? n.delete(k) : n.add(k); setActive(n);
  };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.wellbeingTrends} subtitle={`${S.vsPrior} · ${lang==='ar'?'الفترة السابقة':'prior 30d'}`}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            {series.map(s => (
              <button key={s.key} onClick={() => toggle(s.key)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 999,
                background: active.has(s.key) ? T.panelSunk : 'transparent',
                border: `1px solid ${active.has(s.key) ? T.border : 'transparent'}`,
                color: active.has(s.key) ? T.text : T.textFaint,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, opacity: active.has(s.key) ? 1 : 0.3 }}/>
                {S[s.key] || s.name}
              </button>
            ))}
          </div>
        }/>
      <div style={{ padding: '8px 12px 18px' }}>
        <TrendChart theme={T} series={series} labels={lang==='ar'?HR_DATA.trends.labelsAr:HR_DATA.trends.labels}
          height={260} chartStyle={chartStyle} activeKeys={[...active]}/>
      </div>
    </Panel>
  );
}

// ── AT-RISK TEAMS (right rail) ──────────────────────────────────
function AtRisk({ theme, S, lang, density, onOpenTeam }) {
  const T = theme;
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.atRiskTeams} subtitle={lang==='ar'?'بحاجة لاهتمام':'Needs attention'}
        right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{S.viewAll}</HRButton>}/>
      <div>
        {HR_DATA.atRisk.map((t, i) => (
          <div key={i} onClick={() => onOpenTeam(t)} style={{
            padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
            display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: i < HR_DATA.atRisk.length - 1 ? `1px solid ${T.divider}` : 'none',
            cursor: 'pointer',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t.team}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{t.reason[lang]} · {t.size} {lang==='ar'?'أعضاء':'members'}</div>
            </div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{t.index}</div>
            <Badge theme={T} tone={t.risk === 'high' ? 'danger' : 'caution'} dot>
              {t.risk === 'high' ? S.high : S.med}
            </Badge>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── TEAM BREAKDOWN TABLE ────────────────────────────────────────
function TeamTable({ theme, S, lang, density, chartStyle, onOpenTeam }) {
  const T = theme;
  const d = DENSITY[density];
  const [filter, setFilter] = React.useState('all');
  const [sort, setSort] = React.useState('index');
  const depts = ['all', ...Array.from(new Set(HR_DATA.teams.map(t => t.dept)))];
  const filtered = HR_DATA.teams.filter(t => filter === 'all' || t.dept === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'index') return a.index - b.index;
    if (sort === 'size')  return b.size - a.size;
    if (sort === 'trend') return a.trend - b.trend;
    return 0;
  });
  const riskTone = { low: 'positive', med: 'caution', high: 'danger' };
  const riskLabel = { low: S.low, med: S.med, high: S.high };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.teamBreakdown} subtitle={`${filtered.length} ${lang==='ar'?'فرق':'teams'}`}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={{
              height: 32, padding: '0 10px', borderRadius: 8,
              background: T.panelSunk, border: `1px solid ${T.border}`,
              color: T.text, fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer',
            }}>
              {depts.map(dp => <option key={dp} value={dp}>{dp === 'all' ? S.filterAll : dp}</option>)}
            </select>
            <HRButton theme={T} variant="secondary" size="sm" icon="filter"/>
          </div>
        }/>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
              {[
                { key: 'team', label: S.team, align: 'start' },
                { key: 'head', label: S.head, align: 'start' },
                { key: 'size', label: S.size, align: 'end',   sortable: true },
                { key: 'sleep', label: S.sleep, align: 'center' },
                { key: 'stress', label: S.stress, align: 'center' },
                { key: 'energy', label: S.energy, align: 'center' },
                { key: 'mood', label: S.mood, align: 'center' },
                { key: 'index', label: S.index, align: 'end', sortable: true },
                { key: 'trend', label: S.trend, align: 'end',  sortable: true },
                { key: 'risk', label: S.risk, align: 'end' },
              ].map(h => (
                <th key={h.key} onClick={() => h.sortable && setSort(h.key)} style={{
                  fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase',
                  color: sort === h.key ? T.text : T.textMuted, fontWeight: 700,
                  textAlign: h.align, padding: `10px ${d.cardPad}px 10px`,
                  cursor: h.sortable ? 'pointer' : 'default',
                  position: 'sticky', top: 0, background: T.panel,
                }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={i} onClick={() => onOpenTeam(t)} style={{
                borderBottom: `1px solid ${T.divider}`, cursor: 'pointer',
              }}
                  onMouseEnter={e => e.currentTarget.style.background = T.panelAlt}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, fontSize: 13, color: T.text, fontWeight: 600 }}>
                  {t.team}
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400, marginTop: 2 }}>{t.dept}</div>
                </td>
                <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AvatarMark theme={T} name={t.head} size={26}/>
                    <span style={{ color: T.textMid, fontSize: 12 }}>{t.head}</span>
                  </div>
                </td>
                <td className="mono" style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end', color: T.textMid, fontSize: 12 }}>{t.size}</td>
                {['sleep','stress','energy','mood'].map(m => (
                  <td key={m} style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span className="mono" style={{ fontSize: 11, color: T.textMid, fontWeight: 600 }}>{t[m].toFixed(1)}</span>
                      <div style={{ width: 58 }}><Bullet theme={T} value={t[m]} max={10}
                        color={t[m] >= 6.5 ? T.positive : t[m] >= 5 ? T.caution : T.danger}/></div>
                    </div>
                  </td>
                ))}
                <td className="mono" style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end', fontSize: 14, color: T.text, fontWeight: 700 }}>{t.index}</td>
                <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end' }}>
                  <Delta theme={T} value={t.trend}/>
                </td>
                <td style={{ padding: `${d.cellPadY}px ${d.cardPad}px`, textAlign: 'end' }}>
                  <Badge theme={T} tone={riskTone[t.risk]} dot>{riskLabel[t.risk]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── SAFETY QUEUE ────────────────────────────────────────────────
function SafetyQueue({ theme, S, lang, density }) {
  const T = theme;
  const sevTone = { high: 'danger', med: 'caution', low: 'info' };
  const sevLabel = { high: S.high, med: S.med, low: S.low };
  const statusLabel = { open: S.open, review: S.review, resolved: S.resolved };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.safetyQueue} subtitle={`${HR_DATA.safety.filter(s=>s.status!=='resolved').length} ${lang==='ar'?'مفتوحة':'open'}`}
        right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{S.viewAll}</HRButton>}/>
      <div>
        {HR_DATA.safety.map((s, i) => (
          <div key={s.id} style={{
            padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
            borderBottom: i < HR_DATA.safety.length - 1 ? `1px solid ${T.divider}` : 'none',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: s.severity === 'high' ? (T.isDark ? 'rgba(226,127,106,0.15)' : 'rgba(162,67,43,0.10)') : (T.isDark ? 'rgba(245,181,68,0.15)' : 'rgba(180,134,31,0.10)'),
              color: s.severity === 'high' ? T.danger : T.caution,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><HRIcon name="flag" size={16}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span className="mono" style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{s.id}</span>
                <Badge theme={T} tone={sevTone[s.severity]} dot>{sevLabel[s.severity]}</Badge>
                <Badge theme={T} tone="neutral">{statusLabel[s.status]}</Badge>
                <span style={{ fontSize: 11, color: T.textFaint, marginInlineStart: 'auto' }}>{s.opened}</span>
              </div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.4 }}>{s.note[lang]}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{s.who}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── BROADCASTS ──────────────────────────────────────────────────
function Broadcasts({ theme, S, lang, density }) {
  const T = theme;
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.activeBroadcasts} subtitle={lang==='ar'?'حملات نشطة':'Last 30 days'}
        right={<HRButton theme={T} size="sm" icon="plus">{S.draftPost}</HRButton>}/>
      <div>
        {HR_DATA.broadcasts.map((b, i) => (
          <div key={b.id} style={{
            padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
            borderBottom: i < HR_DATA.broadcasts.length - 1 ? `1px solid ${T.divider}` : 'none',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{b.title[lang]}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{b.segment[lang]} · {b.sent}</div>
            </div>
            <div style={{ textAlign: 'end' }}>
              <div className="mono" style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{b.opens}</div>
              <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>{lang==='ar'?'معدل الفتح':'open rate'}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── CONTENT + CHALLENGES ────────────────────────────────────────
function ContentPins({ theme, S, lang, density }) {
  const T = theme;
  const iconFor = { audio: 'headphones', video: 'play', article: 'book' };
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.contentPins} subtitle={lang==='ar'?'محتوى مختار':'Curated for all staff'}
        right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{S.viewAll}</HRButton>}/>
      <div style={{ padding: `${DENSITY[density].cardPad - 4}px ${DENSITY[density].cardPad}px`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {HR_DATA.content.map((c, i) => (
          <div key={i} style={{
            background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 12,
            padding: 14, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, marginBottom: 10,
              background: T.accentSoft, color: T.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><HRIcon name={iconFor[c.kind]} size={16}/></div>
            <div style={{ fontSize: 12, color: T.text, fontWeight: 600, lineHeight: 1.35, marginBottom: 6 }}>{c.title[lang]}</div>
            <div style={{ fontSize: 11, color: T.textMuted, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{c.kind}</span>
              · {c.mins} {lang==='ar'?'د':'min'}
              {c.pinned && <Badge theme={T} tone="caution" style={{ marginInlineStart: 'auto' }}>{lang==='ar'?'مثبَّت':'Pinned'}</Badge>}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ChallengesCard({ theme, S, lang, density }) {
  const T = theme;
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.activeChallenges} subtitle={`${HR_DATA.challenges.length} ${lang==='ar'?'نشطة':'running'}`}
        right={<HRButton theme={T} size="sm" icon="plus">{S.newChallenge}</HRButton>}/>
      <div>
        {HR_DATA.challenges.map((c, i) => (
          <div key={i} style={{
            padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
            borderBottom: i < HR_DATA.challenges.length - 1 ? `1px solid ${T.divider}` : 'none',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: T.warmSoft, color: T.warm, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><HRIcon name="challenges" size={18}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{c.title[lang]}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{c.target} · {c.end}</div>
            </div>
            <div className="mono" style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{c.joined}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── PEOPLE YOU MANAGE ───────────────────────────────────────────
function PeopleYouManage({ theme, S, lang, density }) {
  const T = theme;
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.peopleYouManage}
        subtitle={lang==='ar'?'أشخاص مسؤول عنهم مباشرةً':'Direct reports (permission scope)'}
        right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{S.viewAll}</HRButton>}/>
      <div>
        {HR_DATA.people.map((p, i) => {
          const tone = p.index >= 6.5 ? 'positive' : p.index >= 5 ? 'caution' : 'danger';
          return (
            <div key={i} style={{
              padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
              borderBottom: i < HR_DATA.people.length - 1 ? `1px solid ${T.divider}` : 'none',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <AvatarMark theme={T} name={p.name} size={36}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{p.name}</span>
                  {p.flag && <Badge theme={T} tone="danger" dot>{lang==='ar'?'تنبيه':'Flagged'}</Badge>}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{p.role} · {p.team}</div>
              </div>
              <div style={{ textAlign: 'end', minWidth: 60 }}>
                <div className="mono" style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{p.index}</div>
                <Delta theme={T} value={p.trend}/>
              </div>
              <Badge theme={T} tone={tone} dot>{lang==='ar' ? (p.index>=6.5?S.low:p.index>=5?S.med:S.high) : (p.index>=6.5?'Stable':p.index>=5?'Watch':'At risk')}</Badge>
              <HRButton theme={T} variant="ghost" size="sm" icon="more"/>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

Object.assign(window, {
  HR_DATA, Sidebar, TopBar, KpiStrip, TrendsCard, AtRisk, TeamTable,
  SafetyQueue, Broadcasts, ContentPins, ChallengesCard, PeopleYouManage,
});
// --- hr-views.jsx ---
// HR Portal — section pages: page-level layouts for each sidebar nav item.

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

// ── TEAMS PAGE ───────────────────────────────────────────────────
function HRTeamsPage({ theme, S, lang, density, chartStyle, onOpenTeam }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [riskFilter, setRiskFilter] = React.useState('all');
  const [deptFilter, setDeptFilter] = React.useState('all');
  const depts = Array.from(new Set(HR_DATA.teams.map(t => t.dept)));
  const filtered = HR_DATA.teams.filter(t =>
    (riskFilter === 'all' || t.risk === riskFilter) &&
    (deptFilter === 'all' || t.dept === deptFilter)
  );
  const counts = {
    high: HR_DATA.teams.filter(t=>t.risk==='high').length,
    med:  HR_DATA.teams.filter(t=>t.risk==='med').length,
    low:  HR_DATA.teams.filter(t=>t.risk==='low').length,
  };
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('All teams','كل الفرق')}
        title={s('Teams','الفرق')}
        sub={`${HR_DATA.teams.length} ${s('teams · ',`فرق · `)}${HR_DATA.teams.reduce((s,t)=>s+t.size,0)} ${s('people in scope','شخص في النطاق')}`}
        right={<><HRButton theme={T} variant="secondary" icon="reports">{s('Export','تصدير')}</HRButton></>}/>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{s('Total teams','إجمالي الفرق')}</div>
          <div className="display" style={{ fontSize: 30, color: T.text, letterSpacing: -0.6 }}>{HR_DATA.teams.length}</div>
        </Panel>
        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.danger, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{s('High risk','مخاطر مرتفعة')}</div>
          <div className="display" style={{ fontSize: 30, color: T.text, letterSpacing: -0.6 }}>{counts.high}</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{s('Need intervention','تحتاج تدخل')}</div>
        </Panel>
        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.caution, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{s('Watchlist','قائمة المراقبة')}</div>
          <div className="display" style={{ fontSize: 30, color: T.text, letterSpacing: -0.6 }}>{counts.med}</div>
        </Panel>
        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.positive, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{s('Stable','مستقر')}</div>
          <div className="display" style={{ fontSize: 30, color: T.text, letterSpacing: -0.6 }}>{counts.low}</div>
        </Panel>
      </div>

      <Panel theme={T} density={density} pad={false}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s('Filter','تصفية')}</div>
          <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}` }}>
            {[['all',s('All','الكل')],['high',s('High','مرتفع')],['med',s('Med','متوسط')],['low',s('Low','منخفض')]].map(([k,l])=>(
              <button key={k} onClick={() => setRiskFilter(k)} style={{
                padding: '6px 12px', borderRadius: 6, border: 'none',
                background: riskFilter===k ? T.panel : 'transparent',
                color: riskFilter===k ? T.text : T.textMuted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
          <select value={deptFilter} onChange={(e)=>setDeptFilter(e.target.value)} style={{
            padding: '7px 10px', background: T.panelSunk, border: `1px solid ${T.border}`,
            borderRadius: 8, color: T.text, fontSize: 12, fontFamily: 'inherit',
          }}>
            <option value="all">{s('All depts','كل الأقسام')}</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <div style={{ flex: 1 }}/>
          <div style={{ fontSize: 11, color: T.textMuted }}>{filtered.length} {s('shown','معروض')}</div>
        </div>
        <div>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 0.7fr 1.2fr 1fr 36px',
            padding: `12px 18px`, gap: 10,
            fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: 0.6, textTransform: 'uppercase',
            borderBottom: `1px solid ${T.divider}`, background: T.panelSunk,
          }}>
            <div>{S.team}</div><div>{S.head}</div>
            <div style={{ textAlign:'end' }}>{S.size}</div>
            <div style={{ textAlign:'end' }}>{S.index}</div>
            <div>{s('30-day trend','اتجاه ٣٠ يوم')}</div>
            <div>{S.risk}</div><div></div>
          </div>
          {filtered.map((t, i) => {
            const tone = t.risk === 'high' ? 'danger' : t.risk === 'med' ? 'caution' : 'positive';
            const label = t.risk === 'high' ? S.high : t.risk === 'med' ? S.med : S.low;
            const sparkColor = t.risk === 'high' ? T.danger : t.risk === 'med' ? T.caution : T.positive;
            // synth a 14pt trend from index value
            const trend = Array.from({length: 14}, (_, k) => t.index + (Math.sin(k*0.6 + i)*0.4) + (t.trend * (k/14)));
            return (
              <div key={i} onClick={() => onOpenTeam && onOpenTeam(t)} style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 0.7fr 1.2fr 1fr 36px',
                padding: `${DENSITY[density].cellPadY + 4}px 18px`, gap: 10,
                alignItems: 'center', cursor: 'pointer',
                borderBottom: i < filtered.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.panelSunk}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.team}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{t.dept}</div>
                </div>
                <div style={{ fontSize: 12, color: T.textMid }}>{t.head}</div>
                <div className="mono" style={{ textAlign: 'end', fontSize: 13, color: T.text }}>{t.size}</div>
                <div className="mono" style={{ textAlign: 'end', fontSize: 14, color: T.text, fontWeight: 700 }}>{t.index}</div>
                <div><Spark theme={T} values={trend} width={140} height={32} chartStyle={chartStyle === 'bar' ? 'bar' : (chartStyle || 'area')} color={sparkColor}/></div>
                <div><Badge theme={T} tone={tone} dot>{label}</Badge></div>
                <button style={{ background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer', padding: 6 }} onClick={(e)=>e.stopPropagation()}>
                  <HRIcon name="chev" size={14}/>
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

// ── PEOPLE PAGE ──────────────────────────────────────────────────
function HRPeoplePage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  // expand HR_DATA.people with extras
  const allPeople = [
    ...HR_DATA.people,
    { name: 'Yara Adel',     role: 'Sr. Engineer',   team: 'Engineering — Mobile',         index: 6.7, trend: 0.0,  last: 'Today', flag: false },
    { name: 'Hesham Lotfy',  role: 'Ops Coordinator',team: 'Logistics — Night shift',      index: 5.0, trend: -0.5, last: '1d ago', flag: true },
    { name: 'Maya Khalil',   role: 'CS Specialist',  team: 'Customer Ops — Tier 1',        index: 6.2, trend: 0.1,  last: 'Today', flag: false },
    { name: 'Adam Rahim',    role: 'AP Clerk',       team: 'Finance — Accounts Payable',   index: 4.5, trend: -0.7, last: '3d ago', flag: true },
    { name: 'Salma Bakir',   role: 'People Partner', team: 'People & Culture',             index: 7.6, trend: 0.3,  last: 'Today', flag: false },
    { name: 'Karim Othman',  role: 'Driver Lead',    team: 'Logistics — Day',              index: 6.5, trend: 0.0,  last: '1d ago', flag: false },
  ];
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const filtered = allPeople.filter(p =>
    (filter === 'all' || (filter === 'flagged' && p.flag) || (filter === 'risk' && p.index < 5.5)) &&
    (search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.team.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Direct reports','تقارير مباشرة')}
        title={s('People','الأشخاص')}
        sub={s('Aggregate-only view · names visible only when consent + role allows','عرض مجمع فقط · الأسماء ظاهرة عند الموافقة')}
        right={<HRButton theme={T} variant="secondary" icon="content">{s('Export consented','تصدير المسموح')}</HRButton>}/>

      <Panel theme={T} density={density} pad={false}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, height: 36, background: T.panelSunk, borderRadius: 9, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
            <HRIcon name="search" size={15} stroke={T.textMuted}/>
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={s('Search people or teams…','ابحث عن أشخاص أو فرق…')}
              style={{ flex: 1, background: 'transparent', border: 'none', color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}/>
          </div>
          <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}` }}>
            {[['all',s('All','الكل')],['flagged',s('Flagged','مُعلَّم')],['risk',s('At risk','في خطر')]].map(([k,l])=>(
              <button key={k} onClick={()=>setFilter(k)} style={{
                padding: '6px 12px', borderRadius: 6, border: 'none',
                background: filter===k ? T.panel : 'transparent',
                color: filter===k ? T.text : T.textMuted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          {filtered.map((p, i) => {
            const tone = p.index >= 6.5 ? 'positive' : p.index >= 5 ? 'caution' : 'danger';
            const label = lang==='ar' ? (p.index>=6.5?S.low:p.index>=5?S.med:S.high) : (p.index>=6.5?'Stable':p.index>=5?'Watch':'At risk');
            return (
              <div key={i} style={{
                padding: `${DENSITY[density].cellPadY + 4}px 18px`,
                borderBottom: i < filtered.length - 1 ? `1px solid ${T.divider}` : 'none',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <AvatarMark theme={T} name={p.name} size={40}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{p.name}</span>
                    {p.flag && <Badge theme={T} tone="danger" dot>{lang==='ar'?'تنبيه':'Flagged'}</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{p.role} · {p.team}</div>
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, minWidth: 80 }}>{s('Last check-in','آخر فحص')}<br/><span style={{ color: T.textMid, fontWeight: 600, fontSize: 12 }}>{p.last}</span></div>
                <div style={{ textAlign: 'end', minWidth: 70 }}>
                  <div className="mono" style={{ fontSize: 16, color: T.text, fontWeight: 700 }}>{p.index}</div>
                  <Delta theme={T} value={p.trend}/>
                </div>
                <Badge theme={T} tone={tone} dot>{label}</Badge>
                <HRButton theme={T} variant="ghost" size="sm" icon="more"/>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

// ── SAFETY PAGE ──────────────────────────────────────────────────
function HRSafetyPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const sevTone = { high: 'danger', med: 'caution', low: 'info' };
  const [tab, setTab] = React.useState('open');
  const items = HR_DATA.safety.filter(i => tab === 'all' || i.status === (tab === 'open' ? 'open' : 'review'));
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Safety queue','قائمة السلامة')}
        title={s('Escalations','التصعيدات')}
        sub={s('Anonymous self-reports + algorithmic flags · responses logged for compliance','تقارير ذاتية مجهولة + إشارات خوارزمية')}
        right={<HRButton theme={T} variant="secondary" icon="settings">{s('Routing rules','قواعد التوجيه')}</HRButton>}/>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        {[
          { l: s('Open','مفتوح'), v: HR_DATA.safety.filter(i=>i.status==='open').length, c: T.danger },
          { l: s('Under review','قيد المراجعة'), v: HR_DATA.safety.filter(i=>i.status==='review').length, c: T.caution },
          { l: s('Resolved this month','مُغلق هذا الشهر'), v: 12, c: T.positive },
          { l: s('Avg response time','متوسط الرد'), v: '2.4h', c: T.text },
        ].map((k,i)=>(
          <Panel key={i} theme={T} density={density}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{k.l}</div>
            <div className="display" style={{ fontSize: 30, color: k.c, letterSpacing: -0.6, lineHeight: 1 }}>{k.v}</div>
          </Panel>
        ))}
      </div>

      <Panel theme={T} density={density} pad={false}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.divider}`, display: 'flex', gap: 4 }}>
          {[['open',s('Open','مفتوح')],['review',s('Under review','قيد المراجعة')],['all',s('All','الكل')]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: tab===k ? T.panelSunk : 'transparent',
              color: tab===k ? T.text : T.textMuted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>
        <div>
          {items.map((it, i) => (
            <div key={it.id} style={{
              padding: '16px 18px',
              borderBottom: i < items.length - 1 ? `1px solid ${T.divider}` : 'none',
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: T.panelSunk, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <HRIcon name="safety" size={18} stroke={it.severity === 'high' ? T.danger : T.caution}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{it.id}</span>
                  <Badge theme={T} tone={sevTone[it.severity]} dot>{it.severity === 'high' ? S.high : it.severity === 'med' ? S.med : S.low}</Badge>
                  <span style={{ fontSize: 11, color: T.textMuted }}>· {it.opened}</span>
                </div>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600, marginBottom: 4 }}>{it.who}</div>
                <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.5 }}>{it.note[lang] || it.note.en}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <HRButton theme={T} variant="secondary" size="sm">{s('Acknowledge','استلام')}</HRButton>
                <HRButton theme={T} variant="primary" size="sm">{s('Reach out','تواصل')}</HRButton>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

// ── CONTENT PAGE ─────────────────────────────────────────────────
function HRContentPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [tab, setTab] = React.useState('library');
  const library = [
    { kind:'audio',   title: s('Sleep onset — a cue for tonight','بداية النوم — إشارة لهذه الليلة'), mins: 6,  cat: s('Sleep','النوم'),    plays: 1240, pinned: true },
    { kind:'video',   title: s('Desk mobility flow','حركات مكتبية'),                                 mins: 4,  cat: s('Movement','حركة'),  plays: 980,  pinned: true },
    { kind:'article', title: s('Build an evening wind-down','بناء روتين استرخاء مسائي'),             mins: 5,  cat: s('Sleep','النوم'),    plays: 612,  pinned: false },
    { kind:'audio',   title: s('Box breathing — 4×4','تنفس الصندوق — ٤×٤'),                          mins: 5,  cat: s('Stress','توتر'),    plays: 1830, pinned: true },
    { kind:'video',   title: s('Stretch break','استراحة تمدد'),                                       mins: 3,  cat: s('Movement','حركة'),  plays: 770,  pinned: false },
    { kind:'audio',   title: s('Body scan for tension release','مسح الجسم لإطلاق التوتر'),           mins: 12, cat: s('Stress','توتر'),    plays: 540,  pinned: false },
    { kind:'article', title: s('Caffeine, sleep, and you','الكافيين والنوم'),                        mins: 7,  cat: s('Sleep','النوم'),    plays: 322,  pinned: false },
    { kind:'video',   title: s('Mood lift: 4-min walk','رفع المزاج: مشي ٤ دقائق'),                   mins: 4,  cat: s('Movement','حركة'),  plays: 612,  pinned: false },
    { kind:'audio',   title: s('Gratitude pause','وقفة الامتنان'),                                    mins: 3,  cat: s('Mood','مزاج'),     plays: 884,  pinned: false },
  ];
  const iconFor = { audio: 'headphones', video: 'play', article: 'book' };
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Content library','مكتبة المحتوى')}
        title={s('Content','المحتوى')}
        sub={s('Pin items to your org · 124 items in library · 3 languages','تثبيت العناصر · ١٢٤ عنصر · ٣ لغات')}
        right={<><HRButton theme={T} variant="secondary" icon="content">{s('Request item','طلب محتوى')}</HRButton><HRButton theme={T} variant="primary" icon="plus">{s('Pin to org','تثبيت')}</HRButton></>}/>

      <div style={{ display: 'flex', gap: 4, marginBottom: DENSITY[density].gap, background: T.panelSunk, padding: 4, borderRadius: 10, border: `1px solid ${T.border}`, width: 'fit-content' }}>
        {[['library',s('All library','كل المكتبة')],['pinned',s('Pinned','مثبَّت')],['perf',s('Performance','الأداء')]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{
            padding: '8px 16px', borderRadius: 7, border: 'none',
            background: tab===k ? T.panel : 'transparent',
            color: tab===k ? T.text : T.textMuted,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: DENSITY[density].gap }}>
        {library.filter(c => tab !== 'pinned' || c.pinned).map((c, i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: T.panelSunk, display: 'grid', placeItems: 'center' }}>
                <HRIcon name={iconFor[c.kind]} size={22} stroke={T.accent}/>
              </div>
              {c.pinned && <Badge theme={T} tone="info" dot>{s('Pinned','مثبَّت')}</Badge>}
            </div>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, lineHeight: 1.35, marginBottom: 6 }}>{c.title}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{c.cat} · {c.mins} {s('min','د')}</div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>{s('Plays · 30d','تشغيل · ٣٠ يوم')}</div>
                <div className="mono" style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{c.plays.toLocaleString()}</div>
              </div>
              <HRButton theme={T} variant="ghost" size="sm" icon="more"/>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

// ── CHALLENGES PAGE ──────────────────────────────────────────────
function HRChallengesPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const active = [
    { title: s('Move April','تحرَّك أبريل'),         desc: s('150k steps · team total','١٥٠ ألف خطوة · إجمالي الفريق'), joined: 412, total: 487, end: s('8 days left','٨ أيام'), kind: s('movement','حركة'), progress: 64 },
    { title: s('Lights out by 11','النوم قبل الـ١١'), desc: s('21-day individual streak','تتابع فردي ٢١ يوم'),         joined: 287, total: 487, end: s('14 days left','١٤ يوم'), kind: s('sleep','نوم'),    progress: 38 },
    { title: s('3-min reset daily','استراحة ٣ دقائق يوميًا'), desc: s('30-day team check-in','فحص فريق ٣٠ يوم'),         joined: 198, total: 487, end: s('20 days left','٢٠ يوم'), kind: s('mood','مزاج'),     progress: 22 },
  ];
  const drafts = [
    { title: s('Hydration: 8 cups','الترطيب: ٨ أكواب'), kind: s('movement','حركة'), updated: s('2h ago','قبل ساعتين') },
    { title: s('Walking 1:1s','مشي ١:١'),               kind: s('movement','حركة'), updated: s('Yesterday','أمس') },
  ];
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Active + drafts','نشطة + مسودات')}
        title={s('Challenges','التحديات')}
        sub={s('Behavior change campaigns · pull from template library or build your own','حملات تغيير السلوك')}
        right={<><HRButton theme={T} variant="secondary" icon="challenges">{s('From template','من قالب')}</HRButton><HRButton theme={T} variant="primary" icon="plus">{S.newChallenge}</HRButton></>}/>

      <div style={{ marginBottom: 12, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s('Active','نشطة')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        {active.map((c, i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <Badge theme={T} tone="neutral">{c.kind}</Badge>
              <span style={{ fontSize: 11, color: T.textMuted }}>{c.end}</span>
            </div>
            <div style={{ fontSize: 17, color: T.text, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 18 }}>{c.desc}</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, marginBottom: 6 }}>
                <span>{s('Progress','التقدم')}</span>
                <span className="mono" style={{ color: T.text, fontWeight: 600 }}>{c.progress}%</span>
              </div>
              <div style={{ height: 6, background: T.panelSunk, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${c.progress}%`, height: '100%', background: T.accent, borderRadius: 3 }}/>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.divider}` }}>
              <div>
                <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>{s('Participation','المشاركة')}</div>
                <div className="mono" style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{c.joined}/{c.total}</div>
              </div>
              <HRButton theme={T} variant="ghost" size="sm">{s('Manage','إدارة')}</HRButton>
            </div>
          </Panel>
        ))}
      </div>

      <div style={{ marginBottom: 12, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s('Drafts','مسودات')}</div>
      <Panel theme={T} density={density} pad={false}>
        {drafts.map((d, i) => (
          <div key={i} style={{
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
            borderBottom: i < drafts.length - 1 ? `1px solid ${T.divider}` : 'none',
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: T.panelSunk, display: 'grid', placeItems: 'center' }}>
              <HRIcon name="challenges" size={18} stroke={T.textMuted}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{d.title}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{d.kind} · {s('Updated','تحديث')} {d.updated}</div>
            </div>
            <HRButton theme={T} variant="secondary" size="sm">{s('Resume','استئناف')}</HRButton>
          </div>
        ))}
      </Panel>
    </>
  );
}

// ── BROADCASTS PAGE ──────────────────────────────────────────────
function HRBroadcastsPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [draft, setDraft] = React.useState(s('Reach out — Support Tier 2','تواصل — دعم المستوى ٢'));
  const [body, setBody] = React.useState(s("We've noticed elevated stress signals in your team this week. Here's a 3-min reset to try together. Not mandatory.",'لاحظنا إشارات توتر مرتفعة في فريقكم هذا الأسبوع. إليكم استراحة ٣ دقائق للتجربة معًا.'));
  const [segment, setSegment] = React.useState('team');
  const history = [
    { title: s('Ramadan wind-down tips','نصائح الاسترخاء الرمضانية'), segment: s('All staff · 487','كل الموظفين · ٤٨٧'), opens: 78, sent: s('Mon · 09:00','الإثنين · ٠٩:٠٠') },
    { title: s('Mindfulness week starts Monday','أسبوع اليقظة يبدأ الإثنين'), segment: s('Egypt · all depts','مصر · كل الأقسام'), opens: 64, sent: 'Apr 15' },
    { title: s('Lunch break reminder','تذكير استراحة الغداء'),       segment: s('Tier 2 · 28','المستوى ٢ · ٢٨'), opens: 92, sent: 'Apr 12' },
    { title: s('Quarterly wellness review','مراجعة الرفاهية الفصلية'), segment: s('Managers · 34','المدراء · ٣٤'), opens: 55, sent: 'Apr 02' },
  ];
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Org communications','اتصالات المنظمة')}
        title={s('Broadcasts','البث')}
        sub={s('In-app nudges and announcements · respects quiet hours','تنبيهات داخل التطبيق · تحترم ساعات الهدوء')}/>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: DENSITY[density].gap }}>
        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>{s('Compose','إنشاء')}</div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Title','العنوان')}</div>
            <input value={draft} onChange={(e)=>setDraft(e.target.value)} style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
              color: T.text, fontSize: 14, fontFamily: 'inherit', outline: 'none',
            }}/>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Message','الرسالة')}</div>
            <textarea value={body} onChange={(e)=>setBody(e.target.value)} rows={5} style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
              color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5,
            }}/>
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 8 }}>{s('Audience','الجمهور')}</div>
            <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}`, width: 'fit-content' }}>
              {[['all',s('All staff','كل الموظفين')],['dept',s('A department','قسم')],['team',s('A team','فريق')]].map(([k,l])=>(
                <button key={k} onClick={()=>setSegment(k)} style={{
                  padding: '7px 12px', borderRadius: 7, border: 'none',
                  background: segment===k ? T.panel : 'transparent',
                  color: segment===k ? T.text : T.textMuted,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <HRButton theme={T} variant="secondary">{s('Save draft','حفظ مسودة')}</HRButton>
            <HRButton theme={T} variant="secondary" icon="calendar">{s('Schedule','جدولة')}</HRButton>
            <div style={{ flex: 1 }}/>
            <HRButton theme={T} variant="primary" icon="broadcasts">{s('Send now','أرسل الآن')}</HRButton>
          </div>
        </Panel>

        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>{s('Preview · in-app','معاينة · داخل التطبيق')}</div>
          <div style={{ background: '#0E2A26', borderRadius: 18, padding: 20, color: '#F5F1E8', minHeight: 200, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <img src="assets/wellness-mark.png" alt="" style={{ height: 16, filter: 'brightness(0) invert(1)' }}/>
              <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 600, letterSpacing: 0.3 }}>WELLNESS+ · {s('From your HR team','من فريق الموارد البشرية')}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: -0.2 }}>{draft}</div>
            <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.55 }}>{body}</div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <span style={{ padding: '7px 12px', borderRadius: 8, background: '#F5B544', color: '#0E2A26', fontSize: 12, fontWeight: 700 }}>{s('Try it','جرّب')}</span>
              <span style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', color: '#F5F1E8', fontSize: 12, fontWeight: 600 }}>{s('Later','لاحقًا')}</span>
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: T.textMuted }}>
            {s('Estimated reach: ','تقدير الوصول: ')}
            <strong style={{ color: T.text }}>{segment === 'all' ? '487' : segment === 'dept' ? '~120' : '28'}</strong>
            {s(' · sent at next allowed hour (08:00–20:00)',' · يُرسل في الساعة المسموحة التالية (٠٨:٠٠–٢٠:٠٠)')}
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: DENSITY[density].gap, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 12 }}>{s('Sent recently','مُرسل حديثًا')}</div>
      <Panel theme={T} density={density} pad={false}>
        {history.map((h, i) => (
          <div key={i} style={{
            padding: '14px 18px', display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr 0.8fr', gap: 12, alignItems: 'center',
            borderBottom: i < history.length - 1 ? `1px solid ${T.divider}` : 'none',
          }}>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{h.title}</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>{h.segment}</div>
            <div>
              <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 700 }}>{s('Open rate','معدل الفتح')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{h.opens}%</span>
                <div style={{ flex: 1, height: 4, background: T.panelSunk, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${h.opens}%`, height: '100%', background: T.accent }}/>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: T.textMid, textAlign: 'end' }}>{h.sent}</div>
          </div>
        ))}
      </Panel>
    </>
  );
}

// ── REPORTS PAGE ─────────────────────────────────────────────────
function HRReportsPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const reports = [
    { title: s('Monthly wellbeing summary','ملخص الرفاهية الشهري'), desc: s('Aggregate index, deltas, top movers · 4 pages','مؤشر مجمع، تغييرات، أبرز التحركات · ٤ صفحات'), kind: 'PDF', cadence: s('Monthly · 1st','شهري · ١') },
    { title: s('Safety incident log','سجل حوادث السلامة'),         desc: s('Anonymized escalation timeline · CSV export','جدول التصعيدات مجهول · تصدير CSV'),         kind: 'CSV', cadence: s('Weekly','أسبوعي') },
    { title: s('Engagement by department','المشاركة حسب القسم'),    desc: s('DAU/WAU per dept · trend lines','نشاط يومي/أسبوعي حسب القسم · خطوط اتجاه'),                  kind: 'XLSX', cadence: s('Quarterly','فصلي') },
    { title: s('Challenge outcomes','نتائج التحديات'),              desc: s('Completion %, behavior change deltas','نسبة الإكمال، تغييرات السلوك'),                            kind: 'PDF', cadence: s('Per challenge','لكل تحدي') },
  ];
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Insights & exports','رؤى وتصدير')}
        title={s('Reports','التقارير')}
        sub={s('All reports use aggregate-only data. Min cohort = 5 people.','كل التقارير تستخدم بيانات مجمعة فقط. الحد الأدنى للعينة = ٥ أشخاص.')}
        right={<HRButton theme={T} variant="primary" icon="plus">{s('New custom report','تقرير مخصص')}</HRButton>}/>

      <div style={{ marginBottom: 12, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s('Standard reports','التقارير القياسية')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        {reports.map((r, i) => (
          <Panel key={i} theme={T} density={density}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: T.panelSunk, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <HRIcon name="reports" size={20} stroke={T.accent}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{r.title}</span>
                  <Badge theme={T} tone="neutral">{r.kind}</Badge>
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, lineHeight: 1.5 }}>{r.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: T.textFaint }}>{s('Schedule:','جدولة:')}</span>
                  <span style={{ fontSize: 12, color: T.textMid, fontWeight: 600 }}>{r.cadence}</span>
                  <div style={{ flex: 1 }}/>
                  <HRButton theme={T} variant="ghost" size="sm" icon="settings">{s('Configure','إعداد')}</HRButton>
                  <HRButton theme={T} variant="secondary" size="sm" icon="reports">{s('Generate','إنشاء')}</HRButton>
                </div>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <div style={{ marginBottom: 12, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s('Recent exports','تصديرات حديثة')}</div>
      <Panel theme={T} density={density} pad={false}>
        {[
          { name: s('Wellbeing summary · Mar 2026.pdf','ملخص الرفاهية · مارس ٢٠٢٦.pdf'), size: '342 KB', when: 'Apr 01' },
          { name: s('Safety log · week 17.csv','سجل السلامة · أسبوع ١٧.csv'),               size: '12 KB',  when: 'Apr 22' },
          { name: s('Engagement Q1.xlsx','المشاركة ر١.xlsx'),                                size: '88 KB',  when: 'Apr 04' },
        ].map((f, i) => (
          <div key={i} style={{
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
            borderBottom: i < 2 ? `1px solid ${T.divider}` : 'none',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: T.panelSunk, display: 'grid', placeItems: 'center' }}>
              <HRIcon name="content" size={16} stroke={T.textMuted}/>
            </div>
            <div style={{ flex: 1, fontSize: 13, color: T.text, fontWeight: 600 }}>{f.name}</div>
            <div className="mono" style={{ fontSize: 11, color: T.textMuted }}>{f.size}</div>
            <div style={{ fontSize: 12, color: T.textMid }}>{f.when}</div>
            <HRButton theme={T} variant="ghost" size="sm">{s('Download','تحميل')}</HRButton>
          </div>
        ))}
      </Panel>
    </>
  );
}

// ── SETTINGS PAGE ────────────────────────────────────────────────
function HRSettingsPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [quietHours, setQuietHours] = React.useState(true);
  const [aggregateOnly, setAggregateOnly] = React.useState(true);
  const [escalationMins, setEscalationMins] = React.useState(15);
  const [minCohort, setMinCohort] = React.useState(5);
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Workspace','مساحة العمل')}
        title={s('Settings','الإعدادات')}
        sub="Nile Group · workspace.nilegroup.com"/>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: DENSITY[density].gap }}>
        <Panel theme={T} density={density} pad={false}>
          {[
            { l: s('Privacy & data','الخصوصية والبيانات'), active: true },
            { l: s('Notifications','الإشعارات') },
            { l: s('Roles & permissions','الأدوار والأذونات') },
            { l: s('Integrations','التكاملات') },
            { l: s('Localization','الترجمة') },
            { l: s('Billing','الفوترة') },
            { l: s('Audit log','سجل التدقيق') },
          ].map((it, i) => (
            <div key={i} style={{
              padding: '12px 16px', borderBottom: `1px solid ${T.divider}`,
              fontSize: 13, fontWeight: it.active ? 700 : 500, cursor: 'pointer',
              color: it.active ? T.accent : T.textMid,
              borderInlineStart: it.active ? `3px solid ${T.accent}` : '3px solid transparent',
              background: it.active ? T.panelSunk : 'transparent',
            }}>{it.l}</div>
          ))}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: DENSITY[density].gap }}>
          <Panel theme={T} density={density}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 4 }}>{s('Aggregate-only enforcement','الإلزام بالتجميع فقط')}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>{s('No individual records visible to HR. Min cohort enforced for all reports.','لا يمكن للموارد البشرية رؤية السجلات الفردية. يتم فرض حد أدنى للعينة لكل التقارير.')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Toggle theme={T} value={aggregateOnly} onChange={setAggregateOnly}/>
              <span style={{ fontSize: 13, color: T.textMid }}>{aggregateOnly ? s('Enforced','مفعَّل') : s('Disabled','معطَّل')}</span>
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.divider}` }}>
              <div style={{ fontSize: 12, color: T.textMid, marginBottom: 8 }}>{s('Minimum cohort size','الحد الأدنى للعينة')}</div>
              <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}`, width: 'fit-content' }}>
                {[3, 5, 10, 20].map(n => (
                  <button key={n} onClick={()=>setMinCohort(n)} style={{
                    padding: '6px 14px', borderRadius: 7, border: 'none',
                    background: minCohort===n ? T.panel : 'transparent',
                    color: minCohort===n ? T.text : T.textMuted,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>{n}</button>
                ))}
              </div>
            </div>
          </Panel>

          <Panel theme={T} density={density}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 4 }}>{s('Quiet hours','ساعات الهدوء')}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>{s('Suppress broadcasts and nudges outside 08:00–20:00 local time.','منع البث والتنبيهات خارج ٠٨:٠٠–٢٠:٠٠ بالتوقيت المحلي.')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Toggle theme={T} value={quietHours} onChange={setQuietHours}/>
              <span style={{ fontSize: 13, color: T.textMid }}>{quietHours ? s('On · 08:00–20:00','مفعَّل · ٠٨:٠٠–٢٠:٠٠') : s('Off','معطَّل')}</span>
            </div>
          </Panel>

          <Panel theme={T} density={density}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 4 }}>{s('Safety escalation','تصعيد السلامة')}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>{s('Auto-page on-call counsellor when high-severity flag is unacknowledged.','إخطار المستشار المناوب تلقائيًا عند عدم استلام إشارة عالية الخطورة.')}</div>
            <div style={{ fontSize: 12, color: T.textMid, marginBottom: 8 }}>{s('Escalate after','التصعيد بعد')}</div>
            <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}`, width: 'fit-content' }}>
              {[5, 15, 30, 60].map(n => (
                <button key={n} onClick={()=>setEscalationMins(n)} style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none',
                  background: escalationMins===n ? T.panel : 'transparent',
                  color: escalationMins===n ? T.text : T.textMuted,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>{n} {s('min','د')}</button>
              ))}
            </div>
          </Panel>

          <Panel theme={T} density={density}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 4 }}>{s('Data retention','الاحتفاظ بالبيانات')}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>{s('Individual check-ins are kept for 90 days then aggregated. Aggregates retained 24 months.','تُحفظ الفحوصات الفردية ٩٠ يومًا ثم تُجمَّع. تُحفظ المجاميع ٢٤ شهرًا.')}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <HRButton theme={T} variant="secondary">{s('View policy','عرض السياسة')}</HRButton>
              <HRButton theme={T} variant="ghost">{s('Request export','طلب تصدير')}</HRButton>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  HRPageHeader, HRTeamsPage, HRPeoplePage, HRSafetyPage,
  HRContentPage, HRChallengesPage, HRBroadcastsPage, HRReportsPage, HRSettingsPage,
});
// --- hr-app.jsx ---
// HR Portal — App shell: assembles sidebar + topbar + dashboard, handles Tweaks.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "lang": "en",
  "density": "comfortable",
  "layout": "default",
  "chartStyle": "line"
}/*EDITMODE-END*/;

function TeamDrawer({ theme, team, onClose, S, lang, chartStyle }) {
  const T = theme;
  if (!team) return null;
  // fabricate a 30-day mini-trend for the team
  const trend = [6.4, 6.2, 6.0, 5.9, 5.8, 5.7, 5.6, 5.7, 5.6, 5.5, 5.4, 5.3, 5.2, 5.2, 5.1, 5.0, 5.0, 4.9, 4.8, 4.9, 4.8, 4.7, 4.6, 4.6, 4.7, 4.6, 4.5, 4.5, 4.6, 4.6];
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.36)', zIndex: 50,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: '92vw', height: '100vh', background: T.panel,
        borderInlineStart: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column',
        animation: 'drawerIn .25s ease both',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{team.dept || 'Team'}</div>
            <div style={{ fontSize: 18, color: T.text, fontWeight: 700, letterSpacing: -0.2, marginTop: 2 }}>{team.team}</div>
          </div>
          <HRButton theme={T} variant="secondary" size="sm">{S.message}</HRButton>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: T.textMid, cursor: 'pointer' }}>
            <HRIcon name="close" size={18}/>
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
            <Panel theme={T} density="compact">
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{S.index}</div>
              <div className="display" style={{ fontSize: 32, color: T.text, letterSpacing: -0.8, marginTop: 4 }}>{team.index}</div>
              <Delta theme={T} value={team.trend}/>
            </Panel>
            <Panel theme={T} density="compact">
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{S.size}</div>
              <div className="display" style={{ fontSize: 32, color: T.text, letterSpacing: -0.8, marginTop: 4 }}>{team.size || '—'}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{team.head}</div>
            </Panel>
            <Panel theme={T} density="compact">
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{S.risk}</div>
              <div style={{ marginTop: 8 }}>
                <Badge theme={T} tone={team.risk === 'high' ? 'danger' : team.risk === 'med' ? 'caution' : 'positive'} dot>
                  {team.risk === 'high' ? S.high : team.risk === 'med' ? S.med : S.low}
                </Badge>
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10 }}>
                {(team.reason && team.reason[lang]) || (lang==='ar'?'تتبع الاتجاه':'Watchlist')}
              </div>
            </Panel>
          </div>

          <Panel theme={T} density="comfortable" pad={false} style={{ marginBottom: 18 }}>
            <PanelHeader theme={T} density="comfortable" title={lang==='ar'?'مؤشر الرفاهية · 30 يوماً':'Wellbeing index · 30 days'}/>
            <div style={{ padding: 16 }}>
              <Spark theme={T} values={trend} width={500} height={90} chartStyle={chartStyle === 'bar' ? 'bar' : 'area'} color={T.danger} showDots={false}/>
            </div>
          </Panel>

          {team.sleep !== undefined && (
            <Panel theme={T} density="comfortable" style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 12 }}>
                {lang==='ar'?'تفصيل المقاييس':'Metric breakdown'}
              </div>
              {[['sleep', S.sleep, team.sleep], ['stress', S.stress, team.stress], ['energy', S.energy, team.energy], ['mood', S.mood, team.mood]].map(([k, l, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0' }}>
                  <div style={{ width: 78, fontSize: 12, color: T.textMid, fontWeight: 600 }}>{l}</div>
                  <div style={{ flex: 1 }}>
                    <Bullet theme={T} value={v} max={10}
                      color={v >= 6.5 ? T.positive : v >= 5 ? T.caution : T.danger}/>
                  </div>
                  <div className="mono" style={{ width: 40, textAlign: 'end', fontSize: 13, color: T.text, fontWeight: 600 }}>{v.toFixed(1)}</div>
                </div>
              ))}
            </Panel>
          )}

          <Panel theme={T}>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10 }}>
              {S.actions}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <HRButton theme={T} variant="soft" icon="broadcasts">{S.nudge}</HRButton>
              <HRButton theme={T} variant="secondary" icon="content">{lang==='ar'?'اقتراح محتوى':'Recommend content'}</HRButton>
              <HRButton theme={T} variant="secondary" icon="challenges">{lang==='ar'?'إطلاق تحدٍّ':'Launch challenge'}</HRButton>
              <HRButton theme={T} variant="secondary" icon="reports">{lang==='ar'?'تصدير':'Export'}</HRButton>
            </div>
          </Panel>
        </div>
      </div>
      <style>{`@keyframes drawerIn { from { transform: translateX(100%); } to { transform: none; } }`}</style>
    </div>
  );
}

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

function Dashboard({ theme, S, cfg, density, gap, layout, range, setDrawerTeam }) {
  const T = theme;
  return (
    <>
      {/* Greeting row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div className="display" style={{ fontSize: 38, color: T.text, letterSpacing: -0.8, lineHeight: 1 }}>
            {S.greeting}
          </div>
          <div style={{ fontSize: 14, color: T.textMuted, marginTop: 8 }}>
            {S.subGreet} <strong style={{ color: T.textMid }}>{S.tenant}</strong> · {range.toUpperCase()} · {S.lastUpdated}: 09:42
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <HRButton theme={T} variant="secondary" icon="calendar">Apr 1 – Apr 30</HRButton>
          <HRButton theme={T} variant="primary" icon="plus">{S.newChallenge}</HRButton>
        </div>
      </div>

      <div style={{ marginBottom: gap }}>
        <KpiStrip theme={T} S={S} density={density} chartStyle={cfg.chartStyle}/>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: layout === 'wide' ? '1fr' : layout === 'split' ? '1fr 1fr' : 'minmax(0, 2fr) minmax(320px, 1fr)',
        gap, marginBottom: gap,
      }}>
        <TrendsCard theme={T} S={S} lang={cfg.lang} chartStyle={cfg.chartStyle} density={density}/>
        {layout !== 'wide' && <AtRisk theme={T} S={S} lang={cfg.lang} density={density} onOpenTeam={setDrawerTeam}/>}
      </div>

      {layout === 'wide' && (
        <div style={{ marginBottom: gap }}>
          <AtRisk theme={T} S={S} lang={cfg.lang} density={density} onOpenTeam={setDrawerTeam}/>
        </div>
      )}

      <div style={{ marginBottom: gap }}>
        <TeamTable theme={T} S={S} lang={cfg.lang} density={density} chartStyle={cfg.chartStyle} onOpenTeam={setDrawerTeam}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap, marginBottom: gap }}>
        <SafetyQueue theme={T} S={S} lang={cfg.lang} density={density}/>
        <Broadcasts theme={T} S={S} lang={cfg.lang} density={density}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr', gap, marginBottom: gap }}>
        <PeopleYouManage theme={T} S={S} lang={cfg.lang} density={density}/>
        <ContentPins theme={T} S={S} lang={cfg.lang} density={density}/>
        <ChallengesCard theme={T} S={S} lang={cfg.lang} density={density}/>
      </div>
    </>
  );
}

function HRApp() {
  const [cfg, setCfg] = React.useState(() => {
    try {
      const saved = localStorage.getItem('hr-portal-cfg');
      return saved ? { ...TWEAK_DEFAULTS, ...JSON.parse(saved) } : { ...TWEAK_DEFAULTS };
    } catch { return { ...TWEAK_DEFAULTS }; }
  });
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [range, setRange] = React.useState('30d');
  const [nav, setNav] = React.useState('dashboard');
  const [drawerTeam, setDrawerTeam] = React.useState(null);

  React.useEffect(() => {
    try { localStorage.setItem('hr-portal-cfg', JSON.stringify(cfg)); } catch {}
  }, [cfg]);

  React.useEffect(() => {
    const handler = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}
    return () => window.removeEventListener('message', handler);
  }, []);

  const T = HR_THEMES[cfg.theme] || HR_THEMES.dark;
  const S = HR_STRINGS[cfg.lang] || HR_STRINGS.en;
  const dir = cfg.lang === 'ar' ? 'rtl' : 'ltr';
  const density = cfg.density;
  const gap = DENSITY[density].gap;

  const layout = cfg.layout;
  // layouts differ in how the main dashboard is arranged

  return (
    <div data-rtl={dir === 'rtl'} style={{
      minHeight: '100vh', background: T.bg, color: T.text, display: 'flex',
      direction: dir, animation: 'dashIn .3s ease both',
    }}>
      <Sidebar theme={T} S={S} active={nav} onNav={setNav}/>

      <div style={{ flex: 1, minWidth: 0, background: T.page }}>
        <TopBar theme={T} S={S} dir={dir} range={range} onRange={setRange} onExport={() => {}} onTweaks={() => setTweaksOpen(!tweaksOpen)}/>

        <div style={{ padding: `24px ${gap + 10}px ${gap + 10}px` }}>
          {nav === 'dashboard' ? (
            <Dashboard theme={T} S={S} cfg={cfg} density={density} gap={gap} layout={layout} range={range} setDrawerTeam={setDrawerTeam}/>
          ) : nav === 'teams' ? (
            <HRTeamsPage theme={T} S={S} lang={cfg.lang} density={density} chartStyle={cfg.chartStyle} onOpenTeam={setDrawerTeam}/>
          ) : nav === 'people' ? (
            <HRPeoplePage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'safety' ? (
            <HRSafetyPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'content' ? (
            <HRContentPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'challenges' ? (
            <HRChallengesPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'broadcasts' ? (
            <HRBroadcastsPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'reports' ? (
            <HRReportsPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : nav === 'settings' ? (
            <HRSettingsPage theme={T} S={S} lang={cfg.lang} density={density}/>
          ) : (
            <Dashboard theme={T} S={S} cfg={cfg} density={density} gap={gap} layout={layout} range={range} setDrawerTeam={setDrawerTeam}/>
          )}

          <div style={{ textAlign: 'center', padding: '24px 0 10px', fontSize: 11, color: T.textFaint }}>
            Wellness+ HR Portal · Nile Group · v2.4.1
          </div>
        </div>
      </div>

      <TeamDrawer theme={T} team={drawerTeam} onClose={() => setDrawerTeam(null)} S={S} lang={cfg.lang} chartStyle={cfg.chartStyle}/>
      <TweaksPanel theme={T} open={tweaksOpen} onClose={() => setTweaksOpen(false)} cfg={cfg} setCfg={setCfg} S={S}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<HRApp/>);
