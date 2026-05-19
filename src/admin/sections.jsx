import React from 'react';
import { HRIcon, AvatarMark } from '../shared/components.jsx';
import { useSystemHealth } from './hooks/use-system-health.js';

// Admin Portal — sidebar + topbar primitives. The page bodies render
// through src/admin/views/*.jsx which read live data via the hooks in
// src/admin/hooks/*.js. Earlier revisions of this file shipped a large
// ADMIN_DATA mock + hardcoded panel components; those were dead code
// (App.jsx never rendered them) and have been removed.

// ── SIDEBAR ──────────────────────────────────────────────────────
function AdminSidebar({ theme, active, onNav, lang, user, profile, role, onSignOut }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const items = [
    { id: 'overview',   icon: 'dashboard',   label: s('Overview', 'نظرة عامة') },
    { id: 'tenants',    icon: 'people',      label: s('Tenants', 'العملاء') },
    { id: 'roles',      icon: 'teams',       label: s('Users & Roles', 'المستخدمون والأدوار') },
    { id: 'content',    icon: 'content',     label: s('Content Library', 'مكتبة المحتوى') },
    { id: 'challenges', icon: 'challenges',  label: s('Challenge Templates', 'قوالب التحديات') },
    { id: 'integrations', icon: 'globe',     label: s('Integrations', 'التكاملات') },
    { id: 'localization', icon: 'mail',      label: s('Localization', 'التعريب') },
    { id: 'flags',      icon: 'sparkle',     label: s('Feature Flags', 'الخصائص التجريبية') },
    { id: 'audit',      icon: 'shield',      label: s('Audit Log', 'سجل التدقيق') },
    { id: 'billing',    icon: 'reports',     label: s('Billing', 'الفوترة') },
  ];

  // Resolve the signed-in identity. Falls back through profile.display_name
  // → user.email's local-part → 'Admin'. Role label translates the snake_case
  // database role into a human label.
  const displayName = profile?.display_name
    || (user?.email ? user.email.split('@')[0] : null)
    || s('Admin','مسؤول');
  const ROLE_LABELS = {
    wellness_admin: s('Platform admin','مسؤول المنصة'),
    company_admin:  s('Company admin','مسؤول الشركة'),
    hr_admin:       s('HR admin','مسؤول الموارد'),
    manager:        s('Manager','مدير'),
    employee:       s('Employee','موظف'),
  };
  const roleLabel = ROLE_LABELS[role] || s('Admin','مسؤول');
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <aside style={{
      width: 232, flexShrink: 0, background: T.sidebarBg, color: T.sidebarText,
      display: 'flex', flexDirection: 'column',
      borderInlineEnd: `1px solid rgba(245,241,232,0.06)`,
      position: 'sticky', top: 0, height: '100vh', zIndex: 10,
    }}>
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/wellness-mark.png" alt="" style={{ height: 22, filter: 'brightness(0) invert(1)' }}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: T.sidebarMark, letterSpacing: -0.3, lineHeight: 1 }}>
            Wellness<span style={{ color: T.sidebarActive }}>+</span>
          </div>
          <div style={{ fontSize: 9.5, color: 'rgba(245,241,232,0.45)', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>
            {s('Admin Console','وحدة الإدارة')}
          </div>
        </div>
      </div>

      {/* Env switcher — display-only. We only ship one env from this UI
          so the chevron used to imply a non-existent switcher. */}
      <div style={{ padding: '4px 14px 12px' }}>
        <div style={{
          background: 'rgba(245,241,232,0.06)', borderRadius: 10,
          padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
          border: '1px solid rgba(245,241,232,0.06)',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#6FC79B', boxShadow: '0 0 0 3px rgba(111,199,155,0.18)' }}/>
          <div style={{ flex: 1, lineHeight: 1.2 }}>
            <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.55)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{s('Environment','البيئة')}</div>
            <div style={{ fontSize: 12, color: T.sidebarMark, fontWeight: 600 }}>production · eu-west</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 14px' }}>
        {items.map(it => {
          const isActive = active === it.id;
          return (
            <button key={it.id} onClick={() => onNav(it.id)} style={{
              width: '100%', padding: '9px 12px',
              display: 'flex', alignItems: 'center', gap: 12,
              background: isActive ? 'rgba(245,181,68,0.12)' : 'transparent',
              color: isActive ? T.sidebarActive : T.sidebarText,
              border: 'none', borderRadius: 10, cursor: 'pointer', marginBottom: 2,
              fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
              borderInlineStart: isActive ? `2px solid ${T.sidebarActive}` : '2px solid transparent',
            }}>
              <HRIcon name={it.icon} size={18}/>
              <span style={{ flex: 1, textAlign: 'start' }}>{it.label}</span>
              {it.badge && (
                <span style={{
                  minWidth: 20, height: 18, padding: '0 6px', borderRadius: 999,
                  background: '#F5B544', color: '#1A1206',
                  fontSize: 10, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{it.badge}</span>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1 }}/>
      <div style={{ padding: 14, borderTop: '1px solid rgba(245,241,232,0.06)', position: 'relative' }}>
        <button
          type="button"
          onClick={onSignOut ? () => setMenuOpen((o) => !o) : undefined}
          aria-haspopup={!!onSignOut}
          aria-expanded={menuOpen}
          style={{
            width: '100%', background: 'transparent', border: 'none',
            padding: 0, color: T.sidebarText,
            cursor: onSignOut ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 10,
            textAlign: 'start',
          }}
          title={onSignOut ? s('Profile menu','قائمة الملف') : undefined}
        >
          <AvatarMark theme={T} name={displayName} size={32}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: T.sidebarMark, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.5)' }}>{roleLabel}</div>
          </div>
          <HRIcon name="more" size={16} stroke="rgba(245,241,232,0.55)"/>
        </button>
        {menuOpen && onSignOut && (
          <div
            role="menu"
            style={{
              position: 'absolute', insetInlineStart: 14, insetInlineEnd: 14, bottom: 64,
              background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10,
              padding: 6, boxShadow: '0 12px 32px rgba(0,0,0,0.35)', zIndex: 20,
            }}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <div style={{ padding: '8px 10px 6px', fontSize: 11, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
            <button
              type="button"
              onClick={async () => { setMenuOpen(false); try { await onSignOut(); } catch (e) { console.warn('[admin] signOut failed', e); } }}
              style={{
                width: '100%', textAlign: 'start',
                background: 'transparent', border: 'none',
                padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                color: T.text, fontSize: 12, fontWeight: 600,
              }}
            >
              {s('Sign out','تسجيل الخروج')}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

// ── TOP BAR ────────────────────────────────────────────────────
function AdminTopBar({ theme, lang, dir, range, onRange, onTweaks }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  // Live health signal: counts warn + error rows in the audit_log over
  // the last 24h. Updates once a minute. Renders as a green/yellow/red
  // pill in the topbar — replaces the previously hardcoded "All systems
  // normal" string.
  const { counts, status, loading: healthLoading } = useSystemHealth();
  const healthColor = status === 'error' ? T.danger : status === 'warn' ? T.caution : T.positive;
  const healthGlow = status === 'error'
    ? (T.isDark ? 'rgba(224,138,107,0.20)' : 'rgba(176,67,42,0.18)')
    : status === 'warn'
      ? (T.isDark ? 'rgba(245,181,68,0.22)' : 'rgba(176,118,30,0.18)')
      : (T.isDark ? 'rgba(111,199,155,0.18)' : 'rgba(46,125,94,0.18)');
  const healthLabel = healthLoading
    ? s('Checking…','جارٍ الفحص…')
    : status === 'error'
      ? `${counts.error} ${s(counts.error === 1 ? 'alert' : 'alerts', 'تنبيه')}`
      : status === 'warn'
        ? `${counts.warn} ${s(counts.warn === 1 ? 'warning' : 'warnings', 'تحذير')}`
        : s('All systems normal','كل الأنظمة طبيعية');
  const healthTitle = `${counts.total} ${s('audit events in the last 24h','حدث تدقيق في آخر ٢٤ ساعة')}`;
  return (
    <div style={{
      height: 64, borderBottom: `1px solid ${T.border}`, background: T.panel,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, position: 'sticky', top: 0, zIndex: 5,
    }}>
      {/* Global search isn't backed by anything yet — restoring it as
          a no-op input fooled testers into typing into a dead box. The
          space is reserved for when search ships. */}

      <div style={{ flex: 1 }}/>

      <div title={healthTitle} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 10,
        background: T.isDark ? `${healthColor}1A` : `${healthColor}14`,
        color: healthColor, border: `1px solid ${T.border}`,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: healthColor, boxShadow: `0 0 0 3px ${healthGlow}` }}/>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{healthLabel}</span>
      </div>

      <div style={{ display: 'flex', background: T.panelSunk, borderRadius: 10, padding: 3, border: `1px solid ${T.border}` }}>
        {[['24h', s('24h','٢٤س')], ['7d', s('7d','٧ي')], ['30d', s('30d','٣٠ي')], ['90d', s('90d','٩٠ي')]].map(([k, l]) => (
          <button key={k} onClick={() => onRange(k)} style={{
            padding: '6px 11px', borderRadius: 7,
            background: range === k ? T.panel : 'transparent',
            color: range === k ? T.text : T.textMuted,
            border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {/* Top-bar Export + notifications bell were wired to nothing —
          export lives per-page (Tenants, Audit) and we don't have a
          notifications surface yet. Removed to avoid stub controls. */}

      {onTweaks && (
        <button onClick={onTweaks} style={{
          background: T.accent, color: T.accentInk, border: 'none', borderRadius: 8,
          height: 36, padding: '0 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <HRIcon name="settings" size={14}/> {s('Tweaks','التعديلات')}
        </button>
      )}
    </div>
  );
}

export { AdminSidebar, AdminTopBar };
