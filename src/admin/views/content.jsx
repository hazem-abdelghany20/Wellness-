import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { useContent } from '../hooks/use-content.js';

function ContentRow({ theme, density, lang, item, isLast, onUpdate }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [title, setTitle] = React.useState(item.title_en || item.title || '');
  const [status, setStatus] = React.useState(item.status || 'published');
  const [err, setErr] = React.useState(null);

  const tone = { published:'success', review:'caution', draft:'neutral' }[status] || 'neutral';
  const lab = {
    published: s('Published','منشور'),
    review:    s('In review','قيد المراجعة'),
    draft:     s('Draft','مسودة'),
  }[status] || status;
  const icon = { audio:'broadcasts', video:'content', article:'reports', breath:'leaf' }[item.kind] || 'content';

  async function save() {
    setBusy(true); setErr(null);
    try {
      await onUpdate(item.id, { title_en: title, status });
      setEditing(false);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    height: 30, padding: '0 10px', borderRadius: 8,
    background: T.panelSunk, border: `1px solid ${T.border}`,
    color: T.text, fontSize: 12, outline: 'none',
  };

  return (
    <div style={{
      display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 90px',
      padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
      fontSize: 13, alignItems: 'center',
      borderBottom: isLast ? 'none' : `1px solid ${T.divider}`,
      gap: 10,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
        <div style={{ width:30, height:30, borderRadius:7, background:T.panelSunk, display:'grid', placeItems:'center', color:T.textMuted, flexShrink:0 }}>
          <HRIcon name={icon} size={14}/>
        </div>
        {editing ? (
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}/>
        ) : (
          <span style={{ color:T.text, fontWeight: 600 }}>{title || s('(untitled)','(بلا عنوان)')}</span>
        )}
      </div>
      <div style={{ color:T.textMuted, fontSize: 12, textTransform:'capitalize' }}>{item.kind || '—'}</div>
      <div className="mono" style={{ color:T.textMuted, fontSize: 11 }}>{item.locale || item.lang || '—'}</div>
      <div className="mono" style={{ textAlign:'end', color: T.text, fontWeight: 600 }}>
        {(item.plays_30d ?? item.plays ?? 0).toLocaleString()}
      </div>
      <div>
        {editing ? (
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            <option value="draft">draft</option>
            <option value="review">review</option>
            <option value="published">published</option>
          </select>
        ) : (
          <Badge theme={T} tone={tone}>{lab}</Badge>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        {editing ? (
          <>
            <HRButton theme={T} variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(false)}>
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

function AdminContentView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { items, loading, update } = useContent();

  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Content library','مكتبة المحتوى')}
        title={s('Catalogue','الكتالوج')}
        sub={loading
          ? s('Loading…','جارٍ التحميل…')
          : `${items.length} ${s('items','عنصر')}`}
        right={<>
          <HRButton theme={T} variant="secondary" icon="filter">{s('Filter','تصفية')}</HRButton>
          <HRButton theme={T} icon="plus">{s('Upload','رفع')}</HRButton>
        </>}/>

      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density}
          title={s('Content catalogue','الكتالوج الكامل')}
          subtitle={loading ? s('Loading…','جارٍ التحميل…') : `${items.length} ${s('items','عنصر')}`}
          right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{s('All','الكل')}</HRButton>}/>
        {loading ? (
          <div style={{ padding: 48, display: 'grid', placeItems: 'center', color: T.textMuted, fontSize: 13 }}>
            {s('Loading…','جارٍ التحميل…')}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 32, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
            {s('No content yet.','لا يوجد محتوى بعد.')}
          </div>
        ) : (
          <div>
            <div style={{
              display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 90px',
              padding: `12px ${DENSITY[density].cardPad}px`,
              fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: 0.6, textTransform: 'uppercase',
              borderBottom: `1px solid ${T.divider}`, background: T.panelSunk, gap: 10,
            }}>
              <div>{s('Title','العنوان')}</div>
              <div>{s('Type','النوع')}</div>
              <div>{s('Locale','اللغة')}</div>
              <div style={{ textAlign:'end' }}>{s('Plays','تشغيل')}</div>
              <div>{s('Status','حالة')}</div>
              <div></div>
            </div>
            {items.map((item, i) => (
              <ContentRow key={item.id || i} theme={T} density={density} lang={lang}
                item={item} isLast={i === items.length - 1} onUpdate={update}/>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

export { AdminContentView };
