import React from 'react';
import { HRIcon } from '../shared/components.jsx';

function TweakRow({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(128,128,128,0.6)', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function SegBtn({ theme, active, onClick, children }) {
  const T = theme;
  return (
    <button onClick={onClick} style={{
      flex: 1, height: 30, padding: '0 8px', borderRadius: 7, minWidth: 50,
      background: active ? T.accent : T.panelSunk,
      color: active ? T.accentInk : T.text,
      border: `1px solid ${active ? 'transparent' : T.border}`,
      fontSize: 11, fontWeight: 600, cursor: 'pointer',
    }}>{children}</button>
  );
}

export function TweaksPanel({
  theme, lang, density, chartStyle, layout, themeKey,
  setThemeKey, setLang, setDensity, setChartStyle, setLayout,
  setT, S, onClose,
}) {
  const T = theme;
  const s = S || ((en, ar) => lang === 'ar' ? ar : en);
  return (
    <div style={{
      position: 'fixed', bottom: 18, insetInlineEnd: 18, width: 300,
      background: T.panel, color: T.text, borderRadius: 16,
      border: `1px solid ${T.borderStrong}`, boxShadow: T.shadowMd,
      zIndex: 100, overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{s('Tweaks','التعديلات')}</div>
        <button onClick={onClose}
          style={{ background:'transparent', border:'none', color:T.textMuted, cursor:'pointer' }}>
          <HRIcon name="close" size={16}/>
        </button>
      </div>
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TweakRow label={s('Theme','المظهر')}>
          {[['dark','Dark'],['light','Light']].map(([k,l])=>(
            <SegBtn key={k} theme={T} active={themeKey===k} onClick={()=>setT('themeKey',setThemeKey)(k)}>{l}</SegBtn>
          ))}
        </TweakRow>
        <TweakRow label={s('Language','اللغة')}>
          {[['en','EN'],['ar','AR']].map(([k,l])=>(
            <SegBtn key={k} theme={T} active={lang===k} onClick={()=>setT('lang',setLang)(k)}>{l}</SegBtn>
          ))}
        </TweakRow>
        <TweakRow label={s('Density','الكثافة')}>
          {[['compact',s('Compact','مكثف')],['comfortable',s('Comfortable','مريح')]].map(([k,l])=>(
            <SegBtn key={k} theme={T} active={density===k} onClick={()=>setT('density',setDensity)(k)}>{l}</SegBtn>
          ))}
        </TweakRow>
        <TweakRow label={s('Chart','الرسم')}>
          {[['line',s('Line','خط')],['area',s('Area','مساحة')],['bar',s('Bar','عمود')]].map(([k,l])=>(
            <SegBtn key={k} theme={T} active={chartStyle===k} onClick={()=>setT('chartStyle',setChartStyle)(k)}>{l}</SegBtn>
          ))}
        </TweakRow>
        <TweakRow label={s('Layout','التخطيط')}>
          {[['default',s('Default','افتراضي')],['wide',s('Wide','واسع')],['split',s('Split','مقسم')]].map(([k,l])=>(
            <SegBtn key={k} theme={T} active={layout===k} onClick={()=>setT('layout',setLayout)(k)}>{l}</SegBtn>
          ))}
        </TweakRow>
      </div>
    </div>
  );
}
