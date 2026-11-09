import React from 'react';
import { Icon } from '../design-system.jsx';

// Today · Challenge · Library · Score · Me when HR gave a routine; otherwise
// the four tabs exactly as before.
function TabBar({ theme, t, dir, active, onTab, hasToday = false }) {
  const T = theme;
  const tabs = [
    ...(hasToday ? [{ id: 'today', icon: 'sun', label: dir === 'rtl' ? 'النهارده' : 'Today' }] : []),
    { id: 'challenges', icon: 'trophy', label: dir === 'rtl' ? 'التحدي' : 'Challenge' },
    { id: 'library', icon: 'library', label: dir === 'rtl' ? 'المكتبة' : 'Library' },
    { id: 'score', icon: 'chart', label: dir === 'rtl' ? 'نقاطي' : 'Score' },
    { id: 'profile', icon: 'user', label: dir === 'rtl' ? 'أنا' : 'Me' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      paddingBottom: 'var(--wp-bottom)', paddingTop: 8,
      background: `linear-gradient(to top, ${T.bg} 70%, transparent)`,
    }}>
      <div style={{
        margin: '0 16px', background: T.surface,
        border: `1px solid ${T.border}`, borderRadius: 22,
        padding: 6, display: 'flex',
        boxShadow: T.isDark ? '0 10px 30px rgba(0,0,0,0.35)' : '0 10px 30px rgba(0,0,0,0.08)',
      }}>
        {tabs.map(tab => {
          const isActive = active === tab.id;
          return (
            <button key={tab.id} onClick={() => onTab(tab.id)}
              aria-label={tab.label} aria-current={isActive ? 'page' : undefined} style={{
              flex: 1, height: 52, borderRadius: 14,
              background: isActive ? T.accent : 'transparent',
              color: isActive ? T.accentInk : T.textMuted,
              border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              transition: 'background .2s',
            }}>
              <Icon name={tab.icon} size={19}/>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.2, whiteSpace: 'nowrap' }}>{tab.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { TabBar };
