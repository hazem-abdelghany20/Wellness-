import React, { useState } from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, Badge } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useContent } from '../hooks/use-content.js';

// ── CONTENT PAGE ─────────────────────────────────────────────────
function HRContentPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { items, loading, assign } = useContent();
  const [tab, setTab] = useState('library');
  const [busyId, setBusyId] = useState(null);
  const [flash, setFlash] = useState(null);

  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        {s('Loading…','جارٍ التحميل…')}
      </div>
    );
  }

  const iconFor = { audio: 'headphones', video: 'play', article: 'book' };

  const library = (items || []).map(c => ({
    id:      c.id,
    kind:    c.kind || 'article',
    title:   lang === 'ar' ? (c.title_ar || c.title_en) : (c.title_en || c.title_ar || '—'),
    mins:    c.duration_mins ?? 0,
    cat:     c.category || s('General','عام'),
    pinned:  !!c.featured,
  }));

  const visible = library.filter(c => tab !== 'pinned' || c.pinned);

  const handleAssign = async (id) => {
    setBusyId(id); setFlash(null);
    try {
      await assign(id, 'all');
      setFlash({ id, kind: 'ok' });
    } catch (e) {
      setFlash({ id, kind: 'err' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Content library','مكتبة المحتوى')}
        title={s('Content','المحتوى')}
        sub={`${library.length} ${s('items in library','عناصر في المكتبة')}`}
        right={<><HRButton theme={T} variant="secondary" icon="content">{s('Request item','طلب محتوى')}</HRButton><HRButton theme={T} variant="primary" icon="plus">{s('Pin to org','تثبيت')}</HRButton></>}/>

      <div style={{ display: 'flex', gap: 4, marginBottom: DENSITY[density].gap, background: T.panelSunk, padding: 4, borderRadius: 10, border: `1px solid ${T.border}`, width: 'fit-content' }}>
        {[['library',s('All library','كل المكتبة')],['pinned',s('Pinned','مثبَّت')]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{
            padding: '8px 16px', borderRadius: 7, border: 'none',
            background: tab===k ? T.panel : 'transparent',
            color: tab===k ? T.text : T.textMuted,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: DENSITY[density].gap }}>
        {visible.map((c) => (
          <Panel key={c.id} theme={T} density={density}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: T.panelSunk, display: 'grid', placeItems: 'center' }}>
                <HRIcon name={iconFor[c.kind] || 'book'} size={22} stroke={T.accent}/>
              </div>
              {c.pinned && <Badge theme={T} tone="info" dot>{s('Pinned','مثبَّت')}</Badge>}
            </div>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 700, lineHeight: 1.35, marginBottom: 6 }}>{c.title}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{c.cat} · {c.mins} {s('min','د')}</div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: flash?.id === c.id ? (flash.kind === 'ok' ? T.positive : T.danger) : T.textFaint }}>
                {flash?.id === c.id ? (flash.kind === 'ok' ? s('Assigned','تم التعيين') : s('Error','خطأ')) : ''}
              </span>
              <HRButton theme={T} variant="secondary" size="sm" disabled={busyId === c.id}
                onClick={() => handleAssign(c.id)}>
                {busyId === c.id ? s('Assigning…','جاري التعيين…') : s('Assign to all','تعيين للكل')}
              </HRButton>
            </div>
          </Panel>
        ))}
        {visible.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '40px 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
            {s('No content items in this view.','لا يوجد محتوى في هذا العرض.')}
          </div>
        )}
      </div>
    </>
  );
}

export { HRContentPage };
