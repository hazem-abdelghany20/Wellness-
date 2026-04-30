import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge, Toggle } from '../../shared/components.jsx';
import { useFlags } from '../hooks/use-flags.js';

function FlagRow({ theme, density, lang, flag, isLast, onToggle }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const enabled = !!flag.enabled;
  const tone = enabled ? 'positive' : 'neutral';
  const stateLabel = enabled ? s('On','مفعّل') : s('Off','مغلق');

  async function toggle() {
    setBusy(true); setErr(null);
    try {
      await onToggle({
        key: flag.key,
        scope: flag.scope || 'global',
        target_id: flag.target_id || null,
        enabled: !enabled,
        payload: flag.payload || {},
      });
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
      display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: isLast ? 'none' : `1px solid ${T.divider}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mono" style={{ fontSize: 12, color: T.text, fontWeight: 700 }}>{flag.key}</span>
          <span style={{
            fontSize: 9.5, padding: '2px 6px', borderRadius: 4,
            background: T.panelSunk, color: T.textMuted, border: `1px solid ${T.border}`,
            textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700,
          }}>{flag.scope || 'global'}</span>
        </div>
        {flag.target_id && (
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }} className="mono">target: {flag.target_id}</div>
        )}
      </div>
      <Badge theme={T} tone={tone} dot>{stateLabel}</Badge>
      <Toggle theme={T} value={enabled} onChange={toggle} size="sm" disabled={busy}/>
      {err && <span style={{ fontSize: 11, color: T.danger }}>{err}</span>}
    </div>
  );
}

function AdminFlagsView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { flags, loading, set } = useFlags();

  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Feature flags','الخصائص التجريبية')}
        title={s('Rollout control','إدارة الإطلاق')}
        sub={loading
          ? s('Loading…','جارٍ التحميل…')
          : `${flags.length} ${s('flags','خاصية')}`}
        right={<HRButton theme={T} icon="plus">{s('New flag','خاصية جديدة')}</HRButton>}/>

      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density}
          title={s('Feature flags','الخصائص التجريبية')}
          subtitle={loading ? s('Loading…','جارٍ التحميل…') : `${flags.filter(f => f.enabled).length} ${s('on','مفعّل')}`}/>
        {loading ? (
          <div style={{ padding: 48, display: 'grid', placeItems: 'center', color: T.textMuted, fontSize: 13 }}>
            {s('Loading…','جارٍ التحميل…')}
          </div>
        ) : flags.length === 0 ? (
          <div style={{ padding: 32, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
            {s('No feature flags yet.','لا توجد خصائص بعد.')}
          </div>
        ) : (
          <div>
            {flags.map((f, i) => (
              <FlagRow key={f.id || `${f.key}-${f.scope}-${f.target_id || 'g'}`}
                theme={T} density={density} lang={lang}
                flag={f} isLast={i === flags.length - 1} onToggle={set}/>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

export { AdminFlagsView };
