import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader } from '../../shared/components.jsx';
import { useLocalization } from '../hooks/use-localization.js';

function StringRow({ theme, density, lang, str, isLast, onSave }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [value, setValue] = React.useState(str.value || '');
  const [err, setErr] = React.useState(null);

  React.useEffect(() => { setValue(str.value || ''); }, [str.value]);

  async function save() {
    setBusy(true); setErr(null);
    try {
      await onSave(str.key, str.lang, value);
      setEditing(false);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 80px 2fr 120px',
      padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
      fontSize: 13, alignItems: 'center', gap: 10,
      borderBottom: isLast ? 'none' : `1px solid ${T.divider}`,
    }}>
      <div className="mono" style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{str.key}</div>
      <div className="mono" style={{ fontSize: 11, color: T.textMuted }}>{str.lang}</div>
      <div>
        {editing ? (
          <input value={value} onChange={(e) => setValue(e.target.value)} style={{
            width: '100%', height: 32, padding: '0 10px', borderRadius: 8,
            background: T.panelSunk, border: `1px solid ${T.border}`,
            color: T.text, fontSize: 12, outline: 'none',
          }}/>
        ) : (
          <span style={{ color: T.text }}>{str.value}</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        {editing ? (
          <>
            <HRButton theme={T} variant="ghost" size="sm" disabled={busy} onClick={() => { setEditing(false); setValue(str.value || ''); }}>
              {s('Cancel','إلغاء')}
            </HRButton>
            <HRButton theme={T} size="sm" disabled={busy} onClick={save}>
              {busy ? s('Saving…','جارٍ الحفظ…') : s('Save','احفظ')}
            </HRButton>
          </>
        ) : (
          <HRButton theme={T} variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {s('Edit','تعديل')}
          </HRButton>
        )}
        {err && <span style={{ fontSize: 10, color: T.danger }}>{err}</span>}
      </div>
    </div>
  );
}

function AdminLocalizationView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { strings, loading, save } = useLocalization();

  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Localization','التعريب')}
        title={s('Strings','النصوص')}
        sub={loading
          ? s('Loading…','جارٍ التحميل…')
          : `${strings.length} ${s('strings','نص')}`}
        right={<HRButton theme={T} icon="plus">{s('Add string','أضف نصًا')}</HRButton>}/>

      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density}
          title={s('Translation strings','نصوص الترجمة')}
          subtitle={loading ? s('Loading…','جارٍ التحميل…') : `${strings.length} ${s('total','إجمالي')}`}/>
        {loading ? (
          <div style={{ padding: 48, display: 'grid', placeItems: 'center', color: T.textMuted, fontSize: 13 }}>
            {s('Loading…','جارٍ التحميل…')}
          </div>
        ) : strings.length === 0 ? (
          <div style={{ padding: 32, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 600, marginBottom: 6 }}>
              {s('No localization strings yet','لا توجد نصوص بعد')}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted }}>
              {s('Add a localization_strings row to start translating UI copy.','أضف صفًا في localization_strings لبدء الترجمة.')}
            </div>
          </div>
        ) : (
          <div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 2fr 120px',
              padding: `12px ${DENSITY[density].cardPad}px`,
              fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: 0.6, textTransform: 'uppercase',
              borderBottom: `1px solid ${T.divider}`, background: T.panelSunk, gap: 10,
            }}>
              <div>{s('Key','المفتاح')}</div>
              <div>{s('Lang','اللغة')}</div>
              <div>{s('Value','القيمة')}</div>
              <div></div>
            </div>
            {strings.map((str, i) => (
              <StringRow key={`${str.key}-${str.lang}`} theme={T} density={density} lang={lang}
                str={str} isLast={i === strings.length - 1} onSave={save}/>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

export { AdminLocalizationView };
