import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { useAudit } from '../hooks/use-audit.js';

function AdminAuditView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { entries, loading } = useAudit();

  const tone = { info: 'neutral', warn: 'caution', err: 'danger', error: 'danger' };

  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Audit & compliance','التدقيق والامتثال')}
        title={s('Audit log','سجل التدقيق')}
        sub={loading
          ? s('Loading…','جارٍ التحميل…')
          : `${entries.length} ${s('events','حدث')}`}
        right={<HRButton theme={T} variant="secondary" icon="download">{s('Export 90 days','تصدير ٩٠ يومًا')}</HRButton>}/>

      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density}
          title={s('Audit log','سجل التدقيق')}
          subtitle={loading ? s('Loading…','جارٍ التحميل…') : s('Live · most recent first','مباشر · الأحدث أولًا')}
          right={<HRButton theme={T} variant="ghost" size="sm" icon="filter"/>}/>
        {loading ? (
          <div style={{ padding: 48, display: 'grid', placeItems: 'center', color: T.textMuted, fontSize: 13 }}>
            {s('Loading…','جارٍ التحميل…')}
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 32, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
            {s('No audit events yet.','لا توجد أحداث تدقيق بعد.')}
          </div>
        ) : (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5 }}>
            {entries.map((a, i) => {
              const when = a.occurred_at ? new Date(a.occurred_at) : null;
              const time = when ? when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
              const date = when ? when.toLocaleDateString() : '';
              const sev = a.severity || a.sev || 'info';
              const actor = a.actor || a.actor_email || a.actor_id || 'system';
              const action = a.action || a.event || '—';
              const target = a.target || a.target_id || a.details || '';
              return (
                <div key={a.id || i} style={{
                  padding: `${density === 'compact' ? 7 : 9}px ${DENSITY[density].cardPad}px`,
                  display: 'flex', alignItems: 'baseline', gap: 12,
                  borderBottom: i < entries.length - 1 ? `1px solid ${T.divider}` : 'none',
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
