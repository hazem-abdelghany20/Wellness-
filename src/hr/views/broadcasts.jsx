import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, HRIcon, Panel, Badge } from '../../shared/components.jsx';
import { Flash, Loading, ConfirmButton, SectionTitle } from '../../shared/authoring/ui.jsx';
import { libraryError, errorCode } from '../../shared/authoring/errors.js';
import { pickLang } from '../../shared/authoring/text.js';
import { HRPageHeader } from './_header.jsx';
import { BroadcastComposer } from './broadcast-composer.jsx';
import { broadcastApi, browserTimeZone } from '../lib/broadcast-api.js';
import { groupBroadcasts, deliveryLine, reachLine, fmtDuration, broadcastErrorCopy } from '../lib/broadcast-schedule.js';

// ── BROADCASTS PAGE ──────────────────────────────────────────────
// Messages from HR to everyone or one team: now or at a set time (company
// time; quiet hours hold night ones until the morning), text and/or a voice
// message. Scheduled ones can be edited or cancelled until they go.
function HRBroadcastsPage({ theme, lang, density, api = broadcastApi, recorderEnv }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const gap = DENSITY[density].gap;
  const [list, setList] = React.useState(null);
  const [loadError, setLoadError] = React.useState(null);
  const [company, setCompany] = React.useState(null);
  const [teams, setTeams] = React.useState([]);
  const [editing, setEditing] = React.useState(null);
  const [composerKey, setComposerKey] = React.useState(0);
  const [flash, setFlash] = React.useState(null);
  const [busyId, setBusyId] = React.useState(null);
  const topRef = React.useRef(null);

  const load = React.useCallback(async () => {
    try { setList(await api.list()); setLoadError(null); }
    catch (e) { setLoadError(e); setList((l) => l || []); }
  }, [api]);

  React.useEffect(() => {
    load();
    api.settings().then(setCompany).catch(() => setCompany({ timezone: browserTimeZone(), quiet_hours: true }));
    api.teams().then((t) => setTeams(t || [])).catch(() => setTeams([]));
  }, [api, load]);

  const tz = company?.timezone || browserTimeZone();

  function onSaved(b, { isEdit }) {
    setEditing(null);
    setComposerKey((k) => k + 1);
    const line = deliveryLine(b, tz, lang).text;
    setFlash({ kind: 'ok', text: b?.status === 'sent'
      ? s(`Sent${b.recipients != null ? ` to ${b.recipients} ${b.recipients === 1 ? 'person' : 'people'}` : ''}.`, `اتبعتت${b.recipients != null ? ` لـ ${new Intl.NumberFormat('ar-EG').format(b.recipients)} شخص` : ''}.`)
      : isEdit ? s(`Saved. ${line}.`, `اتحفظت. ${line}.`) : s(`Scheduled. ${line}.`, `اتجدولت. ${line}.`) });
    load();
  }

  async function cancel(b) {
    setBusyId(b.id); setFlash(null);
    try {
      await api.cancel(b.id);
      if (editing?.id === b.id) { setEditing(null); setComposerKey((k) => k + 1); }
      setFlash({ kind: 'ok', text: s('Cancelled. Nobody will get it.', 'اتلغت. محدش هيستلمها.') });
      await load();
    } catch (e) {
      setFlash({ kind: 'err', text: broadcastErrorCopy(errorCode(e), lang) || libraryError(e, lang) });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function edit(b) {
    setFlash(null);
    setEditing(b);
    setComposerKey((k) => k + 1);
    requestAnimationFrame(() => topRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }

  const grouped = groupBroadcasts(list || []);

  const row = (b, i, arr) => {
    const when = deliveryLine(b, tz, lang);
    const reach = reachLine(b, lang);
    const audience = b.scope === 'team' ? (b.team_name || s('A team', 'فريق')) : s('Everyone', 'كل الموظفين');
    return (
      <div key={b.id} style={{
        padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
        background: editing?.id === b.id ? T.accentSoft : 'transparent',
      }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{pickLang(lang, b.title_en, b.title_ar) || '—'}</span>
            {b.has_audio && (
              <Badge theme={T} tone="info"><HRIcon name="headphones" size={11}/>{s('Audio', 'صوت')}{b.media_duration_s ? ` · ${fmtDuration(b.media_duration_s)}` : ''}</Badge>
            )}
            <Badge theme={T} tone="neutral">{audience}</Badge>
          </div>
          <div style={{ fontSize: 12, color: when.quiet ? T.caution : T.textMuted, marginTop: 4 }}>{when.text}</div>
          {reach && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{reach}</div>}
        </div>
        {b.status === 'scheduled' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <HRButton theme={T} variant="secondary" size="sm" disabled={busyId === b.id} onClick={() => edit(b)}>{s('Edit', 'تعديل')}</HRButton>
            <ConfirmButton theme={T} lang={lang} label={s('Cancel', 'إلغاء')} busy={busyId === b.id}
              question={s('Cancel it? Nobody will get it.', 'تلغيها؟ محدش هيستلمها.')} yes={s('Yes, cancel', 'أيوه، الغيها')}
              onConfirm={() => cancel(b)}/>
          </div>
        )}
      </div>
    );
  };

  const section = (title, items, empty) => (
    <div style={{ marginTop: gap }}>
      <SectionTitle theme={T}>{title}</SectionTitle>
      <Panel theme={T} density={density} pad={false}>
        {items.length ? items.map(row) : <div style={{ padding: '18px', fontSize: 12, color: T.textMuted }}>{empty}</div>}
      </Panel>
    </div>
  );

  return (
    <div ref={topRef}>
      <HRPageHeader theme={T}
        eyebrow={s('Messages from HR', 'رسايل من الـ HR')}
        title={s('Broadcasts', 'الرسايل')}
        sub={s('Text or a voice message, now or at a set time. Night messages wait for the morning while quiet hours are on.',
               'نص أو رسالة صوتية، دلوقتي أو في وقت تحدده. رسايل الليل بتستنى الصبح طول ما ساعات الهدوء شغالة.')}/>

      <Flash theme={T} flash={flash}/>
      {company ? (
        <BroadcastComposer key={`${composerKey}-${tz}`} theme={T} lang={lang} density={density} api={api} teams={teams}
          company={{ ...company, timezone: tz }} editing={editing} recorderEnv={recorderEnv}
          onSaved={onSaved} onCancelEdit={() => { setEditing(null); setComposerKey((k) => k + 1); }}/>
      ) : <Loading theme={T} lang={lang}/>}

      {loadError && <Flash theme={T} flash={{ kind: 'err', text: libraryError(loadError, lang) }} style={{ marginTop: gap }}/>}
      {list == null ? <Loading theme={T} lang={lang}/> : (
        <>
          {section(s('Scheduled', 'متجدولة'), grouped.scheduled, s('Nothing scheduled.', 'مفيش حاجة متجدولة.'))}
          {section(s('Sent', 'اتبعتت'), grouped.sent, s('Nothing sent yet.', 'لسه مفيش حاجة اتبعتت.'))}
          {grouped.cancelled.length > 0 && section(s('Cancelled', 'اتلغت'), grouped.cancelled, '')}
        </>
      )}
    </div>
  );
}

export { HRBroadcastsPage };
