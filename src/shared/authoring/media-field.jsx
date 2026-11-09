import React from 'react';
import { HRIcon, HRButton, Badge } from '../components.jsx';
import { HabitMedia } from '../../employee/components/habit-media.jsx';
import { parseYouTubeUrl } from '../habit-meta.js';
import { Choice, ErrorText, inputStyle } from './ui.jsx';
import { checkFile, uploadError, youtubeMessage, mediaFields } from './media-form.js';
import { msgText } from './text.js';

// Media for the authoring forms.
//
// `media` adapters (HR: private company-media; admin: public content-assets):
//   upload(file, { folder, contentType, onProgress, signal }) → { bucket, path, mime, kind }
//   discard(path)        delete a file that was uploaded but not saved
//   resolve(fields)      → the sprint 1 player payload (signed / public URL)

// Files uploaded in a form but not saved yet. Leaving without saving
// deletes them, so nothing is left half-uploaded.
export function usePendingUploads(discard) {
  const pending = React.useRef(new Set());
  const kept = React.useRef(new Set()); // being saved: never deleted
  const discardRef = React.useRef(discard);
  discardRef.current = discard;
  const flush = (keep) => {
    for (const p of pending.current) {
      if (!keep.has(p)) { try { discardRef.current?.(p); } catch { /* best effort */ } }
    }
    pending.current.clear();
  };
  // The parent usually closes the form as soon as the save succeeds, so
  // this can run while the save is still finishing: files being saved stay.
  React.useEffect(() => () => flush(kept.current), []); // eslint-disable-line react-hooks/exhaustive-deps
  return React.useMemo(() => ({
    add(path) { if (path) pending.current.add(path); },
    drop(path) {
      if (path && pending.current.has(path)) {
        pending.current.delete(path);
        try { discardRef.current?.(path); } catch { /* best effort */ }
      }
    },
    // Run a save that uses `keep` (paths). On success the other unsaved
    // uploads are deleted; on failure nothing changes.
    async saving(keep, fn) {
      kept.current = new Set((keep || []).filter(Boolean));
      try {
        const out = await fn();
        flush(kept.current);
        return out;
      } catch (e) {
        kept.current = new Set();
        throw e;
      }
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
}

function UploadProgress({ theme, lang, name, progress, onCancel }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textMid, marginBottom: 6, gap: 8 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s('Uploading', 'جارٍ رفع')} {name}</span>
        <span className="mono">{progress}%</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
        style={{ height: 6, borderRadius: 99, background: T.panelSunk, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: T.accent, transition: 'width .2s' }}/>
      </div>
      <HRButton theme={T} variant="ghost" size="sm" style={{ marginTop: 8 }} onClick={onCancel}>{s('Cancel upload', 'إلغاء الرفع')}</HRButton>
    </div>
  );
}

// One upload slot with progress. Shared by the media picker and "Original table".
export function useUploader({ media, folder, kinds, pending, onUploaded }) {
  const [state, setState] = React.useState({ progress: null, error: null, name: '' });
  const abortRef = React.useRef(null);
  React.useEffect(() => () => abortRef.current?.abort(), []);
  const pick = async (file) => {
    if (!file) return;
    const check = checkFile(file, kinds);
    if (!check.ok) { setState({ progress: null, error: check.error, name: file.name }); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ progress: 0, error: null, name: file.name });
    try {
      const up = await media.upload(file, {
        folder, contentType: check.mime, signal: ctrl.signal,
        onProgress: (pct) => setState((u) => ({ ...u, progress: pct })),
      });
      pending?.add(up.path);
      onUploaded({ ...up, kind: up.kind || check.kind, name: file.name });
      setState({ progress: null, error: null, name: file.name });
    } catch (err) {
      setState({ progress: null, error: uploadError(err), name: file.name });
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  };
  return { ...state, uploading: state.progress != null, pick, cancel: () => abortRef.current?.abort(), clearError: () => setState((u) => ({ ...u, error: null })) };
}

const MEDIA_ACCEPT = 'video/mp4,video/quicktime,.mp4,.mov,image/png,image/jpeg,.png,.jpg,.jpeg';

// None / Upload / YouTube, with progress. value = form media
// ({ mode, file, youtube_url }); onChange(nextMedia).
export function MediaField({ theme, lang, value, onChange, media, folder, pending, error, onUploadingChange }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const fileRef = React.useRef(null);
  const v = value || { mode: 'none', file: null, youtube_url: '' };
  const up = useUploader({
    media, folder, kinds: ['video', 'image'], pending,
    onUploaded: (file) => {
      if (v.file?.path) pending?.drop(v.file.path); // replaced before saving
      onChange({ ...v, mode: 'upload', file });
    },
  });
  React.useEffect(() => { onUploadingChange?.(up.uploading); }, [up.uploading, onUploadingChange]);
  const yt = v.mode === 'youtube' && String(v.youtube_url || '').trim() ? parseYouTubeUrl(v.youtube_url) : null;
  const kindLabel = (k) => (k === 'image' ? s('Picture', 'صورة') : s('Video', 'فيديو'));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          ['none', s('None', 'من غير')],
          ['upload', s('Upload video or picture', 'ارفع فيديو أو صورة')],
          ['youtube', s('YouTube link', 'لينك يوتيوب')],
        ].map(([mode, label]) => (
          <Choice key={mode} theme={T} selected={v.mode === mode} onClick={() => onChange({ ...v, mode })}>{label}</Choice>
        ))}
      </div>

      {v.mode === 'upload' && (
        <div style={{ border: `1px dashed ${error ? T.danger : T.borderStrong}`, borderRadius: 10, padding: 12 }}>
          <input ref={fileRef} type="file" accept={MEDIA_ACCEPT} style={{ display: 'none' }}
            aria-label={s('Choose a video or picture', 'اختار فيديو أو صورة')}
            onChange={(e) => { const f = e.target.files?.[0]; if (fileRef.current) fileRef.current.value = ''; up.pick(f); }}/>
          {up.uploading ? (
            <UploadProgress theme={T} lang={lang} name={up.name} progress={up.progress} onCancel={up.cancel}/>
          ) : v.file?.path ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Badge theme={T} tone="info"><HRIcon name={v.file.kind === 'image' ? 'eye' : 'play'} size={11}/>{kindLabel(v.file.kind)}</Badge>
              <span className="mono" style={{ fontSize: 11, color: T.textMuted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {v.file.name || v.file.path.split('/').pop()}
              </span>
              <HRButton theme={T} variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>{s('Replace', 'غيّر')}</HRButton>
              <HRButton theme={T} variant="ghost" size="sm" onClick={() => { pending?.drop(v.file.path); onChange({ ...v, file: null }); }}>{s('Remove', 'شيل')}</HRButton>
            </div>
          ) : (
            <HRButton theme={T} variant="secondary" size="sm" icon="plus" onClick={() => fileRef.current?.click()}>{s('Choose a file', 'اختار ملف')}</HRButton>
          )}
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 8, lineHeight: 1.5 }}>
            {s('An MP4 or MOV video, or a PNG or JPEG picture, up to 50 MB. A phone video over 50 MB: export it at 720p or use a YouTube link.',
               'فيديو MP4 أو MOV، أو صورة PNG أو JPEG، لحد ٥٠ ميجا. فيديو الموبايل لو أكبر من ٥٠ ميجا: صدّره بجودة 720p أو استخدم لينك يوتيوب.')}
          </div>
          <ErrorText theme={T} lang={lang} error={up.error}/>
        </div>
      )}

      {v.mode === 'youtube' && (
        <div>
          <input value={v.youtube_url || ''} dir="ltr" inputMode="url" placeholder="https://youtu.be/…"
            aria-label={s('YouTube link', 'لينك يوتيوب')}
            onChange={(e) => onChange({ ...v, youtube_url: e.target.value })}
            style={inputStyle(T, !!error)}/>
          {yt && !error && (
            <div style={{ fontSize: 11, marginTop: 5, color: yt.ok ? T.positive : T.danger }}>
              {yt.ok ? s('YouTube video found.', 'لقينا الفيديو.') : msgText(youtubeMessage(yt.reason), lang)}
            </div>
          )}
        </div>
      )}
      <ErrorText theme={T} lang={lang} error={error}/>
    </div>
  );
}

// The sprint 1 player for form media or a saved row's media fields.
export function MediaPreview({ theme, lang, fields, resolve, title, emptyText }) {
  const [payload, setPayload] = React.useState(null);
  const key = fields ? `${fields.media_type}|${fields.media_bucket}|${fields.media_path}|${fields.media_youtube_id}` : '';
  React.useEffect(() => {
    let live = true;
    if (!fields?.media_type) { setPayload(null); return undefined; }
    Promise.resolve(resolve ? resolve(fields) : null)
      .then((p) => { if (live) setPayload(p || null); })
      .catch(() => { if (live) setPayload(null); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!payload) {
    return emptyText ? <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 12 }}>{emptyText}</div> : null;
  }
  return <HabitMedia theme={theme} lang={lang} payload={payload} title={title} style={{ marginTop: 12 }}/>;
}

// Form media → fields for MediaPreview.
export const formMediaFields = (m) => mediaFields(m);

// "Original table": one picture or PDF next to the routine.
export function SourceFileField({ theme, lang, value, onChange, media, pending, folder = 'routines', onUploadingChange }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const fileRef = React.useRef(null);
  const [url, setUrl] = React.useState(null);
  const up = useUploader({
    media, folder, kinds: ['image', 'pdf'], pending,
    onUploaded: (file) => {
      if (value?.path) pending?.drop(value.path);
      onChange({ bucket: file.bucket, path: file.path, mime: file.mime, name: file.name });
    },
  });
  React.useEffect(() => { onUploadingChange?.(up.uploading); }, [up.uploading, onUploadingChange]);
  React.useEffect(() => {
    let live = true;
    setUrl(null);
    if (value?.path && media?.url) {
      Promise.resolve(media.url({ bucket: value.bucket, path: value.path })).then((u) => { if (live) setUrl(u || null); }).catch(() => {});
    }
    return () => { live = false; };
  }, [value?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ border: `1px dashed ${T.borderStrong}`, borderRadius: 10, padding: 12 }}>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf" style={{ display: 'none' }}
        aria-label={s('Choose the original table', 'اختار الجدول الأصلي')}
        onChange={(e) => { const f = e.target.files?.[0]; if (fileRef.current) fileRef.current.value = ''; up.pick(f); }}/>
      {up.uploading ? (
        <UploadProgress theme={T} lang={lang} name={up.name} progress={up.progress} onCancel={up.cancel}/>
      ) : value?.path ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Badge theme={T} tone="info"><HRIcon name="content" size={11}/>{value.mime === 'application/pdf' ? 'PDF' : s('Picture', 'صورة')}</Badge>
          <span className="mono" style={{ fontSize: 11, color: T.textMuted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value.name || value.path.split('/').pop()}
          </span>
          {url && <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: T.accent, fontWeight: 600 }}>{s('Open', 'افتح')}</a>}
          <HRButton theme={T} variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>{s('Replace', 'غيّر')}</HRButton>
          <HRButton theme={T} variant="ghost" size="sm" onClick={() => { pending?.drop(value.path); onChange(null); }}>{s('Remove', 'شيل')}</HRButton>
        </div>
      ) : (
        <HRButton theme={T} variant="secondary" size="sm" icon="plus" onClick={() => fileRef.current?.click()}>
          {s('Attach a picture or PDF', 'ارفع صورة أو PDF')}
        </HRButton>
      )}
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 8, lineHeight: 1.5 }}>
        {s('Employees can open it from "See the full schedule". Up to 50 MB.', 'الموظفين يقدروا يفتحوه من «شوف الجدول كله». لحد ٥٠ ميجا.')}
      </div>
      <ErrorText theme={T} lang={lang} error={up.error}/>
    </div>
  );
}
