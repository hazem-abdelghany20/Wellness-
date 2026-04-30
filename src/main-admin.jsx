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
        <div style={{
          position: 'fixed', bottom: 18, insetInlineEnd: 18, width: 300,
          background: T.panel, color: T.text, borderRadius: 16,
          border: `1px solid ${T.borderStrong}`, boxShadow: T.shadowMd,
          zIndex: 100, overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{s('Tweaks','التعديلات')}</div>
            <button onClick={() => { setTweaksOpen(false); window.parent.postMessage({type:'__edit_mode_dismissed'},'*'); }}
              style={{ background:'transparent', border:'none', color:T.textMuted, cursor:'pointer' }}>
              <HRIcon name="close" size={16}/>
            </button>
          </div>
          <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TweakRow label={s('Theme','المظهر')}>
              {[['dark','Dark'],['light','Light']].map(([k,l])=>(
                <SegBtn key={k} theme={T} active={themeKey===k} onClick={()=>setT('themeKey',setThemeKey)(k)}>{l}</SegBtn>
              ))}
            </TweakRow>
            <TweakRow label={s('Language','اللغة')}>
              {[['en','EN'],['ar','AR']].map(([k,l])=>(
                <SegBtn key={k} theme={T} active={lang===k} onClick={()=>setT('lang',setLang)(k)}>{l}</SegBtn>
              ))}
            </TweakRow>
            <TweakRow label={s('Density','الكثافة')}>
              {[['compact',s('Compact','مكثف')],['comfortable',s('Comfortable','مريح')]].map(([k,l])=>(
                <SegBtn key={k} theme={T} active={density===k} onClick={()=>setT('density',setDensity)(k)}>{l}</SegBtn>
              ))}
            </TweakRow>
            <TweakRow label={s('Chart','الرسم')}>
              {[['line',s('Line','خط')],['area',s('Area','مساحة')],['bar',s('Bar','عمود')]].map(([k,l])=>(
                <SegBtn key={k} theme={T} active={chartStyle===k} onClick={()=>setT('chartStyle',setChartStyle)(k)}>{l}</SegBtn>
              ))}
            </TweakRow>
            <TweakRow label={s('Layout','التخطيط')}>
              {[['default',s('Default','افتراضي')],['wide',s('Wide','واسع')],['split',s('Split','مقسم')]].map(([k,l])=>(
                <SegBtn key={k} theme={T} active={layout===k} onClick={()=>setT('layout',setLayout)(k)}>{l}</SegBtn>
              ))}
            </TweakRow>
          </div>
        </div>
      )}
    </div>
  );
}

function TweakRow({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(128,128,128,0.6)', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}
function SegBtn({ theme, active, onClick, children }) {
  const T = theme;
  return (
    <button onClick={onClick} style={{
      flex: 1, height: 30, padding: '0 8px', borderRadius: 7, minWidth: 50,
      background: active ? T.accent : T.panelSunk,
      color: active ? T.accentInk : T.text,
      border: `1px solid ${active ? 'transparent' : T.border}`,
      fontSize: 11, fontWeight: 600, cursor: 'pointer',
    }}>{children}</button>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp/>);
