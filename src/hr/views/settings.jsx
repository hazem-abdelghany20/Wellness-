import React, { useState, useEffect } from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, Toggle } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useSettings } from '../hooks/use-settings.js';

// ── SETTINGS PAGE ────────────────────────────────────────────────
function HRSettingsPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { company, loading, update } = useSettings();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    if (company) setForm({ name: company.name || '', settings: company.settings || {} });
  }, [company]);

  if (loading || !form) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        {s('Loading…','جارٍ التحميل…')}
      </div>
    );
  }

  const settings = form.settings || {};
  const setSetting = (key, value) => {
    setForm(prev => ({ ...prev, settings: { ...(prev.settings || {}), [key]: value } }));
  };

  const aggregateOnly  = settings.aggregate_only ?? true;
  const minCohort      = settings.min_cohort ?? 5;
  const quietHours     = settings.quiet_hours ?? true;
  const escalationMins = settings.escalation_mins ?? 15;

  const handleSave = async () => {
    setBusy(true); setFlash(null);
    try {
      await update({ name: form.name, settings: form.settings });
      setFlash({ kind: 'ok' });
    } catch (e) {
      setFlash({ kind: 'err', message: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Workspace','مساحة العمل')}
        title={s('Settings','الإعدادات')}
        sub={form.name || ''}
        right={
          <>
            {flash && (
              <span style={{ fontSize: 12, color: flash.kind === 'ok' ? T.positive : T.danger, alignSelf: 'center' }}>
                {flash.kind === 'ok' ? s('Saved.','تم الحفظ.') : s('Failed to save.','فشل الحفظ.')}
              </span>
            )}
            <HRButton theme={T} variant="primary" disabled={busy} onClick={handleSave}>
              {busy ? s('Saving…','جارٍ الحفظ…') : s('Save changes','حفظ التغييرات')}
            </HRButton>
          </>
        }/>

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
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 4 }}>{s('Company name','اسم الشركة')}</div>
            <input value={form.name} onChange={(e)=>setForm(prev => ({ ...prev, name: e.target.value }))} style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginTop: 8,
              background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
              color: T.text, fontSize: 14, fontFamily: 'inherit', outline: 'none',
            }}/>
          </Panel>

          <Panel theme={T} density={density}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 4 }}>{s('Aggregate-only enforcement','الإلزام بالتجميع فقط')}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>{s('No individual records visible to HR. Min cohort enforced for all reports.','لا يمكن للموارد البشرية رؤية السجلات الفردية. يتم فرض حد أدنى للعينة لكل التقارير.')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Toggle theme={T} value={!!aggregateOnly} onChange={(v)=>setSetting('aggregate_only', v)}/>
              <span style={{ fontSize: 13, color: T.textMid }}>{aggregateOnly ? s('Enforced','مفعَّل') : s('Disabled','معطَّل')}</span>
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.divider}` }}>
              <div style={{ fontSize: 12, color: T.textMid, marginBottom: 8 }}>{s('Minimum cohort size','الحد الأدنى للعينة')}</div>
              <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}`, width: 'fit-content' }}>
                {[3, 5, 10, 20].map(n => (
                  <button key={n} onClick={()=>setSetting('min_cohort', n)} style={{
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
              <Toggle theme={T} value={!!quietHours} onChange={(v)=>setSetting('quiet_hours', v)}/>
              <span style={{ fontSize: 13, color: T.textMid }}>{quietHours ? s('On · 08:00–20:00','مفعَّل · ٠٨:٠٠–٢٠:٠٠') : s('Off','معطَّل')}</span>
            </div>
          </Panel>

          <Panel theme={T} density={density}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 4 }}>{s('Safety escalation','تصعيد السلامة')}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>{s('Auto-page on-call counsellor when high-severity flag is unacknowledged.','إخطار المستشار المناوب تلقائيًا عند عدم استلام إشارة عالية الخطورة.')}</div>
            <div style={{ fontSize: 12, color: T.textMid, marginBottom: 8 }}>{s('Escalate after','التصعيد بعد')}</div>
            <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}`, width: 'fit-content' }}>
              {[5, 15, 30, 60].map(n => (
                <button key={n} onClick={()=>setSetting('escalation_mins', n)} style={{
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

export { HRSettingsPage };
