import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { ContentHealth } from '../sections.jsx';

function AdminContentView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Content library','مكتبة المحتوى')}
        title={s('Catalogue','الكتالوج')}
        sub={s('412 items across 4 languages · 18 in review','٤١٢ عنصر بـ ٤ لغات · ١٨ قيد المراجعة')}
        right={<>
          <HRButton theme={T} variant="secondary" icon="filter">{s('Filter','تصفية')}</HRButton>
          <HRButton theme={T} icon="plus">{s('Upload','رفع')}</HRButton>
        </>}/>

      <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap: DENSITY[density].gap }}>
        <ContentHealth theme={T} density={density} lang={lang}/>
        <Panel theme={T} density={density} pad={false}>
          <PanelHeader theme={T} density={density} title={s('Moderation queue','قائمة الإشراف')} subtitle={s('10 awaiting review','١٠ بانتظار المراجعة')}/>
          <div>
            {[
              { title: s('Stress at work, 5-min reset','استراحة من التوتر في ٥ دقائق'), kind:'audio', author:'Noah K.', flag: s('Pending review','بانتظار المراجعة'), tone:'caution' },
              { title: s('Sleep onset — Arabic localization','بداية النوم — توطين عربي'),  kind:'audio', author:'Layla Q.', flag: s('Translation','ترجمة'), tone:'info' },
              { title: s('Manage burnout (article)','التعامل مع الإرهاق (مقال)'),         kind:'article', author:'Priya S.', flag: s('Awaiting clinical sign-off','بانتظار اعتماد إكلينيكي'), tone:'caution' },
              { title: s('Desk mobility v2','حركات مكتبية v2'),                            kind:'video', author:'Tomás O.', flag: s('Re-encode failed','فشل إعادة التشفير'), tone:'danger' },
            ].map((it, i, arr) => {
              const icon = { audio:'broadcasts', video:'content', article:'reports', breath:'leaf' }[it.kind] || 'content';
              return (
                <div key={i} style={{
                  padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
                  display:'flex', alignItems:'center', gap: 12,
                  borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
                }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:T.panelSunk, display:'grid', placeItems:'center', color:T.textMuted }}>
                    <HRIcon name={icon} size={15}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize: 13, color: T.text, fontWeight: 600, lineHeight:1.3 }}>{it.title}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{it.author}</div>
                  </div>
                  <Badge theme={T} tone={it.tone}>{it.flag}</Badge>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density} title={s('Content catalogue','الكتالوج الكامل')} subtitle={`412 ${s('items','عنصر')}`}
          right={<HRButton theme={T} variant="ghost" size="sm" iconR="chev">{s('All','الكل')}</HRButton>}/>
        <div>
          <div style={{
            display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 36px',
            padding: `12px ${DENSITY[density].cardPad}px`,
            fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: 0.6, textTransform: 'uppercase',
            borderBottom: `1px solid ${T.divider}`, background: T.panelSunk,
          }}>
            <div>{s('Title','العنوان')}</div>
            <div>{s('Type','النوع')}</div>
            <div>{s('Languages','اللغات')}</div>
            <div style={{ textAlign:'end' }}>{s('Plays (30d)','تشغيل (٣٠ي)')}</div>
            <div>{s('Status','حالة')}</div>
            <div></div>
          </div>
          {[
            { title: s('Sleep onset — a cue for tonight','بداية النوم — إشارة لهذه الليلة'), kind:'audio', langs: 'EN · AR · FR', plays: 18420, status:'published' },
            { title: s('3-min reset','استراحة ٣ دقائق'), kind:'breath', langs:'EN · AR', plays: 14210, status:'published' },
            { title: s('Desk mobility flow','حركات مكتبية'), kind:'video', langs:'EN', plays: 11804, status:'published' },
            { title: s('Manage stress at work','إدارة التوتر في العمل'), kind:'article', langs:'EN · AR · FR', plays: 9820, status:'published' },
            { title: s('Box breathing, guided','تنفس مربع، موجَّه'), kind:'audio', langs:'EN · AR', plays: 8120, status:'published' },
            { title: s('Caffeine cut-off, in plain terms','الكافيين بلغة واضحة'), kind:'article', langs:'EN', plays: 6420, status:'review' },
            { title: s('Build an evening wind-down','بناء روتين استرخاء مسائي'), kind:'article', langs:'EN · AR', plays: 5210, status:'draft' },
          ].map((c,i,arr) => {
            const tone = { published:'success', review:'caution', draft:'neutral' }[c.status];
            const lab = { published:s('Published','منشور'), review:s('In review','قيد المراجعة'), draft:s('Draft','مسودة') }[c.status];
            const icon = { audio:'broadcasts', video:'content', article:'reports', breath:'leaf' }[c.kind];
            return (
              <div key={i} style={{
                display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 36px',
                padding: `${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
                fontSize: 13, alignItems: 'center',
                borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                  <div style={{ width:30, height:30, borderRadius:7, background:T.panelSunk, display:'grid', placeItems:'center', color:T.textMuted, flexShrink:0 }}>
                    <HRIcon name={icon} size={14}/>
                  </div>
                  <span style={{ color:T.text, fontWeight: 600 }}>{c.title}</span>
                </div>
                <div style={{ color:T.textMuted, fontSize: 12, textTransform:'capitalize' }}>{c.kind}</div>
                <div style={{ color:T.textMuted, fontSize: 12 }}>{c.langs}</div>
                <div className="mono" style={{ textAlign:'end', color: T.text, fontWeight: 600 }}>{c.plays.toLocaleString()}</div>
                <div><Badge theme={T} tone={tone}>{lab}</Badge></div>
                <button style={{ background:'transparent', border:'none', color:T.textMuted, cursor:'pointer', padding:6 }}>
                  <HRIcon name="more" size={16}/>
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

export { AdminContentView };
