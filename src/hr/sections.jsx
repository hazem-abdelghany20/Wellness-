import React from 'react';
import { DENSITY } from '../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader, Badge, AvatarMark } from '../shared/components.jsx';
// --- hr-sections.jsx ---
// HR Portal shell pieces: sidebar, top bar, and the broadcasts panel used
// on the dashboard.

// ── EMPTY-STATE HELPER ───────────────────────────────────────────
function EmptyRow({ theme, density, text }) {
  return (
    <div style={{
      padding: `${DENSITY[density].cardPad}px`,
      fontSize: 12, color: theme.textMuted, textAlign: 'center',
    }}>{text}</div>
  );
}

function Sidebar({ theme, S, active, onNav, collapsed }) {
  const T = theme;
  const items = [
    { id: 'dashboard', key: 'dashboard' },
    { id: 'people', key: 'people' },
    { id: 'content', key: 'content' },
    { id: 'challenges', key: 'challenges' },
    { id: 'gifts', key: 'gifts' },
    { id: 'broadcasts', key: 'broadcasts' },
    { id: 'settings', key: 'settings' },
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
        <img src="/wellness-mark.png" alt="" style={{ height: 22, filter: 'brightness(0) invert(1)' }}/>
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
    </aside>
  );
}

// ── TOP BAR ─────────────────────────────────────────────────────
function TopBar({ theme, S, dir, range, onRange, onExport, onTweaks, userName, userEmail, userRoleLabel, companyName }) {
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

      {onExport && <HRButton theme={T} variant="secondary" icon="download" onClick={onExport}>{S.exportPdf}</HRButton>}

      <div style={{ width: 1, height: 28, background: T.border }}/>

      <button style={{
        background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative',
        color: T.textMid, display: 'flex', alignItems: 'center',
      }}>
        <HRIcon name="bell" size={18}/>
        <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 999, background: T.danger }}/>
      </button>

      <div onClick={onTweaks} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <AvatarMark theme={T} name={userName || userEmail || '?'} size={34}/>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{userName || userEmail || '—'}</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>{userRoleLabel || ''}{userRoleLabel && companyName ? ' · ' : ''}{companyName || ''}</div>
        </div>
        <HRIcon name="chevDown" size={14} stroke={T.textMuted}/>
      </div>
    </div>
  );
}

function Broadcasts({ theme, S, lang, density, onNew, list = [] }) {
  const T = theme;
  const rows = list.slice(0, 4);
  const statusLabel = (st) => st === 'sent' ? (lang==='ar'?'مُرسل':'Sent')
                       : st === 'scheduled' ? (lang==='ar'?'مجدول':'Scheduled')
                       : st === 'cancelled' ? (lang==='ar'?'ملغي':'Cancelled')
                       : st;
  return (
    <Panel theme={T} density={density} pad={false}>
      <PanelHeader theme={T} density={density} title={S.activeBroadcasts} subtitle={lang==='ar'?'حملات نشطة':'Last 30 days'}
        right={<HRButton theme={T} size="sm" icon="plus" onClick={onNew}>{S.draftPost}</HRButton>}/>
      <div>
        {rows.length === 0 ? (
          <EmptyRow theme={T} density={density} text={lang==='ar'?'لا توجد إعلانات':'No broadcasts yet'}/>
        ) : rows.map((b, i) => {
          const when = b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString(lang==='ar'?'ar-EG':'en-GB', { month: 'short', day: 'numeric' }) : '';
          const title = (lang==='ar' && b.title_ar) ? b.title_ar : b.title_en;
          return (
            <div key={b.id || i} style={{
              padding: `${DENSITY[density].cellPadY + 4}px ${DENSITY[density].cardPad}px`,
              borderBottom: i < rows.length - 1 ? `1px solid ${T.divider}` : 'none',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                  {b.scope === 'team' ? (lang==='ar'?'فريق':'Team') : (lang==='ar'?'كل الموظفين':'All staff')} · {when}
                </div>
              </div>
              <Badge theme={T} tone={b.status === 'sent' ? 'positive' : b.status === 'cancelled' ? 'neutral' : 'info'}>{statusLabel(b.status)}</Badge>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export { Sidebar, TopBar, Broadcasts };
