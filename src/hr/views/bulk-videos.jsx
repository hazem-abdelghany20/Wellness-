import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, Panel, PanelHeader, Badge } from '../../shared/components.jsx';
import { inputStyle, Flash } from '../../shared/authoring/ui.jsx';
import { uploadError } from '../../shared/authoring/media-form.js';
import { libraryError } from '../../shared/authoring/errors.js';
import { fmtNum, msgText } from '../../shared/authoring/text.js';
import {
  listExercises, uploadCompanyMedia, setExercisesMedia, mediaFieldsFrom, removeCompanyMedia,
} from '../../lib/supabase-routines';
import {
  VIDEO_ACCEPT, buildMatchRows, planUploads, exerciseOptions, exercisesWithoutMedia, ROW_STATUS, skipReasonText,
} from '../lib/video-match.js';

export const bulkVideoApi = {
  list: () => listExercises('all'),
  upload: (file, opts) => uploadCompanyMedia(file, { folder: 'exercises', ...opts }),
  setMedia: (items, opts) => setExercisesMedia(items, opts),
  discard: (path) => removeCompanyMedia(path).catch(() => {}),
};

const STATUS_TONE = { ready: 'positive', unmatched: 'caution', invalid: 'danger', duplicate: 'caution', kept: 'neutral',
  uploading: 'info', uploaded: 'info', failed: 'danger', done: 'positive', skipped: 'caution' };

// Pick many video files at once → match each to an exercise by its name →
// upload them one by one with progress → set them on the exercises in one go.
export function BulkVideoPanel({ theme, lang, density, title, subtitle, onClose, onDone, api = bulkVideoApi, embedded = false }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const n = (v) => fmtNum(v, lang);
  const fileRef = React.useRef(null);
  const abortRef = React.useRef(null);
  const [exercises, setExercises] = React.useState(null);
  const [loadError, setLoadError] = React.useState(null);
  const [rows, setRows] = React.useState([]);
  const [overwrite, setOverwrite] = React.useState(false);
  const [phase, setPhase] = React.useState('pick'); // pick | review | uploading | done
  const [prog, setProg] = React.useState({});       // row key → { status, pct, error, reason }
  const [flash, setFlash] = React.useState(null);
  const [result, setResult] = React.useState(null);

  React.useEffect(() => {
    let live = true;
    Promise.resolve(api.list())
      .then((list) => { if (live) setExercises(list || []); })
      .catch((e) => { if (live) { setLoadError(e); setExercises([]); } });
    return () => { live = false; abortRef.current?.abort(); };
  }, [api]);

  const options = React.useMemo(() => exerciseOptions(exercises || [], lang), [exercises, lang]);
  const plan = planUploads(rows, exercises || [], { overwrite });
  const missing = React.useMemo(() => exercisesWithoutMedia(exercises || [], lang), [exercises, lang]);

  function onFiles(e) {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = '';
    if (!files.length) return;
    setRows(buildMatchRows(files, exercises || []));
    setProg({}); setResult(null); setFlash(null);
    setPhase('review');
  }

  const setRowExercise = (key, id) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, exerciseId: id, auto: false } : r)));
  const setP = (key, v) => setProg((p) => ({ ...p, [key]: v }));

  async function start() {
    const ready = plan.rows.filter((r) => r.status === 'ready');
    if (!ready.length) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase('uploading'); setFlash(null); setProg({});
    const uploaded = [];
    for (const r of ready) {
      if (ctrl.signal.aborted) break;
      setP(r.key, { status: 'uploading', pct: 0 });
      try {
        const up = await api.upload(r.file, { signal: ctrl.signal, onProgress: (pct) => setP(r.key, { status: 'uploading', pct }) });
        uploaded.push({ row: r, up });
        setP(r.key, { status: 'uploaded', pct: 100 });
      } catch (err) {
        setP(r.key, { status: 'failed', error: msgText(uploadError(err), lang) });
        if (err?.name === 'AbortError') break;
      }
    }
    abortRef.current = null;
    if (ctrl.signal.aborted) {
      uploaded.forEach(({ up }) => api.discard(up.path));
      setProg({});
      setPhase('review');
      setFlash({ kind: 'err', text: s('Upload cancelled. No exercise was changed.', 'الرفع اتلغى. ولا تمرين اتغيّر.') });
      return;
    }
    if (!uploaded.length) {
      setPhase('review');
      setFlash({ kind: 'err', text: s('No video could be uploaded. Check your connection and try again.', 'ولا فيديو اترفع. اتأكد من النت وجرّب تاني.') });
      return;
    }
    try {
      const items = uploaded.map(({ row, up }) => ({ id: row.exerciseId, ...mediaFieldsFrom(up) }));
      const res = await api.setMedia(items, { overwrite });
      const skipped = new Map((res?.skipped || []).map((x) => [x.id, x.reason]));
      for (const { row, up } of uploaded) {
        if (skipped.has(row.exerciseId)) {
          api.discard(up.path);
          setP(row.key, { status: 'skipped', reason: skipped.get(row.exerciseId) });
        } else {
          setP(row.key, { status: 'done' });
        }
      }
      setResult(res || { updated: 0, skipped: [] });
      setPhase('done');
      onDone?.(res);
    } catch (err) {
      uploaded.forEach(({ up }) => api.discard(up.path));
      setProg({});
      setPhase('review');
      setFlash({ kind: 'err', text: libraryError(err, lang) });
    }
  }

  const statusOf = (r) => prog[r.key]?.status || r.status;
  const statusText = (r) => {
    const p = prog[r.key];
    if (p?.status === 'failed') return p.error;
    if (p?.status === 'skipped') return skipReasonText(p.reason, lang);
    if (p?.status === 'uploading') return `${msgText(ROW_STATUS.uploading, lang)} ${p.pct || 0}%`;
    if (p?.status) return msgText(ROW_STATUS[p.status], lang);
    if (r.status === 'invalid') return msgText(r.error, lang);
    return msgText(ROW_STATUS[r.status], lang);
  };
  const locked = phase === 'uploading' || phase === 'done';
  const pad = DENSITY[density].cardPad;
  const th = { textAlign: 'start', padding: '8px 10px', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700, color: T.textMuted };
  const td = { padding: '8px 10px', fontSize: 12, color: T.text, borderTop: `1px solid ${T.divider}`, verticalAlign: 'middle' };

  const body = (
    <div style={{ padding: embedded ? 0 : pad }}>
      {loadError && <Flash theme={T} flash={{ kind: 'err', text: libraryError(loadError, lang) }}/>}
      <Flash theme={T} flash={flash}/>
      <input ref={fileRef} type="file" multiple accept={VIDEO_ACCEPT} onChange={onFiles} style={{ display: 'none' }}
        aria-label={s('Choose the videos', 'اختار الفيديوهات')}/>

      {phase === 'pick' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.55 }}>
            {s('Name each file like its exercise (for example “Neck release.mp4”) and they match by themselves. You can fix any match before uploading.',
               'سمّي كل ملف باسم التمرين بتاعه (مثلاً «فك الرقبة.mp4») وهيتوصّلوا لوحدهم. وتقدر تصلّح أي توصيلة قبل الرفع.')}
          </div>
          {missing.length > 0 && (
            <div style={{ fontSize: 12, color: T.textMuted }}>
              {s(`Still without a video: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ` +${missing.length - 8}` : ''}`,
                 `لسه من غير فيديو: ${missing.slice(0, 8).join('، ')}${missing.length > 8 ? ` +${n(missing.length - 8)}` : ''}`)}
            </div>
          )}
          <div>
            <HRButton theme={T} variant="primary" icon="plus" disabled={exercises == null} onClick={() => fileRef.current?.click()}>
              {exercises == null ? s('Loading exercises…', 'جارٍ تحميل التمارين…') : s('Pick videos', 'اختار الفيديوهات')}
            </HRButton>
          </div>
        </div>
      )}

      {phase !== 'pick' && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <Badge theme={T} tone="positive">{s(`${plan.ready} ready`, `${n(plan.ready)} جاهزين`)}</Badge>
            {plan.unmatched > 0 && <Badge theme={T} tone="caution">{s(`${plan.unmatched} need an exercise`, `${n(plan.unmatched)} محتاجين تمرين`)}</Badge>}
            {plan.kept > 0 && <Badge theme={T} tone="neutral">{s(`${plan.kept} kept (already have a video)`, `${n(plan.kept)} هيفضلوا (عندهم فيديو)`)}</Badge>}
            {plan.invalid > 0 && <Badge theme={T} tone="danger">{s(`${plan.invalid} can’t be used`, `${n(plan.invalid)} مينفعوش`)}</Badge>}
            {plan.duplicate > 0 && <Badge theme={T} tone="caution">{s(`${plan.duplicate} for the same exercise`, `${n(plan.duplicate)} لنفس التمرين`)}</Badge>}
          </div>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label={s('Files and exercises', 'الملفات والتمارين')}>
              <thead>
                <tr style={{ background: T.panelSunk }}>
                  <th style={th}>{s('File', 'الملف')}</th>
                  <th style={th}>{s('Exercise', 'التمرين')}</th>
                  <th style={th}>{s('Status', 'الحالة')}</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((r) => {
                  const st = statusOf(r);
                  const p = prog[r.key];
                  return (
                    <tr key={r.key}>
                      <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="mono" dir="ltr">{r.name}</td>
                      <td style={td}>
                        {r.error ? <span style={{ color: T.textFaint }}>—</span> : (
                          <select value={r.exerciseId} disabled={locked} onChange={(e) => setRowExercise(r.key, e.target.value)}
                            aria-label={s(`Exercise for ${r.name}`, `التمرين لـ ${r.name}`)}
                            style={{ ...inputStyle(T, st === 'unmatched'), width: 'auto', minWidth: 180, padding: '6px 8px', fontSize: 12 }}>
                            <option value="">{s('Skip this file', 'سيب الملف ده')}</option>
                            {options.map((o) => <option key={o.id} value={o.id}>{o.label}{o.hasMedia ? s(' (has a video)', ' (عنده فيديو)') : ''}</option>)}
                          </select>
                        )}
                        {r.auto && !locked && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>{s('Matched by name', 'اتوصّل بالاسم')}</div>}
                      </td>
                      <td style={td}>
                        <Badge theme={T} tone={STATUS_TONE[st] || 'neutral'}>{statusText(r)}</Badge>
                        {p?.status === 'uploading' && (
                          <div role="progressbar" aria-label={s(`Uploading ${r.name}`, `جارٍ رفع ${r.name}`)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct || 0}
                            style={{ height: 4, borderRadius: 99, background: T.panelSunk, overflow: 'hidden', marginTop: 6, minWidth: 100 }}>
                            <div style={{ width: `${p.pct || 0}%`, height: '100%', background: T.accent }}/>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {phase === 'review' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12, color: T.textMid, cursor: 'pointer' }}>
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)}/>
              {s('Replace videos that are already there', 'استبدل الفيديوهات اللي موجودة')}
            </label>
          )}

          {phase === 'done' && result && (
            <div role="status" style={{ marginTop: 12, fontSize: 13, color: T.positive, fontWeight: 600 }}>
              {s(`Videos added to ${result.updated} ${result.updated === 1 ? 'exercise' : 'exercises'}.`, `الفيديوهات اتضافت لـ ${n(result.updated)} تمرين.`)}
              {(result.skipped || []).length > 0 && (
                <span style={{ color: T.textMuted, fontWeight: 400 }}>{s(` ${result.skipped.length} skipped (see the list).`, ` ${n(result.skipped.length)} اتسابوا (شوف القايمة).`)}</span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
            {phase === 'review' && (
              <>
                <HRButton theme={T} variant="primary" icon="check" disabled={!plan.ready} onClick={start}>
                  {s(`Upload ${plan.ready} ${plan.ready === 1 ? 'video' : 'videos'}`, `ارفع ${n(plan.ready)} فيديو`)}
                </HRButton>
                <HRButton theme={T} variant="ghost" onClick={() => fileRef.current?.click()}>{s('Pick other files', 'اختار ملفات تانية')}</HRButton>
              </>
            )}
            {phase === 'uploading' && (
              <HRButton theme={T} variant="ghost" onClick={() => abortRef.current?.abort()}>{s('Cancel upload', 'إلغاء الرفع')}</HRButton>
            )}
            {phase === 'done' && (
              <>
                <HRButton theme={T} variant="primary" onClick={onClose}>{s('Done', 'تمام')}</HRButton>
                <HRButton theme={T} variant="ghost" onClick={() => { setRows([]); setProg({}); setResult(null); setPhase('pick'); }}>{s('Upload more', 'ارفع تاني')}</HRButton>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (embedded) return body;
  return (
    <Panel theme={T} density={density} pad={false} style={{ marginBottom: DENSITY[density].gap }}>
      <PanelHeader theme={T} density={density}
        title={title || s('Upload many videos', 'ارفع فيديوهات كتير')}
        subtitle={subtitle || s('Up to 50 MB each, MP4 or MOV (pictures work too). Nothing changes until you press Upload.', 'لحد ٥٠ ميجا للفيديو، MP4 أو MOV (والصور كمان). مفيش حاجة بتتغير غير لما تدوس ارفع.')}
        right={onClose && phase !== 'uploading' ? <HRButton theme={T} variant="ghost" size="sm" icon="close" onClick={onClose}>{s('Close', 'قفل')}</HRButton> : null}/>
      {body}
    </Panel>
  );
}
