import React from 'react';
import { DENSITY } from '../tokens.jsx';
import { HRButton, Panel } from '../components.jsx';
import { HRPageHeader } from './_header.jsx';

// ── BROADCASTS PAGE ──────────────────────────────────────────────
function HRBroadcastsPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [draft, setDraft] = React.useState(s('Reach out — Support Tier 2','تواصل — دعم المستوى ٢'));
  const [body, setBody] = React.useState(s("We've noticed elevated stress signals in your team this week. Here's a 3-min reset to try together. Not mandatory.",'لاحظنا إشارات توتر مرتفعة في فريقكم هذا الأسبوع. إليكم استراحة ٣ دقائق للتجربة معًا.'));
  const [segment, setSegment] = React.useState('team');
  const history = [
    { title: s('Ramadan wind-down tips','نصائح الاسترخاء الرمضانية'), segment: s('All staff · 487','كل الموظفين · ٤٨٧'), opens: 78, sent: s('Mon · 09:00','الإثنين · ٠٩:٠٠') },
    { title: s('Mindfulness week starts Monday','أسبوع اليقظة يبدأ الإثنين'), segment: s('Egypt · all depts','مصر · كل الأقسام'), opens: 64, sent: 'Apr 15' },
    { title: s('Lunch break reminder','تذكير استراحة الغداء'),       segment: s('Tier 2 · 28','المستوى ٢ · ٢٨'), opens: 92, sent: 'Apr 12' },
    { title: s('Quarterly wellness review','مراجعة الرفاهية الفصلية'), segment: s('Managers · 34','المدراء · ٣٤'), opens: 55, sent: 'Apr 02' },
  ];
  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Org communications','اتصالات المنظمة')}
        title={s('Broadcasts','البث')}
        sub={s('In-app nudges and announcements · respects quiet hours','تنبيهات داخل التطبيق · تحترم ساعات الهدوء')}/>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: DENSITY[density].gap }}>
        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>{s('Compose','إنشاء')}</div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Title','العنوان')}</div>
            <input value={draft} onChange={(e)=>setDraft(e.target.value)} style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
              color: T.text, fontSize: 14, fontFamily: 'inherit', outline: 'none',
            }}/>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Message','الرسالة')}</div>
            <textarea value={body} onChange={(e)=>setBody(e.target.value)} rows={5} style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
              color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5,
            }}/>
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 8 }}>{s('Audience','الجمهور')}</div>
            <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}`, width: 'fit-content' }}>
              {[['all',s('All staff','كل الموظفين')],['dept',s('A department','قسم')],['team',s('A team','فريق')]].map(([k,l])=>(
                <button key={k} onClick={()=>setSegment(k)} style={{
                  padding: '7px 12px', borderRadius: 7, border: 'none',
                  background: segment===k ? T.panel : 'transparent',
                  color: segment===k ? T.text : T.textMuted,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <HRButton theme={T} variant="secondary">{s('Save draft','حفظ مسودة')}</HRButton>
            <HRButton theme={T} variant="secondary" icon="calendar">{s('Schedule','جدولة')}</HRButton>
            <div style={{ flex: 1 }}/>
            <HRButton theme={T} variant="primary" icon="broadcasts">{s('Send now','أرسل الآن')}</HRButton>
          </div>
        </Panel>

        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>{s('Preview · in-app','معاينة · داخل التطبيق')}</div>
          <div style={{ background: '#0E2A26', borderRadius: 18, padding: 20, color: '#F5F1E8', minHeight: 200, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <img src="assets/wellness-mark.png" alt="" style={{ height: 16, filter: 'brightness(0) invert(1)' }}/>
              <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 600, letterSpacing: 0.3 }}>WELLNESS+ · {s('From your HR team','من فريق الموارد البشرية')}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: -0.2 }}>{draft}</div>
            <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.55 }}>{body}</div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <span style={{ padding: '7px 12px', borderRadius: 8, background: '#F5B544', color: '#0E2A26', fontSize: 12, fontWeight: 700 }}>{s('Try it','جرّب')}</span>
              <span style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', color: '#F5F1E8', fontSize: 12, fontWeight: 600 }}>{s('Later','لاحقًا')}</span>
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: T.textMuted }}>
            {s('Estimated reach: ','تقدير الوصول: ')}
            <strong style={{ color: T.text }}>{segment === 'all' ? '487' : segment === 'dept' ? '~120' : '28'}</strong>
            {s(' · sent at next allowed hour (08:00–20:00)',' · يُرسل في الساعة المسموحة التالية (٠٨:٠٠–٢٠:٠٠)')}
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: DENSITY[density].gap, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 12 }}>{s('Sent recently','مُرسل حديثًا')}</div>
      <Panel theme={T} density={density} pad={false}>
        {history.map((h, i) => (
          <div key={i} style={{
            padding: '14px 18px', display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr 0.8fr', gap: 12, alignItems: 'center',
            borderBottom: i < history.length - 1 ? `1px solid ${T.divider}` : 'none',
          }}>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{h.title}</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>{h.segment}</div>
            <div>
              <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 700 }}>{s('Open rate','معدل الفتح')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{h.opens}%</span>
                <div style={{ flex: 1, height: 4, background: T.panelSunk, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${h.opens}%`, height: '100%', background: T.accent }}/>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: T.textMid, textAlign: 'end' }}>{h.sent}</div>
          </div>
        ))}
      </Panel>
    </>
  );
}

export { HRBroadcastsPage };
