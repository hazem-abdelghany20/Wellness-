import React from 'react';
import { AdminPageHeader } from './_header.jsx';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader } from '../../shared/components.jsx';

function AdminLocalizationView({ theme, density, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const locales = [
    { code:'en', name:'English',  region:'Global',         coverage: 100, items: 412, missing: 0, tone:'success' },
    { code:'ar', name:'العربية',  region:'MENA',           coverage: 96,  items: 396, missing: 16, tone:'success' },
    { code:'fr', name:'Français', region:'Maghreb · EU',   coverage: 64,  items: 264, missing: 148, tone:'caution' },
    { code:'tr', name:'Türkçe',   region:'Türkiye',        coverage: 28,  items: 116, missing: 296, tone:'caution' },
    { code:'de', name:'Deutsch',  region:'EU',             coverage: 12,  items: 48,  missing: 364, tone:'danger' },
  ];
  return (
    <>
      <AdminPageHeader theme={T}
        eyebrow={s('Localization','التعريب')}
        title={s('Languages & coverage','اللغات والتغطية')}
        sub={s('5 locales live · RTL & LTR layouts · clinical review per locale','٥ لغات · تخطيطات RTL/LTR · مراجعة إكلينيكية لكل لغة')}
        right={<HRButton theme={T} icon="plus">{s('Add locale','أضف لغة')}</HRButton>}/>

      <Panel theme={T} density={density} pad={false}>
        <PanelHeader theme={T} density={density} title={s('Translation status','حالة الترجمة')}/>
        <div>
          <div style={{
            display:'grid', gridTemplateColumns:'1.4fr 1fr 1.6fr 1fr 1fr',
            padding:`12px ${DENSITY[density].cardPad}px`,
            fontSize:10, fontWeight:700, color:T.textMuted, letterSpacing:0.6, textTransform:'uppercase',
            borderBottom:`1px solid ${T.divider}`, background:T.panelSunk,
          }}>
            <div>{s('Locale','اللغة')}</div>
            <div>{s('Region','المنطقة')}</div>
            <div>{s('Coverage','التغطية')}</div>
            <div style={{ textAlign:'end' }}>{s('Translated','مترجم')}</div>
            <div style={{ textAlign:'end' }}>{s('Missing','ناقص')}</div>
          </div>
          {locales.map((l,i,arr) => (
            <div key={l.code} style={{
              display:'grid', gridTemplateColumns:'1.4fr 1fr 1.6fr 1fr 1fr',
              padding:`${DENSITY[density].cellPadY + 2}px ${DENSITY[density].cardPad}px`,
              fontSize:13, alignItems:'center',
              borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span className="mono" style={{ fontSize: 11, padding:'2px 6px', borderRadius:5, background:T.panelSunk, color:T.textMuted }}>{l.code.toUpperCase()}</span>
                <span style={{ color: T.text, fontWeight: 600 }}>{l.name}</span>
              </div>
              <div style={{ color: T.textMuted, fontSize: 12 }}>{l.region}</div>
              <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                <div style={{ flex:1, height: 8, background:T.panelSunk, borderRadius: 4, overflow:'hidden' }}>
                  <div style={{ width:`${l.coverage}%`, height:'100%',
                    background: l.coverage > 80 ? '#6FC79B' : l.coverage > 40 ? '#F5B544' : '#E08A6B' }}/>
                </div>
                <span className="mono" style={{ fontSize: 11, color: T.text, fontWeight: 600, minWidth: 36, textAlign:'end' }}>{l.coverage}%</span>
              </div>
              <div className="mono" style={{ textAlign:'end', color: T.text }}>{l.items}</div>
              <div className="mono" style={{ textAlign:'end', color: l.missing === 0 ? T.textFaint : T.text }}>{l.missing}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

export { AdminLocalizationView };
