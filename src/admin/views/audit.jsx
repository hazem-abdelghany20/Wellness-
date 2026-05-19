import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { useAudit } from '../hooks/use-audit.js';
import { exportPlatformReport } from '../../lib/supabase-admin';
import { friendlyErrorI18n } from '../../lib/errors';

function AdminAuditView({ theme, density, lang, range }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { entries, loading } = useAudit();
  const [exporting, setExporting] = React.useState(false);
  const [exportErr, setExportErr] = React.useState(null);
  const [sevFilter, setSevFilter] = React.useState('all');
  const [actorQuery, setActorQuery] = React.useState('');
  const reportRange = range && ['24h','7d','30d','90d'].includes(range) ? range : '90d';
  // The audit edge-fn now accepts 24h/7d/30d/90d directly — pass the
  // topbar selection through so the CSV scope matches what the user sees.
  const exportRange = reportRange;
  const exportLabel = {
    '24h': s('Export 24 hours','تصدير ٢٤ ساعة'),
    '7d': s('Export 7 days','تصدير ٧ أيام'),
    '30d': s('Export 30 days','تصدير ٣٠ يومًا'),
    '90d': s('Export 90 days','تصدير ٩٠ يومًا'),
  }[exportRange] || s('Export','تصدير');

  async function handleExport() {
    setExporting(true); setExportErr(null);
    try {
      const { url } = await exportPlatformReport('audit', exportRange);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${exportRange}-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      setExportErr(friendlyErrorI18n(e, lang));
    } finally {
      setExporting(false);
    }
  }

  const tone = { info: 'neutral', warn: 'caution', err: 'danger', error: 'danger' };

  // Normalise severity for the filter dropdown — DB has 'info' / 'warn' /
  // 'error' / 'err' historically; treat 'err' as 'error' so they collapse.
  const normalisedEntries = entries.map((a) => ({
    ...a,
    _sev: ((a.severity || a.sev || 'info') === 'err') ? 'error' : (a.severity || a.sev || 'info'),
    _actor: a.actor || a.actor_email || a.actor_id || 'system',
  }));
  const filtered = normalisedEntries.filter((a) => {
    const sevOk = sevFilter === 'all' || a._sev === sevFilter;
    const actorOk = !actorQuery.trim() || String(a._actor).toLowerCase().includes(actorQuery.trim().toLowerCase());
    return sevOk && actorOk;
  });

  const filterInput = {
    height: 32, padding: '0 10px', borderRadius: 8,
    background: T.panelSunk, border: `1px solid ${T.border}`,
    color: T.text, fontSize: 12, outline: 'none',
  };

  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Audit & compliance','التدقيق والامتثال')}
        title={s('Audit log','سجل التدقيق')}
        sub={loading
          ? s('Loading…','جارٍ التحميل…')
          : `${entries.length} ${s('events','حدث')}`}
        right={<>
          <HRButton theme={T} variant="secondary" icon="download" onClick={handleExport} disabled={exporting}>
            {exporting ? s('Exporting…','جارٍ التصدير…') : exportLabel}
          </HRButton>
          {exportErr && <span style={{ fontSize: 11, color: T.danger, marginInlineStart: 8 }}>{exportErr}</span>}
        </>}/>

      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density}
          title={s('Audit log','سجل التدقيق')}
          subtitle={loading
            ? s('Loading…','جارٍ التحميل…')
            : (filtered.length === entries.length
                ? s('Live · most recent first','مباشر · الأحدث أولًا')
                : `${filtered.length} ${s('of','من')} ${entries.length} ${s('events','حدث')}`)}
          right={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} style={filterInput} title={s('Severity','الخطورة')}>
              <option value="all">{s('All severities','كل الخطورات')}</option>
              <option value="info">{s('Info','معلومات')}</option>
              <option value="warn">{s('Warn','تحذير')}</option>
              <option value="error">{s('Error','خطأ')}</option>
            </select>
            <input value={actorQuery} onChange={(e) => setActorQuery(e.target.value)}
              placeholder={s('Actor email / id','بريد المُنفّذ')}
              style={{ ...filterInput, width: 180 }}/>
          </div>}/>
        {loading ? (
          <div style={{ padding: 48, display: 'grid', placeItems: 'center', color: T.textMuted, fontSize: 13 }}>
            {s('Loading…','جارٍ التحميل…')}
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 32, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
            {s('No audit events yet.','لا توجد أحداث تدقيق بعد.')}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
            {s('No events match the current filters.','لا توجد أحداث تطابق التصفية الحالية.')}
          </div>
        ) : (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5 }}>
            {filtered.map((a, i) => {
              const when = a.occurred_at ? new Date(a.occurred_at) : null;
              const time = when ? when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
              const date = when ? when.toLocaleDateString() : '';
              const sev = a._sev;
              const actor = a._actor;
              const action = a.action || a.event || '—';
              const target = a.target || a.target_id || a.details || '';
              return (
                <div key={a.id || i} style={{
                  padding: `${density === 'compact' ? 7 : 9}px ${DENSITY[density].cardPad}px`,
                  display: 'flex', alignItems: 'baseline', gap: 12,
                  borderBottom: i < filtered.length - 1 ? `1px solid ${T.divider}` : 'none',
                }}>
                  <span style={{ color: T.textFaint, width: 80, flexShrink: 0 }}>{time}</span>
                  <Badge theme={T} tone={tone[sev] || 'neutral'} style={{ flexShrink: 0 }}>{sev}</Badge>
                  <span style={{ color: T.textMid, width: 180, flexShrink: 0, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actor}</span>
                  <span style={{ color: T.accent, fontWeight: 600, flexShrink: 0 }}>{action}</span>
                  <span style={{ color: T.text, flex: 1, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {typeof target === 'object' ? JSON.stringify(target) : target}
                  </span>
                  {date && <span style={{ color: T.textFaint, fontSize: 10 }}>{date}</span>}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}

export { AdminAuditView };
