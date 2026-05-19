import React, { useState, useEffect } from 'react';
import { DENSITY, tierToken } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, Toggle } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useTierConfig, TIER_LIST } from '../hooks/use-tier-config.js';
import { useGiftCatalog } from '../hooks/use-gift-catalog.js';
import { friendlyErrorI18n } from '../../lib/errors';

// HR per-competition tier configuration — v2 Sprint 2.
// HR picks a competition then configures Bronze/Silver/Gold:
// either a single fixed reward, or "allow employee choice" with
// 2+ catalog items the employee picks from.

function HRGiftTiersPage({ theme, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const [competitionId, setCompetitionId] = useState(null);
  const { tierMap, competitions, loading, error, save } = useTierConfig(competitionId);
  const { items: catalog } = useGiftCatalog();
  const gap = DENSITY[density].gap;

  // Seed default selection when competitions load.
  useEffect(() => {
    if (!competitionId && competitions.length) {
      setCompetitionId(competitions[0].id);
    }
  }, [competitions, competitionId]);

  const activeCatalog = catalog.filter(i => i.active);

  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Recognition · Rewards', 'التقدير · المكافآت')}
        title={s('Tier rewards', 'مكافآت المراحل')}
        sub={s('Map Bronze, Silver, and Gold to a fixed reward — or let employees choose from a curated list.',
              'اربط البرونزي والفضي والذهبي بمكافأة ثابتة — أو دع الموظفين يختارون من قائمة منسّقة.')}/>

      {error && <ErrorStrip theme={T} lang={lang}/>}

      {/* Competition selector */}
      <Panel theme={T} density={density} style={{ marginBottom: gap }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 12, color: T.textMid, fontWeight: 600 }}>
            {s('Competition', 'التحدي')}
          </div>
          <select
            value={competitionId || ''}
            onChange={(e) => setCompetitionId(e.target.value || null)}
            style={{
              flex: 1, padding: '10px 12px',
              background: T.panelSunk, border: `1px solid ${T.border}`,
              borderRadius: 9, color: T.text, fontSize: 14, fontFamily: 'inherit',
              outline: 'none',
            }}>
            <option value="">{s('— Select competition —', '— اختر التحدي —')}</option>
            {competitions.map(c => (
              <option key={c.id} value={c.id}>
                {c.title || c.title_en || c.id}
                {c.start_date ? ` · ${c.start_date}` : ''}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      {!competitionId ? (
        <NoSelection theme={T} lang={lang}/>
      ) : loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
          {s('Loading…', 'جارٍ التحميل…')}
        </div>
      ) : activeCatalog.length === 0 ? (
        <EmptyCatalog theme={T} lang={lang}/>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap }}>
          {TIER_LIST.map(tier => (
            <TierCard
              key={tier}
              theme={T} lang={lang}
              tier={tier}
              config={tierMap[tier]}
              catalog={activeCatalog}
              onSave={save}/>
          ))}
        </div>
      )}
    </>
  );
}

function TierCard({ theme, lang, tier, config, catalog, onSave }) {
  const T = theme;
  const tk = tierToken(tier);
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const tierLabel = tk.label[lang === 'ar' ? 'ar' : 'en'];

  const [allowChoice, setAllowChoice] = useState(config.allow_employee_choice);
  const [singleItem, setSingleItem] = useState(config.gift_catalog_item_id || '');
  const [choiceSet, setChoiceSet] = useState(new Set(config.choice_options || []));
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  // Re-sync when the config prop changes (e.g. after save).
  useEffect(() => {
    setAllowChoice(config.allow_employee_choice);
    setSingleItem(config.gift_catalog_item_id || '');
    setChoiceSet(new Set(config.choice_options || []));
  }, [config]);

  const toggleChoice = (id) => {
    setChoiceSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const valid = allowChoice
    ? choiceSet.size >= 2
    : Boolean(singleItem);

  const handleSave = async () => {
    if (!valid || busy) return;
    setBusy(true); setFlash(null);
    try {
      await onSave({
        tier,
        gift_catalog_item_id: allowChoice ? null : singleItem,
        allow_employee_choice: allowChoice,
        choice_options: allowChoice ? Array.from(choiceSet) : [],
      });
      setFlash({ kind: 'ok', text: s('Saved', 'تم الحفظ') });
    } catch (e) {
      setFlash({ kind: 'err', text: friendlyErrorI18n(e, lang) });
    } finally {
      setBusy(false);
    }
  };

  const dirty =
    allowChoice !== config.allow_employee_choice ||
    singleItem !== (config.gift_catalog_item_id || '') ||
    !setEq(choiceSet, new Set(config.choice_options || []));

  return (
    <Panel theme={T} density="comfortable" style={{
      borderTop: `3px solid ${tk.accent}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: tk.accentSoft, color: tk.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <HRIcon name="star" size={18}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 16, color: T.text, fontWeight: 600, lineHeight: 1,
          }}>{tierLabel}</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
            {tier === 'gold' ? s('21+ day streak', 'سلسلة ٢١ يوماً+')
             : tier === 'silver' ? s('7–20 day streak', 'سلسلة ٧-٢٠ يوماً')
             : s('1–6 day streak', 'سلسلة ١-٦ أيام')}
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, color: T.textMid, fontWeight: 500, flex: 1 }}>
          {s('Allow employee to choose', 'دع الموظف يختار')}
        </div>
        <Toggle theme={T} value={allowChoice} onChange={setAllowChoice}/>
      </div>

      {!allowChoice ? (
        <div>
          <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>
            {s('Reward', 'المكافأة')}
          </div>
          <select value={singleItem} onChange={(e) => setSingleItem(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              background: T.panelSunk, border: `1px solid ${T.border}`,
              borderRadius: 9, color: T.text, fontSize: 14, fontFamily: 'inherit',
              outline: 'none',
            }}>
            <option value="">{s('— Pick a reward —', '— اختر مكافأة —')}</option>
            {catalog.map(it => (
              <option key={it.id} value={it.id}>
                {(lang === 'ar' && it.name_ar) ? it.name_ar : it.name_en}
                {' · '}{Math.round((it.value_minor || 0) / 100)} {it.currency}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 8 }}>
            {s('Options employee can choose from', 'خيارات يمكن للموظف الاختيار منها')}
          </div>
          <div style={{
            background: T.panelSunk, border: `1px solid ${T.border}`,
            borderRadius: 9, padding: 10, maxHeight: 220, overflow: 'auto',
          }}>
            {catalog.map(it => {
              const checked = choiceSet.has(it.id);
              return (
                <label key={it.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 6px', cursor: 'pointer', borderRadius: 6,
                  background: checked ? T.accentSoft : 'transparent',
                }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleChoice(it.id)}
                    style={{ accentColor: T.accent, cursor: 'pointer' }}/>
                  <span style={{ flex: 1, fontSize: 13, color: T.text }}>
                    {(lang === 'ar' && it.name_ar) ? it.name_ar : it.name_en}
                  </span>
                  <span style={{ fontSize: 11, color: T.textMuted }}>
                    {Math.round((it.value_minor || 0) / 100)} {it.currency}
                  </span>
                </label>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
            {choiceSet.size < 2
              ? s('Pick at least 2 options', 'اختر خيارَين على الأقل')
              : s(`${choiceSet.size} options selected`, `${choiceSet.size} خيارات محدّدة`)}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
        <HRButton theme={T} variant="primary" disabled={!valid || !dirty || busy} onClick={handleSave}>
          {busy ? s('Saving…', 'جارٍ الحفظ…') : s('Save', 'حفظ')}
        </HRButton>
        {flash && (
          <div style={{
            fontSize: 12,
            color: flash.kind === 'ok' ? T.positive : T.danger,
          }}>{flash.text}</div>
        )}
      </div>
    </Panel>
  );
}

function NoSelection({ theme, lang }) {
  const T = theme;
  return (
    <Panel theme={T} density="comfortable">
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: T.textMuted }}>
          {lang === 'ar' ? 'اختر تحدياً للبدء.' : 'Pick a competition to begin.'}
        </div>
      </div>
    </Panel>
  );
}

function EmptyCatalog({ theme, lang }) {
  const T = theme;
  return (
    <Panel theme={T} density="comfortable">
      <div style={{ padding: '40px 24px', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
        <div style={{ fontSize: 14, color: T.text, fontWeight: 500, marginBottom: 6 }}>
          {lang === 'ar' ? 'الكتالوج فارغ' : 'Catalog is empty'}
        </div>
        <div style={{ fontSize: 12, color: T.textMuted }}>
          {lang === 'ar'
            ? 'أضف خدمات WH أولاً من تبويب الكتالوج لتتمكّن من ربطها بالمراحل.'
            : 'Add WH services in the Catalog tab first, then return here to map them.'}
        </div>
      </div>
    </Panel>
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
      {lang === 'ar' ? 'تعذّر تحميل إعدادات المراحل.' : 'Could not load tier configurations.'}
    </div>
  );
}

function setEq(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export { HRGiftTiersPage };
