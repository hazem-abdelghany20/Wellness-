import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { HR_THEMES, DENSITY, HR_STRINGS } from './shared/tokens.jsx';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from './shared/components.jsx';
import {
  ADMIN_DATA, AdminSidebar, AdminTopBar, AdminKpiStrip, DauMauChart,
  TenantsTable, ContentHealth, IntegrationsStatus, AuditLog,
  FeatureFlags, AdminTeam,
} from './admin/sections.jsx';
import { AdminPageHeader }                 from './admin/views/_header.jsx';
import { AdminOverview }                   from './admin/views/overview.jsx';
import { AdminTenantsView }                from './admin/views/tenants.jsx';
import { AdminContentView }                from './admin/views/content.jsx';
import { AdminIntegrationsView }           from './admin/views/integrations.jsx';
import { AdminFlagsView }                  from './admin/views/flags.jsx';
import { AdminAuditView }                  from './admin/views/audit.jsx';
import { AdminRolesView }                  from './admin/views/roles.jsx';
import { AdminLocalizationView }           from './admin/views/localization.jsx';
import { AdminChallengeTemplatesView }     from './admin/views/challenge-templates.jsx';
import { AdminTenantDetail } from './admin/views/tenant-detail.jsx';
import { AdminBilling }      from './admin/views/billing.jsx';
import { TweaksPanel } from './admin/tweaks-panel.jsx';
// --- admin-app.jsx ---
// Admin Portal — main app shell with Tweaks

const ADMIN_DEFAULTS = /*EDITMODE-BEGIN*/{
  "themeKey": "dark",
  "lang": "en",
  "density": "comfortable",
  "chartStyle": "area",
  "layout": "default"
}/*EDITMODE-END*/;

function AdminApp() {
  const [themeKey, setThemeKey] = React.useState(ADMIN_DEFAULTS.themeKey);
  const [lang, setLang]         = React.useState(ADMIN_DEFAULTS.lang);
  const [density, setDensity]   = React.useState(ADMIN_DEFAULTS.density);
  const [chartStyle, setChartStyle] = React.useState(ADMIN_DEFAULTS.chartStyle);
  const [layout, setLayout]     = React.useState(ADMIN_DEFAULTS.layout);
  const [active, setActive]     = React.useState('overview');
  const [openTenant, setOpenTenant] = React.useState(null);
  const [range, setRange]       = React.useState('30d');
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [editAvail, setEditAvail] = React.useState(false);

  const T = HR_THEMES[themeKey];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const s = (en, ar) => lang === 'ar' ? ar : en;

  React.useEffect(() => {
    document.body.dataset.rtl = dir === 'rtl';
    document.body.style.background = T.bg;
  }, [dir, T.bg]);

  React.useEffect(() => {
    const h = (e) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', h);
    setEditAvail(true);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', h);
  }, []);

  const persist = (patch) => {
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*'); } catch(e){}
  };
  const setT = (k, fn) => (v) => { fn(v); persist({ [k]: v }); };

  return (
    <div data-rtl={dir==='rtl'} style={{
      minHeight: '100vh', background: T.bg, color: T.text,
      display: 'flex', direction: dir,
    }}>
      <AdminSidebar theme={T} active={active} onNav={(id) => { setActive(id); setOpenTenant(null); }} lang={lang}/>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AdminTopBar theme={T} lang={lang} dir={dir} range={range} onRange={setRange} onTweaks={() => setTweaksOpen(o=>!o)}/>

        <main style={{
          padding: 24, display: 'flex', flexDirection: 'column', gap: DENSITY[density].gap,
          maxWidth: layout === 'wide' ? 'none' : 1480, width: '100%', margin: '0 auto', boxSizing: 'border-box',
        }}>
          {openTenant ? (
            <AdminTenantDetail theme={T} density={density} lang={lang} tenant={openTenant} onBack={() => setOpenTenant(null)}/>
          ) : active === 'billing' ? (
            <AdminBilling theme={T} density={density} lang={lang}/>
          ) : active === 'tenants' ? (
            <AdminTenantsView theme={T} density={density} lang={lang} onOpen={setOpenTenant}/>
          ) : active === 'content' ? (
            <AdminContentView theme={T} density={density} lang={lang}/>
          ) : active === 'integrations' ? (
            <AdminIntegrationsView theme={T} density={density} lang={lang}/>
          ) : active === 'flags' ? (
            <AdminFlagsView theme={T} density={density} lang={lang}/>
          ) : active === 'audit' ? (
            <AdminAuditView theme={T} density={density} lang={lang}/>
          ) : active === 'roles' ? (
            <AdminRolesView theme={T} density={density} lang={lang}/>
          ) : active === 'localization' ? (
            <AdminLocalizationView theme={T} density={density} lang={lang}/>
          ) : active === 'challenges' ? (
            <AdminChallengeTemplatesView theme={T} density={density} lang={lang}/>
          ) : (
            <AdminOverview theme={T} density={density} chartStyle={chartStyle} layout={layout} lang={lang} onOpenTenant={setOpenTenant}/>
          )}

          <footer style={{ padding: '16px 0 32px', display: 'flex', justifyContent: 'space-between', color: T.textFaint, fontSize: 11 }}>
            <span>Wellness+ Admin · v2026.04.29 · region eu-west</span>
            <span className="mono">build a8d4f10 · {s('signed in as Maya Reyes','مسجَّل كـ Maya Reyes')}</span>
          </footer>
        </main>
      </div>

      {tweaksOpen && (
        <TweaksPanel
          theme={T} lang={lang} density={density} chartStyle={chartStyle}
          layout={layout} themeKey={themeKey}
          setThemeKey={setThemeKey} setLang={setLang} setDensity={setDensity}
          setChartStyle={setChartStyle} setLayout={setLayout}
          setT={setT} S={s}
          onClose={() => { setTweaksOpen(false); window.parent.postMessage({type:'__edit_mode_dismissed'},'*'); }}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp/>);
