import React from 'react';
import { HR_THEMES, DENSITY } from '../shared/tokens.jsx';
import {
  AdminSidebar, AdminTopBar,
} from './sections.jsx';
import { AdminOverview }                   from './views/overview.jsx';
import { AdminTenantsView }                from './views/tenants.jsx';
import { AdminContentView }                from './views/content.jsx';
import { AdminIntegrationsView }           from './views/integrations.jsx';
import { AdminFlagsView }                  from './views/flags.jsx';
import { AdminAuditView }                  from './views/audit.jsx';
import { AdminRolesView }                  from './views/roles.jsx';
import { AdminLocalizationView }           from './views/localization.jsx';
import { AdminChallengeTemplatesView }     from './views/challenge-templates.jsx';
import { AdminTenantDetail } from './views/tenant-detail.jsx';
import { AdminBilling }      from './views/billing.jsx';
import { TweaksPanel } from './tweaks-panel.jsx';
import { AdminAppConfigProvider, useAdminAppConfig } from './state/app-config-context.jsx';
import { AdminAuthProvider, useAdminAuth } from './state/auth-context.jsx';
import { SignIn } from './views/sign-in.jsx';
import { AccessDenied } from './views/access-denied.jsx';

function AppInner() {
  const { cfg, patch } = useAdminAppConfig();
  const { themeKey, lang, density, chartStyle, layout } = cfg;
  const setThemeKey   = (v) => patch({ themeKey: v });
  const setLang       = (v) => patch({ lang: v });
  const setDensity    = (v) => patch({ density: v });
  const setChartStyle = (v) => patch({ chartStyle: v });
  const setLayout     = (v) => patch({ layout: v });

  const [active, setActive]     = React.useState('overview');
  const [openTenant, setOpenTenant] = React.useState(null);
  const [range, setRange]       = React.useState('30d');
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [editAvail, setEditAvail] = React.useState(false);

  const tweaksAvailable = import.meta.env.DEV ||
    new URLSearchParams(window.location.search).get('tweaks') === '1';

  const T = HR_THEMES[themeKey];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const s = (en, ar) => lang === 'ar' ? ar : en;

  React.useEffect(() => {
    document.body.dataset.rtl = dir === 'rtl';
    document.body.style.background = T.bg;
  }, [dir, T.bg]);

  React.useEffect(() => {
    if (!tweaksAvailable) return;
    const h = (e) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', h);
    setEditAvail(true);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', h);
  }, [tweaksAvailable]);

  const persist = (patch) => {
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*'); } catch(e){}
  };
  const setT = (k, fn) => (v) => { fn(v); persist({ [k]: v }); };

  const { session, role, loading: authLoading } = useAdminAuth();

  if (authLoading) return <div style={{ minHeight: '100vh', background: T.bg }}/>;
  if (!session)    return <SignIn theme={T} dir={dir}/>;
  if (role !== 'wellness_admin') return <AccessDenied theme={T} dir={dir}/>;

  return (
    <div data-rtl={dir==='rtl'} style={{
      minHeight: '100vh', background: T.bg, color: T.text,
      display: 'flex', direction: dir,
    }}>
      <AdminSidebar theme={T} active={active} onNav={(id) => { setActive(id); setOpenTenant(null); }} lang={lang}/>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AdminTopBar theme={T} lang={lang} dir={dir} range={range} onRange={setRange} onTweaks={tweaksAvailable ? (() => setTweaksOpen(o=>!o)) : undefined}/>

        <main style={{
          padding: 24, display: 'flex', flexDirection: 'column', gap: DENSITY[density].gap,
          maxWidth: layout === 'wide' ? 'none' : 1480, width: '100%', margin: '0 auto', boxSizing: 'border-box',
        }}>
          {openTenant ? (
            <AdminTenantDetail theme={T} density={density} lang={lang} tenant={openTenant} onBack={() => setOpenTenant(null)}/>
          ) : active === 'billing' ? (
            <AdminBilling theme={T} density={density} lang={lang} companyId={openTenant?.id}/>
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

export default function App() {
  return (
    <AdminAppConfigProvider>
      <AdminAuthProvider>
        <AppInner />
      </AdminAuthProvider>
    </AdminAppConfigProvider>
  );
}
