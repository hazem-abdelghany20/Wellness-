import React from 'react';
import { DENSITY } from '../tokens.jsx';
import { HRButton, Panel, Badge } from '../components.jsx';
import { Tabs, Flash, Loading, EmptyState, ConfirmButton } from './ui.jsx';
import { RoutineBuilder } from './routine-builder.jsx';
import { workdaysLabel } from './routine-form.js';
import { libraryError } from './errors.js';
import { pickLang, fmtNum } from './text.js';

// Routines: list + builder. HR: "Your company" (edit / assign / archive)
// and "Wellness House" ("Use this" makes an editable copy; hide / pin).
// Admin: the public library.
//
// api: { mode, list(), detail(id), save(input), setStatus(id, status),
//        exercises(), saveExercise(input), setPref?(id, pref), copy?(id), media }
// onAssign(routine): HR only, shows "Assign" on own routines.
// onSaved(detail, { isNew }): after a save (HR offers to assign a new one).
// openRequest: { id, key } opens that routine in the builder (after an import).

function RoutineCard({ theme, lang, density, r, children, dim }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const title = pickLang(lang, r.title_en, r.title_ar);
  const other = lang === 'ar' ? r.title_en : r.title_ar;
  const n = Number(r.item_count ?? 0);
  return (
    <Panel theme={T} density={density} style={{ display: 'flex', flexDirection: 'column', opacity: dim ? 0.6 : 1 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {r.assigned && <Badge theme={T} tone="positive" dot>{s('Assigned', 'متوزّع')}</Badge>}
        {r.pinned && <Badge theme={T} tone="caution" dot>{s('Pinned', 'مثبّت')}</Badge>}
        {r.hidden && <Badge theme={T} tone="neutral">{s('Hidden', 'مخفي')}</Badge>}
        {r.status === 'archived' && <Badge theme={T} tone="caution">{s('Archived', 'مؤرشف')}</Badge>}
        {r.source_file_path && <Badge theme={T} tone="info">{s('Original table', 'الجدول الأصلي')}</Badge>}
      </div>
      <div style={{ fontSize: 15, color: T.text, fontWeight: 700, lineHeight: 1.3 }}>{title}</div>
      {other && other !== title && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{other}</div>}
      <div style={{ fontSize: 12, color: T.textMid, marginTop: 8, flex: 1 }}>
        {s(`${n} ${n === 1 ? 'row' : 'rows'}`, `${fmtNum(n, 'ar')} صف`)} · {workdaysLabel(r.workdays, lang)}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.divider}`, flexWrap: 'wrap', alignItems: 'center' }}>
        {children}
      </div>
    </Panel>
  );
}

export function RoutineLibrary({
  theme, lang, density = 'comfortable', api, header, onAssign, onSaved, openRequest, reloadKey, todayWeekday,
}) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const isAdmin = api.mode === 'admin';
  const [rows, setRows] = React.useState(null);
  const [loadError, setLoadError] = React.useState(null);
  const [tab, setTab] = React.useState(isAdmin ? 'public' : 'company');
  const [editing, setEditing] = React.useState(null); // { detail, key }
  const [exercises, setExercises] = React.useState(null);
  const [flash, setFlash] = React.useState(null);
  const [busyId, setBusyId] = React.useState(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const editorRef = React.useRef(null);

  const load = React.useCallback(async () => {
    setLoadError(null);
    try { setRows(await api.list()); } catch (e) { setLoadError(e); setRows((r) => r || []); }
  }, [api]);
  React.useEffect(() => { load(); }, [load, reloadKey]);

  const loadExercises = React.useCallback(async () => {
    try { setExercises(await api.exercises()); } catch (e) { setExercises([]); setFlash({ kind: 'err', text: libraryError(e, lang) }); }
  }, [api, lang]);

  const openBuilder = React.useCallback((detail) => {
    setFlash(null);
    if (!exercises) loadExercises();
    setEditing({ detail, key: `${detail?.routine?.id || 'new'}-${Date.now()}` });
    requestAnimationFrame(() => editorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }, [exercises, loadExercises]);

  const openById = React.useCallback(async (id) => {
    setBusyId(id); setFlash(null);
    try { openBuilder(await api.detail(id)); }
    catch (e) { setFlash({ kind: 'err', text: libraryError(e, lang) }); }
    finally { setBusyId(null); }
  }, [api, openBuilder, lang]);

  React.useEffect(() => {
    if (openRequest?.id) { setTab('company'); openById(openRequest.id); }
  }, [openRequest?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(input) {
    const detail = await api.save(input);
    setEditing(null);
    setTab(isAdmin ? 'public' : 'company');
    setFlash({ kind: 'ok', text: input.id ? s('Routine saved. Employees see the changes from today.', 'الروتين اتحفظ. الموظفين هيشوفوا التغييرات من النهارده.')
      : isAdmin ? s('Routine published. Every company can use it now.', 'الروتين اتنشر. كل الشركات تقدر تستخدمه دلوقتي.')
      : s('Routine saved. Now choose who gets it.', 'الروتين اتحفظ. اختار مين ياخده.') });
    await load();
    onSaved?.(detail, { isNew: !input.id });
    return detail;
  }

  async function run(id, fn, okText) {
    setBusyId(id); setFlash(null);
    try { const out = await fn(); if (okText) setFlash({ kind: 'ok', text: okText }); await load(); return out; }
    catch (e) { setFlash({ kind: 'err', text: libraryError(e, lang) }); return null; }
    finally { setBusyId(null); }
  }

  async function useThis(r) {
    const copy = await run(r.id, () => api.copy(r.id), null);
    if (copy) {
      setTab('company');
      openBuilder(copy);
      setFlash({ kind: 'ok', text: s('Copied to your company. Check it, save, then choose who gets it.', 'اتنسخ لشركتك. راجعه واحفظه، وبعدين اختار مين ياخده.') });
    }
  }

  const all = rows || [];
  const own = all.filter((r) => (isAdmin ? true : r.scope === 'company'));
  const pub = isAdmin ? [] : all.filter((r) => r.scope === 'public');
  const ownActive = own.filter((r) => r.status !== 'archived');
  const ownArchived = own.filter((r) => r.status === 'archived');
  const list = tab === 'public' && !isAdmin ? pub : ownActive;
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: DENSITY[density].gap };

  const ownCard = (r) => (
    <RoutineCard key={r.id} theme={T} lang={lang} density={density} r={r} dim={r.status === 'archived'}>
      {r.status === 'archived' ? (
        <HRButton theme={T} variant="secondary" size="sm" disabled={busyId === r.id}
          onClick={() => run(r.id, () => api.setStatus(r.id, 'published'), s('Restored.', 'رجع تاني.'))}>{s('Restore', 'رجّعه')}</HRButton>
      ) : (
        <>
          <HRButton theme={T} variant="secondary" size="sm" disabled={busyId === r.id} onClick={() => openById(r.id)}>{s('Edit', 'تعديل')}</HRButton>
          {onAssign && <HRButton theme={T} variant="primary" size="sm" onClick={() => onAssign(r)}>{s('Assign', 'وزّعه')}</HRButton>}
          <ConfirmButton theme={T} lang={lang} label={s('Archive', 'أرشفة')} busy={busyId === r.id}
            question={isAdmin ? s('Archive it? Companies can’t pick it any more.', 'تأرشفه؟ الشركات مش هتقدر تختاره تاني.')
              : s('Archive it? It stops showing for everyone who has it.', 'تأرشفه؟ هيختفي من عند كل اللي معاهم.')}
            yes={s('Yes, archive', 'أيوه، أرشف')}
            onConfirm={() => run(r.id, () => api.setStatus(r.id, 'archived'), s('Archived.', 'اتأرشف.'))}/>
        </>
      )}
    </RoutineCard>
  );

  const publicCard = (r) => (
    <RoutineCard key={r.id} theme={T} lang={lang} density={density} r={r} dim={r.hidden}>
      <HRButton theme={T} variant="primary" size="sm" disabled={busyId === r.id} onClick={() => useThis(r)}>{s('Use this', 'استخدمه')}</HRButton>
      <HRButton theme={T} variant="ghost" size="sm" disabled={busyId === r.id}
        onClick={() => run(r.id, () => api.setPref(r.id, { pinned: !r.pinned }))}>{r.pinned ? s('Unpin', 'شيل التثبيت') : s('Pin', 'ثبّت')}</HRButton>
      <HRButton theme={T} variant="ghost" size="sm" disabled={busyId === r.id}
        onClick={() => run(r.id, () => api.setPref(r.id, { hidden: !r.hidden }))}>{r.hidden ? s('Show', 'أظهره') : s('Hide', 'اخفيه')}</HRButton>
    </RoutineCard>
  );

  return (
    <>
      {header({
        count: ownActive.length,
        add: !editing ? <HRButton theme={T} variant="primary" icon="plus" onClick={() => openBuilder(null)}>{s('New routine', 'روتين جديد')}</HRButton> : null,
      })}

      {loadError && <Flash theme={T} flash={{ kind: 'err', text: libraryError(loadError, lang) }}/>}
      <Flash theme={T} flash={flash}/>

      <div ref={editorRef}>
        {editing && (
          exercises == null ? <Panel theme={T} density={density} style={{ marginBottom: DENSITY[density].gap }}><Loading theme={T} lang={lang}/></Panel> : (
            <RoutineBuilder key={editing.key} theme={T} lang={lang} density={density} detail={editing.detail}
              exercises={exercises} isPublic={isAdmin} media={api.media} todayWeekday={todayWeekday}
              onSave={handleSave} onCancel={() => setEditing(null)}
              onCreateExercise={async (input) => { const ex = await api.saveExercise(input); loadExercises(); return ex; }}/>
          )
        )}
      </div>

      {!isAdmin && (
        <Tabs theme={T} value={tab} onChange={setTab} label={s('Library', 'المكتبة')} style={{ marginBottom: DENSITY[density].gap }} tabs={[
          { id: 'company', label: `${s('Your company', 'شركتك')} · ${fmtNum(ownActive.length, lang)}` },
          { id: 'public', label: `${s('Wellness House', 'Wellness House')} · ${fmtNum(pub.length, lang)}` },
        ]}/>
      )}
      {tab === 'public' && !isAdmin && (
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: -8, marginBottom: 14 }}>
          {s('Ready-made routines. "Use this" puts a copy in your company that you can change and assign.',
             'روتينات جاهزة. «استخدمه» بيحط نسخة في شركتك تقدر تغيّرها وتوزّعها.')}
        </div>
      )}

      {rows == null ? <Loading theme={T} lang={lang}/> : list.length === 0 ? (
        <EmptyState theme={T} density={density}
          text={tab === 'public' && !isAdmin ? s('Wellness House hasn’t published routines yet.', 'Wellness House لسه منزّلش روتينات.')
            : s('No routines yet. Type the coach’s table, or import it from a sheet.', 'لسه مفيش روتين. اكتب جدول المدرب، أو استورده من شيت.')}
          action={tab !== 'public' && !editing ? <HRButton theme={T} variant="primary" size="sm" icon="plus" onClick={() => openBuilder(null)}>{s('New routine', 'روتين جديد')}</HRButton> : null}/>
      ) : (
        <div style={grid}>{list.map((r) => (tab === 'public' && !isAdmin ? publicCard(r) : ownCard(r)))}</div>
      )}

      {tab !== 'public' && ownArchived.length > 0 && (
        <div style={{ marginTop: DENSITY[density].gap }}>
          <HRButton theme={T} variant="ghost" size="sm" iconR={showArchived ? 'chevUp' : 'chevDown'} onClick={() => setShowArchived((v) => !v)}>
            {s(`Archived (${ownArchived.length})`, `المؤرشف (${fmtNum(ownArchived.length, 'ar')})`)}
          </HRButton>
          {showArchived && <div style={{ ...grid, marginTop: 12 }}>{ownArchived.map(ownCard)}</div>}
        </div>
      )}
    </>
  );
}
