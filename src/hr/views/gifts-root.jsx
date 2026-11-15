import React, { useState } from 'react';
import { HRGiftsOverview } from './gifts.jsx';
import { HRGiftCatalogPage } from './gifts-catalog.jsx';
import { HRGiftTiersPage } from './gifts-tiers.jsx';

// Sub-section router for Gifts: overview, catalog (HR's own rewards, no
// money value needed) and tier rewards. Budget pools are not built.

function HRGiftsRoot({ theme, S, lang, density }) {
  const T = theme;
  const [section, setSection] = useState('overview');
  const s = (en, ar) => lang === 'ar' ? ar : en;

  const sections = [
    { id: 'overview', en: 'Overview',         ar: 'نظرة عامة' },
    { id: 'catalog',  en: 'Catalog',          ar: 'الكتالوج' },
    { id: 'tiers',    en: 'Tier rewards',     ar: 'مكافآت المراحل' },
    { id: 'pools',    en: 'Pools',            ar: 'الأحواض' },
  ];

  return (
    <>
      {/* Sub-tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 22, padding: 4,
        background: T.panelSunk, borderRadius: 12,
        border: `1px solid ${T.border}`, width: 'fit-content',
      }}>
        {sections.map(sec => {
          const active = section === sec.id;
          const stub = sec.id === 'pools';
          return (
            <button key={sec.id} onClick={() => setSection(sec.id)} style={{
              padding: '8px 16px', borderRadius: 8,
              background: active ? T.panel : 'transparent',
              border: 'none', cursor: 'pointer',
              color: active ? T.text : (stub ? T.textFaint : T.textMuted),
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              boxShadow: active ? T.shadowSm : 'none',
            }}>
              {lang === 'ar' ? sec.ar : sec.en}
              {stub && <span style={{ fontSize: 9, marginInlineStart: 6, color: T.textFaint }}>{s('soon', 'قريباً')}</span>}
            </button>
          );
        })}
      </div>

      {section === 'overview' && (
        <HRGiftsOverview theme={T} S={S} lang={lang} density={density}
          onSection={(id) => setSection(id === 'catalog' ? 'catalog' : id)}/>
      )}
      {section === 'catalog' && (
        <HRGiftCatalogPage theme={T} lang={lang} density={density}/>
      )}
      {section === 'tiers' && (
        <HRGiftTiersPage theme={T} lang={lang} density={density}/>
      )}
      {section === 'pools' && (
        <ComingSoon theme={T} lang={lang}
          title={s('Gift pools', 'أحواض الهدايا')}
          desc={s('Budget pools are not available yet, and rewards don’t need a budget. Add your own rewards in Catalog: a thank-you note, an early leave, a team lunch.',
                 'أحواض الميزانية غير متاحة بعد، والمكافآت لا تحتاج ميزانية. أضف مكافآتك الخاصة من الكتالوج: رسالة شكر، انصراف مبكر، غداء للفريق.')}/>
      )}
    </>
  );
}

function ComingSoon({ theme, lang, title, desc }) {
  const T = theme;
  return (
    <div style={{
      padding: '60px 24px', textAlign: 'center',
      background: T.panel, border: `1px dashed ${T.border}`, borderRadius: 14,
      maxWidth: 560, margin: '40px auto',
    }}>
      <div style={{ fontSize: 16, color: T.text, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

export { HRGiftsRoot };
