import React, { useState } from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, Badge } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useGiftCatalog } from '../hooks/use-gift-catalog.js';
import { friendlyErrorI18n } from '../../lib/errors';

// HR Gift Catalog — v2 Sprint 1.
// WH Services tab is fully editable. Amazon + Custom are visual stubs
// until v1.5 (Tremendous + Amazon Voucher API integration).

const TABS = [
  { id: 'wh_service', en: 'WH Services',  ar: 'خدمات WH' },
  { id: 'amazon',     en: 'Amazon',       ar: 'أمازون' },
  { id: 'custom',     en: 'Custom',       ar: 'مخصّص' },
];

function HRGiftCatalogPage({ theme, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { byCategory, loading, error, upsert, deactivate } = useGiftCatalog();
  const [tab, setTab] = useState('wh_service');
  const [editing, setEditing] = useState(null); // {} for new, item for edit, null for none
  const [deactivateError, setDeactivateError] = useState(null);
  const gap = DENSITY[density].gap;

  const handleDeactivate = async (id) => {
    setDeactivateError(null);
    try { await deactivate(id); }
    catch (e) { setDeactivateError(friendlyErrorI18n(e, lang)); }
  };

  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        {s('Loading…', 'جارٍ التحميل…')}
      </div>
    );
  }

  const items = byCategory[tab] || [];
  const isStub = tab !== 'wh_service';

  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Recognition · Rewards', 'التقدير · المكافآت')}
        title={s('Gift catalog', 'كتالوج الهدايا')}
        sub={s('Define the rewards that competitions can grant.',
              'حدّد المكافآت التي يمكن للتحديات منحها.')}
        right={
          tab === 'wh_service' && (
            <HRButton theme={T} variant="primary" icon="plus" onClick={() => setEditing({})}>
              {s('Add WH service', 'إضافة خدمة')}
            </HRButton>
          )
        }
      />

      {error && <ErrorStrip theme={T} lang={lang}/>}

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: gap, padding: 4,
        background: T.panelSunk, borderRadius: 12, width: 'fit-content',
        border: `1px solid ${T.border}`,
      }}>
        {TABS.map(tabDef => {
          const active = tab === tabDef.id;
          const count = (byCategory[tabDef.id] || []).length;
          return (
            <button key={tabDef.id} onClick={() => setTab(tabDef.id)} style={{
              padding: '8px 14px', borderRadius: 8,
              background: active ? T.panel : 'transparent',
              border: 'none', cursor: 'pointer',
              color: active ? T.text : T.textMuted,
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: active ? T.shadowSm : 'none',
            }}>
              {lang === 'ar' ? tabDef.ar : tabDef.en}
              {count > 0 && (
                <span style={{
                  fontSize: 11, padding: '1px 7px', borderRadius: 999,
                  background: active ? T.accentSoft : T.divider,
                  color: active ? T.accent : T.textMuted,
                  fontWeight: 700,
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {isStub ? (
        <StubTab theme={T} tab={tab} lang={lang}/>
      ) : items.length === 0 ? (
        <Panel theme={T} density={density}>
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 500, marginBottom: 6 }}>
              {s('No WH services in your catalog yet', 'لا توجد خدمات WH في الكتالوج')}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>
              {s('Add Sakoon, Sleep Reset, Stress Less, or any custom service you offer.',
                 'أضف ساكون، إعادة ضبط النوم، تقليل الضغط، أو أي خدمة تقدّمها.')}
            </div>
            <HRButton theme={T} variant="primary" icon="plus" onClick={() => setEditing({})}>
              {s('Add your first item', 'أضف أول عنصر')}
            </HRButton>
          </div>
        </Panel>
      ) : (
        <Panel theme={T} density={density}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {items.map(item => (
              <CatalogCard key={item.id} theme={T} lang={lang} item={item}
                onEdit={() => setEditing(item)}
                onDeactivate={() => handleDeactivate(item.id)}/>
            ))}
          </div>
        </Panel>
      )}

      {editing !== null && (
        <CatalogItemEditor
          theme={T} lang={lang}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={async (payload) => {
            // Re-throws so the modal stays open + can render the error.
            await upsert({ ...payload, category: 'wh_service', active: true });
            setEditing(null);
          }}/>
      )}
      {deactivateError && (
        <div role="alert" style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 90,
          padding: '10px 14px', background: T.panel, color: T.danger,
          border: `1px solid ${T.danger}`, borderRadius: 9, fontSize: 12,
          boxShadow: T.shadowMd,
        }}>
          {deactivateError}
        </div>
      )}
    </>
  );
}

function StubTab({ theme, tab, lang }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const message = tab === 'amazon'
    ? s('Amazon vouchers connect via Tremendous (or direct API) in v1.5. For now, manage WH services here and use Custom for ad-hoc rewards.',
        'تتكامل قسائم أمازون عبر Tremendous في الإصدار 1.5. حالياً، أدِر خدمات WH هنا واستخدم المخصّص للمكافآت غير المنتظمة.')
    : s('Custom catalog items (cash, experiences, partner discounts) ship in Sprint 2 alongside the manual claim flow.',
        'العناصر المخصّصة (نقد، تجارب، خصومات الشركاء) ستصدر في Sprint 2 مع تدفق المطالبة اليدوية.');
  return (
    <Panel theme={T} density="comfortable">
      <div style={{ padding: '40px 32px', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 18px',
          background: T.warmSoft, color: T.warm,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <HRIcon name={tab === 'amazon' ? 'globe' : 'plus'} size={28}/>
        </div>
        <div style={{ fontSize: 15, color: T.text, fontWeight: 500, marginBottom: 8 }}>
          {tab === 'amazon' ? s('Amazon vouchers', 'قسائم أمازون') : s('Custom rewards', 'مكافآت مخصّصة')}
        </div>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{message}</div>
      </div>
    </Panel>
  );
}

function CatalogCard({ theme, lang, item, onEdit, onDeactivate }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const name = lang === 'ar' && item.name_ar ? item.name_ar : item.name_en;
  const desc = lang === 'ar' && item.description_ar ? item.description_ar : item.description_en;
  const value = formatMinor(item.value_minor, item.currency, lang);
  return (
    <div style={{
      background: T.panelAlt, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: T.accentSoft, color: T.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <HRIcon name="gifts" size={18}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: T.text, fontWeight: 600, lineHeight: 1.3 }}>{name}</div>
          {desc && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4, lineHeight: 1.4 }}>{desc}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Badge theme={T} tone="neutral">{value}</Badge>
        <div style={{ display: 'flex', gap: 8 }}>
          <HRButton theme={T} variant="ghost" onClick={onEdit}>{s('Edit', 'تحرير')}</HRButton>
          <HRButton theme={T} variant="ghost" onClick={onDeactivate}>{s('Deactivate', 'تعطيل')}</HRButton>
        </div>
      </div>
    </div>
  );
}

function CatalogItemEditor({ theme, lang, initial, onCancel, onSave }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const isNew = !initial.id;
  const [nameEn, setNameEn] = useState(initial.name_en || '');
  const [nameAr, setNameAr] = useState(initial.name_ar || '');
  const [descEn, setDescEn] = useState(initial.description_en || '');
  const [descAr, setDescAr] = useState(initial.description_ar || '');
  const [valueMajor, setValueMajor] = useState(
    initial.value_minor != null ? String(Math.round(initial.value_minor / 100)) : ''
  );
  const [currency, setCurrency] = useState(initial.currency || 'EGP');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const valid = nameEn.trim().length > 0 && /^\d+(\.\d+)?$/.test(valueMajor);

  const handleSave = async () => {
    if (!valid || busy) return;
    setBusy(true); setSaveError(null);
    try {
      await onSave({
        id: initial.id,
        name_en: nameEn.trim(),
        name_ar: nameAr.trim() || null,
        description_en: descEn.trim() || null,
        description_ar: descAr.trim() || null,
        value_minor: Math.round(parseFloat(valueMajor) * 100),
        currency: currency.toUpperCase(),
      });
    } catch (e) {
      setSaveError(friendlyErrorI18n(e, lang));
    } finally { setBusy(false); }
  };

  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.panel, borderRadius: 16, border: `1px solid ${T.border}`,
        width: 'min(520px, 100%)', maxHeight: '90vh', overflow: 'auto',
        padding: 24, boxShadow: T.shadowMd,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 16, color: T.text, fontWeight: 600 }}>
            {isNew ? s('New WH service', 'خدمة WH جديدة') : s('Edit WH service', 'تحرير الخدمة')}
          </div>
          <button onClick={onCancel} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: T.textMuted, padding: 4,
          }}><HRIcon name="close" size={16}/></button>
        </div>

        <Field theme={T} label={s('Name (English)', 'الاسم بالإنجليزية')} required>
          <Input theme={T} value={nameEn} onChange={setNameEn} placeholder={s('Sakoon · 4-week program', '')} />
        </Field>
        <Field theme={T} label={s('Name (Arabic)', 'الاسم بالعربية')}>
          <Input theme={T} value={nameAr} onChange={setNameAr} placeholder="ساكون · برنامج ٤ أسابيع" />
        </Field>
        <Field theme={T} label={s('Description (English)', 'الوصف بالإنجليزية')}>
          <Textarea theme={T} value={descEn} onChange={setDescEn}/>
        </Field>
        <Field theme={T} label={s('Description (Arabic)', 'الوصف بالعربية')}>
          <Textarea theme={T} value={descAr} onChange={setDescAr}/>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <Field theme={T} label={s('Value', 'القيمة')} required>
            <Input theme={T} value={valueMajor} onChange={setValueMajor} placeholder="500" inputMode="decimal"/>
          </Field>
          <Field theme={T} label={s('Currency', 'العملة')}>
            <Input theme={T} value={currency} onChange={setCurrency} placeholder="EGP"/>
          </Field>
        </div>

        {saveError && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: T.panelSunk, border: `1px solid ${T.danger}`, color: T.danger, borderRadius: 9, fontSize: 12 }}>
            {saveError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <HRButton theme={T} variant="secondary" onClick={onCancel}>
            {s('Cancel', 'إلغاء')}
          </HRButton>
          <HRButton theme={T} variant="primary" disabled={!valid || busy} onClick={handleSave}>
            {busy ? s('Saving…', 'جارٍ الحفظ…') : s('Save', 'حفظ')}
          </HRButton>
        </div>
      </div>
    </div>
  );
}

function Field({ theme, label, required, children }) {
  const T = theme;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>
        {label}{required && <span style={{ color: T.danger, marginInlineStart: 3 }}>*</span>}
      </div>
      {children}
    </div>
  );
}

function Input({ theme, value, onChange, placeholder, inputMode }) {
  const T = theme;
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '10px 12px',
        background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
        color: T.text, fontSize: 14, fontFamily: 'inherit', outline: 'none',
      }}/>
  );
}

function Textarea({ theme, value, onChange }) {
  const T = theme;
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '10px 12px',
        background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
        color: T.text, fontSize: 14, fontFamily: 'inherit', outline: 'none',
        resize: 'vertical',
      }}/>
  );
}

function ErrorStrip({ theme, lang }) {
  const T = theme;
  return (
    <div style={{
      padding: '12px 16px', marginBottom: 16, borderRadius: 10,
      background: 'rgba(162,67,43,0.10)', color: T.danger,
      fontSize: 12, fontWeight: 500,
    }}>
      {lang === 'ar' ? 'تعذّر تحميل الكتالوج.' : 'Could not load catalog.'}
    </div>
  );
}

function formatMinor(minor, currency = 'EGP', lang = 'en') {
  const n = Math.round((minor || 0) / 100);
  const formatted = n.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US');
  return `${formatted} ${currency}`;
}

export { HRGiftCatalogPage };
