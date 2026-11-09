import React from 'react';
import { DENSITY } from '../tokens.jsx';
import { HRIcon, HRButton, Panel, Badge } from '../components.jsx';
import { Tabs, SearchBox, Flash, Loading, EmptyState, ConfirmButton } from './ui.jsx';
import { ExerciseEditor } from './exercise-editor.jsx';
import { filterExercises, exerciseMediaKind, bodyAreaLabel, exerciseName } from './exercise-form.js';
import { libraryError } from './errors.js';
import { fmtNum, pickLang } from './text.js';

// The exercise library. HR: "Your company" (edit) and "Wellness House"
// (use / hide / pin, never edit). Admin: the public library (edit).
//
// api: { mode: 'hr' | 'admin', list(), save(input), setStatus(id, status),
//        setPref?(id, pref), copy?(id), media }

export function MediaKindBadge({ theme, lang, kind }) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  if (!kind) return <Badge theme={theme} tone="neutral">{s('No demo', 'من غير فيديو')}</Badge>;
  const label = kind === 'youtube' ? s('YouTube', 'يوتيوب') : kind === 'image' ? s('Picture', 'صورة') : s('Video', 'فيديو');
  return <Badge theme={theme} tone="info"><HRIcon name={kind === 'image' ? 'eye' : 'play'} size={11}/>{label}</Badge>;
}

function ExerciseCard({ theme, lang, density, ex, children, dim }) {
  const T = theme;
  const areas = ex.body_areas || [];
  const other = lang === 'ar' ? ex.name_en : ex.name_ar;
  return (
    <Panel theme={T} density={density} style={{ display: 'flex', flexDirection: 'column', opacity: dim ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <MediaKindBadge theme={T} lang={lang} kind={exerciseMediaKind(ex)}/>
        {ex.pinned && <Badge theme={T} tone="caution" dot>{lang === 'ar' ? 'مثبّت' : 'Pinned'}</Badge>}
        {ex.hidden && <Badge theme={T} tone="neutral">{lang === 'ar' ? 'مخفي' : 'Hidden'}</Badge>}
        {ex.status === 'archived' && <Badge theme={T} tone="caution">{lang === 'ar' ? 'مؤرشف' : 'Archived'}</Badge>}
      </div>
      <div style={{ fontSize: 15, color: T.text, fontWeight: 700, lineHeight: 1.3 }}>{exerciseName(ex, lang)}</div>
      {other && other !== exerciseName(ex, lang) && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{other}</div>}
      <div style={{ fontSize: 12, color: T.textMid, marginTop: 8 }}>
        <span style={{ color: T.textMuted }}>{lang === 'ar' ? 'العدد: ' : 'Sets × reps: '}</span>
        <span dir="ltr">{pickLang(lang, ex.default_sets_reps, ex.default_sets_reps_ar) || '—'}</span>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8, flex: 1, alignContent: 'flex-start' }}>
        {areas.slice(0, 4).map((a) => <Badge key={a} theme={T} tone="neutral">{bodyAreaLabel(a, lang)}</Badge>)}
        {areas.length > 4 && <Badge theme={T} tone="neutral">+{fmtNum(areas.length - 4, lang)}</Badge>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.divider}`, flexWrap: 'wrap', alignItems: 'center' }}>
        {children}
      </div>
    </Panel>
  );
}

export function ExerciseLibrary({ theme, lang, density = 'comfortable', api, header }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const isAdmin = api.mode === 'admin';
  const [rows, setRows] = React.useState(null);
  const [loadError, setLoadError] = React.useState(null);
  const [tab, setTab] = React.useState(isAdmin ? 'public' : 'company');
  const [query, setQuery] = React.useState('');
  const [editing, setEditing] = React.useState(null); // { exercise, key }
  const [flash, setFlash] = React.useState(null);
  const [busyId, setBusyId] = React.useState(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const editorRef = React.useRef(null);

  const load = React.useCallback(async () => {
    setLoadError(null);
    try { setRows(await api.list()); } catch (e) { setLoadError(e); setRows((r) => r || []); }
  }, [api]);
  React.useEffect(() => { load(); }, [load]);

  const all = rows || [];
  const own = all.filter((r) => (isAdmin ? true : r.scope === 'company'));
  const pub = isAdmin ? [] : all.filter((r) => r.scope === 'public');
  const ownActive = own.filter((r) => r.status !== 'archived');
  const ownArchived = own.filter((r) => r.status === 'archived');
  const list = tab === 'public' && !isAdmin ? pub : ownActive;
  const visible = filterExercises(list, query, lang);

  const open = (exercise) => {
    setFlash(null);
    setEditing({ exercise, key: `${exercise?.id || 'new'}-${Date.now()}` });
    requestAnimationFrame(() => editorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  };

  async function handleSave(input) {
    const saved = await api.save(input);
    setEditing(null);
    setTab(isAdmin ? 'public' : 'company');
    setFlash({ kind: 'ok', text: input.id ? s('Exercise saved.', 'التمرين اتحفظ.') : s('Exercise added. You can use it in a routine now.', 'التمرين اتضاف. تقدر تستخدمه في روتين دلوقتي.') });
    await load();
    return saved;
  }

  async function run(id, fn, okText) {
    setBusyId(id); setFlash(null);
    try { await fn(); if (okText) setFlash({ kind: 'ok', text: okText }); await load(); }
    catch (e) { setFlash({ kind: 'err', text: libraryError(e, lang) }); }
    finally { setBusyId(null); }
  }

  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: DENSITY[density].gap };

  const ownCard = (ex) => (
    <ExerciseCard key={ex.id} theme={T} lang={lang} density={density} ex={ex} dim={ex.status === 'archived'}>
      {ex.status === 'archived' ? (
        <HRButton theme={T} variant="secondary" size="sm" disabled={busyId === ex.id}
          onClick={() => run(ex.id, () => api.setStatus(ex.id, 'published'), s('Restored.', 'رجع تاني.'))}>{s('Restore', 'رجّعه')}</HRButton>
      ) : (
        <>
          <HRButton theme={T} variant="secondary" size="sm" onClick={() => open(ex)}>{s('Edit', 'تعديل')}</HRButton>
          <ConfirmButton theme={T} lang={lang} label={s('Archive', 'أرشفة')} busy={busyId === ex.id}
            question={s('Archive it? Routines that use it keep it.', 'تأرشفه؟ الروتين اللي فيه هيفضل زي ما هو.')}
            yes={s('Yes, archive', 'أيوه، أرشف')}
            onConfirm={() => run(ex.id, () => api.setStatus(ex.id, 'archived'), s('Archived. It left the picker; routines that use it keep it.', 'اتأرشف. مش هيظهر في الاختيار، والروتين اللي فيه هيفضل.'))}/>
        </>
      )}
    </ExerciseCard>
  );

  const publicCard = (ex) => (
    <ExerciseCard key={ex.id} theme={T} lang={lang} density={density} ex={ex} dim={ex.hidden}>
      <HRButton theme={T} variant="primary" size="sm" disabled={busyId === ex.id}
        onClick={() => run(ex.id, async () => { await api.copy(ex.id); setTab('company'); },
          s('Added to your company. You can edit your copy now.', 'اتضاف لشركتك. تقدر تعدّل النسخة بتاعتك دلوقتي.'))}>
        {s('Use this', 'استخدمه')}
      </HRButton>
      <HRButton theme={T} variant="ghost" size="sm" disabled={busyId === ex.id}
        onClick={() => run(ex.id, () => api.setPref(ex.id, { pinned: !ex.pinned }))}>
        {ex.pinned ? s('Unpin', 'شيل التثبيت') : s('Pin', 'ثبّت')}
      </HRButton>
      <HRButton theme={T} variant="ghost" size="sm" disabled={busyId === ex.id}
        onClick={() => run(ex.id, () => api.setPref(ex.id, { hidden: !ex.hidden }),
          ex.hidden ? s('Shown again for your company.', 'رجع يظهر لشركتك.') : s('Hidden for your company.', 'اتخفى من شركتك.'))}>
        {ex.hidden ? s('Show', 'أظهره') : s('Hide', 'اخفيه')}
      </HRButton>
    </ExerciseCard>
  );

  return (
    <>
      {header({
        count: ownActive.length,
        add: !editing ? <HRButton theme={T} variant="primary" icon="plus" onClick={() => open(null)}>{s('Add exercise', 'ضيف تمرين')}</HRButton> : null,
      })}

      {loadError && <Flash theme={T} flash={{ kind: 'err', text: libraryError(loadError, lang) }}/>}
      <Flash theme={T} flash={flash}/>

      <div ref={editorRef}>
        {editing && (
          <ExerciseEditor key={editing.key} theme={T} lang={lang} density={density} exercise={editing.exercise}
            isPublic={isAdmin} media={api.media} onSave={handleSave} onCancel={() => setEditing(null)}/>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: DENSITY[density].gap }}>
        {!isAdmin && (
          <Tabs theme={T} value={tab} onChange={setTab} label={s('Library', 'المكتبة')} tabs={[
            { id: 'company', label: `${s('Your company', 'شركتك')} · ${fmtNum(ownActive.length, lang)}` },
            { id: 'public', label: `${s('Wellness House', 'Wellness House')} · ${fmtNum(pub.length, lang)}` },
          ]}/>
        )}
        <SearchBox theme={T} value={query} onChange={setQuery} placeholder={s('Search by name or body area…', 'دوّر بالاسم أو منطقة الجسم…')}/>
      </div>
      {tab === 'public' && !isAdmin && (
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: -8, marginBottom: 14 }}>
          {s('Ready-made by Wellness House. Use them in your routines as they are, or tap "Use this" for a copy you can edit.',
             'جاهزة من Wellness House. استخدمها في الروتين زي ما هي، أو دوس «استخدمه» علشان تاخد نسخة تعدّلها.')}
        </div>
      )}

      {rows == null ? <Loading theme={T} lang={lang}/> : visible.length === 0 ? (
        <EmptyState theme={T} density={density}
          text={query ? s('No exercise matches this search.', 'مفيش تمرين بالاسم ده.')
            : tab === 'public' && !isAdmin ? s('Wellness House hasn’t published exercises yet.', 'Wellness House لسه منزّلش تمارين.')
            : s('No exercises yet. Add the first one, or import a routine from a sheet.', 'لسه مفيش تمارين. ضيف أول واحد، أو استورد روتين من شيت.')}
          action={!query && tab !== 'public' && !editing ? <HRButton theme={T} variant="primary" size="sm" icon="plus" onClick={() => open(null)}>{s('Add exercise', 'ضيف تمرين')}</HRButton> : null}/>
      ) : (
        <div style={grid}>{visible.map((ex) => (tab === 'public' && !isAdmin ? publicCard(ex) : ownCard(ex)))}</div>
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
