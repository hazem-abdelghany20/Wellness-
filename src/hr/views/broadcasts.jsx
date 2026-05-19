import React, { useState } from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, Badge } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useBroadcasts } from '../hooks/use-broadcasts.js';
import { useTeams } from '../hooks/use-teams.js';
import { friendlyErrorI18n } from '../../lib/errors';

// ── BROADCASTS PAGE ──────────────────────────────────────────────
function HRBroadcastsPage({ theme, S, lang, density }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { list, loading, schedule, cancel } = useBroadcasts();
  const { teams } = useTeams();

  const [titleEn, setTitleEn] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [bodyEn,  setBodyEn]  = useState('');
  const [bodyAr,  setBodyAr]  = useState('');
  const [segment, setSegment] = useState('all');
  const [teamId, setTeamId] = useState('');
  const [when, setWhen] = useState(''); // datetime-local
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        {s('Loading…','جارٍ التحميل…')}
      </div>
    );
  }

  const grouped = {
    scheduled: (list || []).filter(b => b.status === 'scheduled'),
    sent:      (list || []).filter(b => b.status === 'sent'),
    cancelled: (list || []).filter(b => b.status === 'cancelled'),
  };

  const handleSchedule = async () => {
    if (!titleEn || !bodyEn || !when) return;
    if (segment === 'team' && !teamId) {
      setFlash({ kind: 'err', message: s('Pick a team first.', 'اختر فريقاً أولاً.') });
      return;
    }
    setBusy(true); setFlash(null);
    try {
      await schedule({
        title_en: titleEn,
        title_ar: titleAr || null,
        body_en:  bodyEn,
        body_ar:  bodyAr || null,
        scope:    segment === 'all' ? 'all' : 'team',
        team_id:  segment === 'team' ? teamId : null,
        scheduled_at: new Date(when).toISOString(),
      });
      setFlash({ kind: 'ok' });
      setTitleEn(''); setTitleAr(''); setBodyEn(''); setBodyAr(''); setWhen(''); setTeamId('');
    } catch (e) {
      setFlash({ kind: 'err', message: friendlyErrorI18n(e, lang) });
    } finally {
      setBusy(false);
    }
  };

  const [cancelError, setCancelError] = useState(null);
  const handleCancel = async (id) => {
    setCancelError(null);
    try { await cancel(id); }
    catch (e) { setCancelError(friendlyErrorI18n(e, lang)); }
  };

  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Org communications','اتصالات المنظمة')}
        title={s('Broadcasts','البث')}
        sub={s('In-app nudges and announcements · respects quiet hours','تنبيهات داخل التطبيق · تحترم ساعات الهدوء')}/>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: DENSITY[density].gap }}>
        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>{s('Compose','إنشاء')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Title (EN)','العنوان (EN)')}</div>
              <input value={titleEn} onChange={(e)=>setTitleEn(e.target.value)} style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
                color: T.text, fontSize: 14, fontFamily: 'inherit', outline: 'none',
              }}/>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Title (AR)','العنوان (AR)')}</div>
              <input value={titleAr} dir="rtl" onChange={(e)=>setTitleAr(e.target.value)} style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
                color: T.text, fontSize: 14, fontFamily: 'inherit', outline: 'none',
              }}/>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Message (EN)','الرسالة (EN)')}</div>
              <textarea value={bodyEn} onChange={(e)=>setBodyEn(e.target.value)} rows={5} style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
                color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5,
              }}/>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Message (AR)','الرسالة (AR)')}</div>
              <textarea value={bodyAr} dir="rtl" onChange={(e)=>setBodyAr(e.target.value)} rows={5} style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
                color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5,
              }}/>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 8 }}>{s('Audience','الجمهور')}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}`, width: 'fit-content' }}>
                {[['all',s('All staff','كل الموظفين')],['team',s('A team','فريق')]].map(([k,l])=>(
                  <button key={k} onClick={()=>setSegment(k)} style={{
                    padding: '7px 12px', borderRadius: 7, border: 'none',
                    background: segment===k ? T.panel : 'transparent',
                    color: segment===k ? T.text : T.textMuted,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>{l}</button>
                ))}
              </div>
              {segment === 'team' && (
                <select value={teamId} onChange={(e)=>setTeamId(e.target.value)} style={{
                  height: 34, padding: '0 10px', borderRadius: 9,
                  background: T.panelSunk, border: `1px solid ${T.border}`,
                  color: T.text, fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer',
                }}>
                  <option value="">{s('Pick a team…','اختر فريقاً…')}</option>
                  {teams.map(t => (
                    <option key={t.team_id} value={t.team_id}>{t.team_name}{t.department ? ` — ${t.department}` : ''}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: T.textMid, fontWeight: 600, marginBottom: 6 }}>{s('Scheduled at','وقت الإرسال')}</div>
            <input type="datetime-local" value={when} onChange={(e)=>setWhen(e.target.value)} style={{
              padding: '10px 12px',
              background: T.panelSunk, border: `1px solid ${T.border}`, borderRadius: 9,
              color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
            }}/>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <HRButton theme={T} variant="primary" icon="broadcasts" disabled={!titleEn || !bodyEn || !when || busy} onClick={handleSchedule}>
              {busy ? s('Scheduling…','جارٍ الجدولة…') : s('Schedule','جدولة')}
            </HRButton>
            {flash && (
              <span style={{ fontSize: 12, color: flash.kind === 'ok' ? T.positive : T.danger }}>
                {flash.kind === 'ok' ? s('Broadcast scheduled.','تمت الجدولة.') : (flash.message || s('Failed to schedule.','تعذّرت الجدولة.'))}
              </span>
            )}
          </div>
        </Panel>

        <Panel theme={T} density={density}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>{s('Preview · in-app','معاينة · داخل التطبيق')}</div>
          <div style={{ background: '#0E2A26', borderRadius: 18, padding: 20, color: '#F5F1E8', minHeight: 200, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <img src="/wellness-mark.png" alt="" style={{ height: 16, filter: 'brightness(0) invert(1)' }}/>
              <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 600, letterSpacing: 0.3 }}>WELLNESS+ · {s('From your HR team','من فريق الموارد البشرية')}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: -0.2 }}>{titleEn || s('Your title…','عنوان…')}</div>
            <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.55 }}>{bodyEn || s('Your message body…','نص الرسالة…')}</div>
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: T.textMuted }}>
            {s('Scheduling respects quiet hours and queues for the next allowed window.','الجدولة تحترم ساعات الهدوء.')}
          </div>
        </Panel>
      </div>

      {cancelError && (
        <div style={{ marginTop: DENSITY[density].gap, padding: '10px 14px', background: T.panelSunk, border: `1px solid ${T.danger}`, borderRadius: 9, color: T.danger, fontSize: 12 }}>
          {cancelError}
        </div>
      )}
      <Section theme={T} title={s('Scheduled','مجدولة')} items={grouped.scheduled} density={density} onCancel={handleCancel} cancelable s={s}/>
      <Section theme={T} title={s('Sent','مُرسلة')}    items={grouped.sent}      density={density} s={s}/>
      <Section theme={T} title={s('Cancelled','مُلغاة')} items={grouped.cancelled} density={density} s={s}/>
    </>
  );
}

function Section({ theme: T, title, items, density, onCancel, cancelable, s }) {
  if (!items || items.length === 0) return null;
  return (
    <>
      <div style={{ marginTop: DENSITY[density].gap, fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 12 }}>{title}</div>
      <Panel theme={T} density={density} pad={false}>
        {items.map((b, i) => (
          <div key={b.id} style={{
            padding: '14px 18px', display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr auto', gap: 12, alignItems: 'center',
            borderBottom: i < items.length - 1 ? `1px solid ${T.divider}` : 'none',
          }}>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{b.title_en || b.title || '—'}</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>
              <Badge theme={T} tone="neutral">{b.scope || '—'}</Badge>
            </div>
            <div style={{ fontSize: 12, color: T.textMid, textAlign: 'end' }}>
              {b.scheduled_at ? new Date(b.scheduled_at).toLocaleString() : '—'}
            </div>
            <div>
              {cancelable && onCancel && b.status === 'scheduled' && (
                <HRButton theme={T} variant="ghost" size="sm" onClick={() => onCancel(b.id)}>{s('Cancel','إلغاء')}</HRButton>
              )}
            </div>
          </div>
        ))}
      </Panel>
    </>
  );
}

export { HRBroadcastsPage };
