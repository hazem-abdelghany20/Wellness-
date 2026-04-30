import React, { useState } from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRIcon, HRButton, Panel, Badge } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useChallenges } from '../hooks/use-challenges.js';

// ── CHALLENGES PAGE ──────────────────────────────────────────────
function HRChallengesPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { templates, loading, schedule } = useChallenges();
  const [selectedId, setSelectedId] = useState(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [scope, setScope] = useState('all');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        {s('Loading…','جارٍ التحميل…')}
      </div>
    );
  }

  const list = templates || [];
  const today = new Date().toISOString().slice(0, 10);
  const active = list.filter(c => c.active && c.end_date >= today);
  const past = list.filter(c => !c.active || c.end_date < today);

  const selected = list.find(c => c.id === selectedId) || null;

  const handleSchedule = async () => {
    if (!selected || !start || !end) return;
    setBusy(true); setFlash(null);
    try {
      await schedule(
        {
          title:       lang === 'ar' ? (selected.title_ar || selected.title_en) : selected.title_en,
          description: lang === 'ar' ? (selected.description_ar || selected.description_en) : selected.description_en,
          kind:        selected.kind || 'team',
          metric:      selected.metric || 'checkins',
          target:      selected.goal_value || 10,
        },
        { start, end },
        scope,
        undefined
      );
      setFlash({ kind: 'ok' });
      setSelectedId(null);
      setStart(''); setEnd('');
    } catch (e) {
      setFlash({ kind: 'err', message: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Active + drafts','نشطة + مسودات')}
        title={s('Challenges','التحديات')}
        sub={`${active.length} ${s('active · ',`نشطة · `)}${past.length} ${s('past','سابقة')}`}
        right={<HRButton theme={T} variant="primary" icon="plus">{S.newChallenge}</HRButton>}/>

      <Panel theme={T} density={density} style={{ marginBottom: DENSITY[density].gap }}>
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>
          {s('Schedule a challenge','جدولة تحدي')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Template','القالب')}</div>
            <select value={selectedId || ''} onChange={(e)=>setSelectedId(e.target.value || null)} style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px',
              background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
              color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
            }}>
              <option value="">{s('Select template…','اختر قالبًا…')}</option>
              {list.map(c => (
                <option key={c.id} value={c.id}>
                  {lang === 'ar' ? (c.title_ar || c.title_en) : c.title_en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Start','البداية')}</div>
            <input type="date" value={start} onChange={(e)=>setStart(e.target.value)} style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px',
              background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
              color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
            }}/>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('End','النهاية')}</div>
            <input type="date" value={end} onChange={(e)=>setEnd(e.target.value)} style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px',
              background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
              color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
            }}/>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Scope','النطاق')}</div>
            <select value={scope} onChange={(e)=>setScope(e.target.value)} style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px',
              background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
              color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
            }}>
              <option value="all">{s('All staff','كل الموظفين')}</option>
              <option value="team">{s('A team','فريق')}</option>
            </select>
          </div>
          <HRButton theme={T} variant="primary" disabled={!selected || !start || !end || busy} onClick={handleSchedule}>
            {busy ? s('Scheduling…','جارٍ الجدولة…') : s('Schedule','جدولة')}
          </HRButton>
        </div>
        {flash && (
          <div style={{ marginTop: 12, fontSize: 12, color: flash.kind === 'ok' ? T.positive : T.danger }}>
            {flash.kind === 'ok' ? s('Challenge scheduled.','تمت جدولة التحدي.') : s('Failed to schedule.','تعذّرت الجدولة.')}
          </div>
        )}
      </Panel>

      <div style={{ marginBottom: 12, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s('Active','نشطة')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: DENSITY[density].gap, marginBottom: DENSITY[density].gap }}>
        {active.map((c) => {
          const title = lang === 'ar' ? (c.title_ar || c.title_en) : c.title_en;
          const desc = lang === 'ar' ? (c.description_ar || c.description_en || '') : (c.description_en || '');
          return (
            <Panel key={c.id} theme={T} density={density}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <Badge theme={T} tone="neutral">{c.metric}</Badge>
                <span style={{ fontSize: 11, color: T.textMuted }}>{c.start_date} → {c.end_date}</span>
              </div>
              <div style={{ fontSize: 17, color: T.text, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 18 }}>{desc}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.divider}` }}>
                <div>
                  <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>{s('Goal','الهدف')}</div>
                  <div className="mono" style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{c.goal_value}</div>
                </div>
                <HRButton theme={T} variant="ghost" size="sm">{s('Manage','إدارة')}</HRButton>
              </div>
            </Panel>
          );
        })}
        {active.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '40px 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
            {s('No active challenges.','لا توجد تحديات نشطة.')}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s('Past','سابقة')}</div>
      <Panel theme={T} density={density} pad={false}>
        {past.map((c, i) => {
          const title = lang === 'ar' ? (c.title_ar || c.title_en) : c.title_en;
          return (
            <div key={c.id} style={{
              padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
              borderBottom: i < past.length - 1 ? `1px solid ${T.divider}` : 'none',
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: T.panelSunk, display: 'grid', placeItems: 'center' }}>
                <HRIcon name="challenges" size={18} stroke={T.textMuted}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{c.metric} · {c.start_date} → {c.end_date}</div>
              </div>
              <HRButton theme={T} variant="secondary" size="sm">{s('View','عرض')}</HRButton>
            </div>
          );
        })}
        {past.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
            {s('No past challenges.','لا توجد تحديات سابقة.')}
          </div>
        )}
      </Panel>
    </>
  );
}

export { HRChallengesPage };
