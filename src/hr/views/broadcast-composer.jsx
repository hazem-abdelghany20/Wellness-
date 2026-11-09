import React from 'react';
import { DENSITY } from '../../shared/tokens.jsx';
import { HRButton, HRIcon, Panel, Badge } from '../../shared/components.jsx';
import { Field, Choice, LangPair, inputStyle } from '../../shared/authoring/ui.jsx';
import { usePendingUploads } from '../../shared/authoring/media-field.jsx';
import { clean, orNull } from '../../shared/authoring/text.js';
import { libraryError, errorCode } from '../../shared/authoring/errors.js';
import { AUDIO_ACCEPT, MAX_MEDIA_BYTES } from '../../lib/supabase-routines';
import { audioMimeOf } from '../../lib/supabase-broadcasts';
import { TIMEZONES } from './settings-routine.jsx';
import {
  previewDelivery, zonedToUtcIso, utcToZoned, fmtCompanyDateTime, fmtDuration, DEFAULT_QUIET_WINDOW, broadcastErrorCopy,
} from '../lib/broadcast-schedule.js';
import { useVoiceRecorder } from '../lib/use-voice-recorder.js';
import { recordingToFile, recorderErrorText, MAX_RECORD_SECONDS } from '../lib/recorder.js';

const AUDIO_ERRORS = {
  bad_audio_type: ['Use an audio file: MP3 or M4A (also WEBM or OGG).', 'استخدم ملف صوت: MP3 أو M4A (أو WEBM أو OGG).'],
  too_large: ['That audio file is over 50 MB. Shorten it or export it as MP3.', 'ملف الصوت أكبر من ٥٠ ميجا. قصّره أو صدّره MP3.'],
  cancelled: ['Upload cancelled.', 'الرفع اتلغى.'],
  failed: ['The upload failed. Check your connection and try again.', 'الرفع فشل. اتأكد من النت وجرّب تاني.'],
};
function audioErrorText(code, lang) {
  const m = AUDIO_ERRORS[code] || AUDIO_ERRORS.failed;
  return lang === 'ar' ? m[1] : m[0];
}
function uploadErrorCode(e) {
  if (e?.name === 'AbortError') return 'cancelled';
  const t = String(e?.code || e?.message || '');
  if (/bad_audio_type|bad_type/.test(t) || Number(e?.status) === 415) return 'bad_audio_type';
  if (/too_large/.test(t) || Number(e?.status) === 413) return 'too_large';
  return 'failed';
}

const arDigits = (t) => String(t || '').replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[Number(c)]);
const createUrl = (blob) => { try { return URL.createObjectURL(blob); } catch { return null; } };
const revokeUrl = (url) => { try { if (url && String(url).startsWith('blob:')) URL.revokeObjectURL(url); } catch { /* ignore */ } };

function formFrom(b, tz) {
  if (!b) {
    return {
      text: { title_en: '', title_ar: '', body_en: '', body_ar: '' },
      scope: 'all', teamId: '', when: { mode: 'now', date: '', time: '' }, audio: null,
    };
  }
  const z = utcToZoned(b.scheduled_at, tz);
  return {
    text: { title_en: b.title_en || '', title_ar: b.title_ar || '', body_en: b.body_en || '', body_ar: b.body_ar || '' },
    scope: b.scope === 'team' ? 'team' : 'all',
    teamId: b.team_id || '',
    when: z ? { mode: 'later', date: z.date, time: z.time } : { mode: 'now', date: '', time: '' },
    audio: b.media_path ? {
      source: 'saved', path: b.media_path, mime: b.media_mime, duration_s: b.media_duration_s ?? null, url: null,
      bucket: b.media_bucket || 'company-media', name: String(b.media_path).split('/').pop(),
    } : null,
  };
}

// The voice message part: upload a file or record one, with a player.
function AudioField({ theme, lang, audio, upload, error, onPick, onCancelUpload, onRemove, recorder, onRecordAgain, recordOpen, setRecordOpen }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const fileRef = React.useRef(null);
  const rec = recorder;
  const recording = rec.status === 'recording';

  if (upload) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textMid, marginBottom: 6, gap: 8 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s('Uploading', 'جارٍ رفع')} {upload.name}</span>
          <span className="mono">{upload.progress}%</span>
        </div>
        <div role="progressbar" aria-label={s('Upload progress', 'تقدّم الرفع')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={upload.progress}
          style={{ height: 6, borderRadius: 99, background: T.panelSunk, overflow: 'hidden' }}>
          <div style={{ width: `${upload.progress}%`, height: '100%', background: T.accent, transition: 'width .2s' }}/>
        </div>
        <HRButton theme={T} variant="ghost" size="sm" style={{ marginTop: 8 }} onClick={onCancelUpload}>{s('Cancel upload', 'إلغاء الرفع')}</HRButton>
      </div>
    );
  }

  if (audio) {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        {audio.url
          ? <audio controls src={audio.url} preload="metadata" style={{ width: '100%', maxWidth: 420 }} aria-label={s('Preview the voice message', 'اسمع الرسالة الصوتية')}/>
          : <div style={{ fontSize: 12, color: T.textMuted }}>{s('Loading the player…', 'جارٍ تحميل المشغّل…')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge theme={T} tone="info"><HRIcon name="headphones" size={11}/>{audio.duration_s ? fmtDuration(audio.duration_s) : s('Audio', 'صوت')}</Badge>
          <span className="mono" style={{ fontSize: 11, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260, whiteSpace: 'nowrap' }}>{audio.name}</span>
          {audio.source === 'record' && <HRButton theme={T} size="sm" variant="secondary" onClick={onRecordAgain}>{s('Record again', 'سجّل تاني')}</HRButton>}
          <HRButton theme={T} size="sm" variant="ghost" onClick={onRemove}>{s('Remove audio', 'شيل الصوت')}</HRButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept={AUDIO_ACCEPT} style={{ display: 'none' }} aria-label={s('Choose an audio file', 'اختار ملف صوت')}
        onChange={(e) => { const f = e.target.files?.[0]; if (fileRef.current) fileRef.current.value = ''; if (f) onPick(f); }}/>
      {!recordOpen ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <HRButton theme={T} size="sm" variant="secondary" icon="download" onClick={() => fileRef.current?.click()}>{s('Upload an audio file', 'ارفع ملف صوت')}</HRButton>
          <HRButton theme={T} size="sm" variant="secondary" icon="headphones" onClick={() => setRecordOpen(true)}>{s('Record in the browser', 'سجّل من المتصفح')}</HRButton>
        </div>
      ) : (
        <div style={{ padding: 12, borderRadius: 10, border: `1px solid ${T.border}`, background: T.panelSunk }}>
          {rec.status === 'requesting' ? (
            <div role="status" style={{ fontSize: 13, color: T.textMid }}>{s('Allow the microphone when the browser asks…', 'اسمح بالمايك لما المتصفح يسأل…')}</div>
          ) : recording ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 99, background: T.danger, animation: 'pulse 1s infinite' }}/>
              <span role="status" className="mono" style={{ fontSize: 13, color: T.text }}>
                {s('Recording', 'بيسجّل')} {fmtDuration(rec.seconds)} / {fmtDuration(rec.max || MAX_RECORD_SECONDS)}
              </span>
              <HRButton theme={T} size="sm" variant="primary" onClick={rec.stop}>{s('Stop', 'وقّف')}</HRButton>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <HRButton theme={T} size="sm" variant="primary" onClick={rec.start}>
                {rec.status === 'error' ? s('Try again', 'جرّب تاني') : s('● Start recording', '● ابدأ التسجيل')}
              </HRButton>
              <HRButton theme={T} size="sm" variant="ghost" onClick={() => { rec.reset(); setRecordOpen(false); }}>{s('Back', 'رجوع')}</HRButton>
              <span style={{ fontSize: 12, color: T.textMuted }}>{s('Up to 3 minutes. Stop when you’re done; you can listen before sending.', 'لحد ٣ دقايق. وقّف لما تخلص؛ وتقدر تسمعه قبل ما تبعت.')}</span>
            </div>
          )}
          {rec.status === 'error' && <div role="alert" style={{ fontSize: 12, color: T.danger, marginTop: 8 }}>{recorderErrorText(rec.error, lang)}</div>}
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: 12, color: T.danger, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

// Compose (or edit, while scheduled) a broadcast: title + message EN/AR,
// optional voice message, audience, and when (company time, quiet hours).
export function BroadcastComposer({ theme, lang, density, api, teams = [], company, editing = null, onSaved, onCancelEdit, recorderEnv }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const tz = company?.timezone || 'UTC';
  const quiet = company?.quiet_hours !== false;
  const window = company?.quiet_window || DEFAULT_QUIET_WINDOW;
  const initial = React.useMemo(() => formFrom(editing, tz), [editing, tz]);
  const [text, setText] = React.useState(initial.text);
  const [scope, setScope] = React.useState(initial.scope);
  const [teamId, setTeamId] = React.useState(initial.teamId);
  const [when, setWhen] = React.useState(initial.when);
  const [audio, setAudio] = React.useState(initial.audio);
  const audioRef = React.useRef(audio);
  audioRef.current = audio;
  const [audioChanged, setAudioChanged] = React.useState(false);
  const [upload, setUpload] = React.useState(null);
  const [audioError, setAudioError] = React.useState(null);
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const abortRef = React.useRef(null);
  const attachedBlob = React.useRef(null);
  const pending = usePendingUploads(api.discardAudio);
  const recorder = useVoiceRecorder(recorderEnv ? { env: recorderEnv } : undefined);
  const [nowTick, setNowTick] = React.useState(0);

  // Keep "now" in company time fresh while the page is open.
  React.useEffect(() => { const id = setInterval(() => setNowTick((t) => t + 1), 30000); return () => clearInterval(id); }, []);
  const now = React.useMemo(() => utcToZoned(new Date().toISOString(), tz), [tz, nowTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // A saved voice message (editing): fetch a playable URL.
  React.useEffect(() => {
    let live = true;
    if (audio?.source === 'saved' && !audio.url && api.audioUrl) {
      Promise.resolve(api.audioUrl({ media_bucket: audio.bucket, media_path: audio.path }))
        .then((url) => { if (live && url) setAudio((a) => (a && a.path === audio.path ? { ...a, url } : a)); })
        .catch(() => {});
    }
    return () => { live = false; };
  }, [audio?.source, audio?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  // Free the preview URL when it's replaced or the composer closes.
  const urlRef = React.useRef(null);
  React.useEffect(() => {
    const prev = urlRef.current;
    urlRef.current = audio?.url || null;
    if (prev && prev !== urlRef.current) revokeUrl(prev);
  }, [audio?.url]);
  React.useEffect(() => () => { abortRef.current?.abort(); revokeUrl(urlRef.current); }, []);

  const dropAudio = React.useCallback((a) => {
    if (a?.source !== 'saved' && a?.path) pending.drop(a.path);
  }, [pending]);

  const attach = React.useCallback(async (file, source, seconds) => {
    setAudioError(null);
    const mime = audioMimeOf(file);
    if (!mime) { setAudioError(audioErrorText('bad_audio_type', lang)); return; }
    if (typeof file.size === 'number' && file.size > MAX_MEDIA_BYTES) { setAudioError(audioErrorText('too_large', lang)); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const name = file.name || (lang === 'ar' ? 'رسالة صوتية' : 'Voice message');
    setUpload({ progress: 0, name });
    try {
      const up = await api.uploadAudio(file, {
        signal: ctrl.signal,
        onProgress: (pct) => setUpload((u) => (u ? { ...u, progress: pct } : u)),
      });
      pending.add(up.path);
      dropAudio(audioRef.current);
      setAudio({
        source, path: up.path, mime: up.mime || mime, name,
        duration_s: up.duration_s ?? (seconds ? Math.round(seconds) : null),
        url: createUrl(file),
      });
      setAudioChanged(true);
      setRecordOpen(false);
    } catch (e) {
      setAudioError(audioErrorText(uploadErrorCode(e), lang));
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setUpload(null);
    }
  }, [api, lang, pending, dropAudio]);

  // A finished recording is uploaded straight away.
  React.useEffect(() => {
    if (recorder.status === 'recorded' && recorder.blob && attachedBlob.current !== recorder.blob) {
      attachedBlob.current = recorder.blob;
      attach(recordingToFile(recorder.blob, recorder.mime), 'record', recorder.seconds);
    }
  }, [recorder.status, recorder.blob, recorder.mime, recorder.seconds, attach]);

  function removeAudio() {
    dropAudio(audio);
    setAudio(null);
    setAudioChanged(true);
    recorder.reset();
    setRecordOpen(false);
  }

  function recordAgain() {
    dropAudio(audio);
    setAudio(null);
    setAudioChanged(true);
    recorder.reset();
    setRecordOpen(true);
    recorder.start();
  }

  const preview = previewDelivery(when, { now, tz, quiet, window });
  const zoneLabel = (TIMEZONES.find((z) => z.id === tz)?.[lang === 'ar' ? 'ar' : 'en']) || tz;
  const hasText = !!(clean(text.body_en) || clean(text.body_ar));

  function validate() {
    if (!clean(text.title_en)) return s('Add the title in English.', 'اكتب العنوان بالإنجليزي.');
    if (!hasText && !audio) return s('Write the message, or add a voice message.', 'اكتب الرسالة، أو ضيف رسالة صوتية.');
    if (scope === 'team' && !teamId) return s('Pick the team.', 'اختار الفريق.');
    if (when.mode === 'later' && (!when.date || !when.time)) return s('Pick the date and the time.', 'اختار اليوم والساعة.');
    if (upload) return s('Wait for the audio to finish uploading.', 'استنى لما الصوت يخلص رفع.');
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    const input = {
      ...(editing ? { id: editing.id } : {}),
      title_en: clean(text.title_en),
      title_ar: orNull(text.title_ar),
      body_en: orNull(text.body_en),
      body_ar: orNull(text.body_ar),
      scope,
      team_id: scope === 'team' ? teamId : null,
      scheduled_at: when.mode === 'later' && !preview.past ? zonedToUtcIso(when.date, when.time, tz) : null,
      ...(audioChanged || (!editing && audio) ? { audio: audio ? { path: audio.path, mime: audio.mime, duration_s: audio.duration_s ?? null } : null } : {}),
    };
    try {
      const saved = await pending.saving(audio && audio.source !== 'saved' ? [audio.path] : [], () => api.save(input));
      onSaved?.(saved, { isEdit: !!editing });
    } catch (e) {
      setError(broadcastErrorCopy(errorCode(e), lang) || libraryError(e, lang));
    } finally {
      setBusy(false);
    }
  }

  const deliveryText = (() => {
    const day = fmtCompanyDateTime(preview.date, null, lang);
    const time = lang === 'ar' ? arDigits(preview.time) : preview.time;
    if (preview.sendNow) {
      if (preview.moved) return s(`Quiet hours now: it will arrive at ${preview.time} on ${day}.`, `دلوقتي ساعات هدوء: هتوصل الساعة ${time} يوم ${day}.`);
      if (preview.past) return s('That time has passed, so it goes out as soon as you send it.', 'الوقت ده فات، فهتتبعت أول ما تدوس إرسال.');
      return s('Goes out as soon as you send it.', 'هتتبعت أول ما تدوس إرسال.');
    }
    if (preview.moved) return s(`Will arrive at ${preview.time} — quiet hours (${day}).`, `هتوصل الساعة ${time} — ساعات الهدوء (${day}).`);
    return s(`Will arrive ${fmtCompanyDateTime(preview.date, preview.time, 'en')}.`, `هتوصل ${fmtCompanyDateTime(preview.date, preview.time, 'ar')}.`);
  })();

  const sendLabel = busy
    ? s('Saving…', 'جارٍ الحفظ…')
    : editing ? s('Save changes', 'احفظ التعديل')
    : preview.sendNow
      ? (preview.moved ? s(`Send (arrives at ${preview.time})`, `ابعت (هتوصل الساعة ${arDigits(preview.time)})`) : s('Send now', 'ابعت دلوقتي'))
      : s('Schedule', 'جدولة');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: DENSITY[density].gap, alignItems: 'start' }}>
    <Panel theme={T} density={density}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {editing ? s('Edit scheduled message', 'تعديل رسالة متجدولة') : s('New message', 'رسالة جديدة')}
        </div>
        {editing && <HRButton theme={T} size="sm" variant="ghost" icon="close" onClick={onCancelEdit}>{s('Stop editing', 'بطّل تعديل')}</HRButton>}
      </div>

      <Field theme={T} label={s('Title', 'العنوان')}>
        <LangPair theme={T} lang={lang} form={text} base="title" label={s('Title', 'العنوان')} max={160}
          onChange={(k, v) => setText((f) => ({ ...f, [k]: v }))} placeholderEn="Stretch break at 11" placeholderAr="استراحة إطالة الساعة ١١"/>
      </Field>
      <Field theme={T} label={s('Message', 'الرسالة')} optional={!!audio} lang={lang}
        hint={audio ? s('With a voice message, the text is optional.', 'مع الرسالة الصوتية، النص اختياري.') : null}>
        <LangPair theme={T} lang={lang} form={text} base="body" label={s('Message', 'الرسالة')} multiline rows={4} max={2000}
          onChange={(k, v) => setText((f) => ({ ...f, [k]: v }))}/>
      </Field>

      <Field theme={T} label={s('Voice message', 'رسالة صوتية')} optional lang={lang}
        hint={s('A short voice note or podcast, up to 50 MB. MP3 or M4A plays best on iPhones.', 'رسالة صوتية قصيرة أو بودكاست، لحد ٥٠ ميجا. MP3 أو M4A أحسن للآيفون.')}>
        <AudioField theme={T} lang={lang} audio={audio} upload={upload} error={audioError}
          onPick={(f) => attach(f, 'upload')} onCancelUpload={() => abortRef.current?.abort()} onRemove={removeAudio}
          recorder={recorder} onRecordAgain={recordAgain} recordOpen={recordOpen} setRecordOpen={setRecordOpen}/>
      </Field>

      <Field theme={T} label={s('Who gets it', 'مين ياخدها')}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Choice theme={T} selected={scope === 'all'} onClick={() => setScope('all')}>{s('Everyone', 'كل الموظفين')}</Choice>
          <Choice theme={T} selected={scope === 'team'} onClick={() => setScope('team')} disabled={!teams.length}
            title={!teams.length ? s('Make teams in People → Teams first', 'اعمل فرق من الأشخاص ← الفرق الأول') : undefined}>{s('One team', 'فريق واحد')}</Choice>
          {scope === 'team' && (
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label={s('Team', 'الفريق')} style={{ ...inputStyle(T), width: 200 }}>
              <option value="">{s('Pick a team…', 'اختار فريق…')}</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>
      </Field>

      <Field theme={T} label={s('When', 'إمتى')} hint={s(`Company time (${zoneLabel}).`, `بتوقيت الشركة (${zoneLabel}).`)}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Choice theme={T} selected={when.mode === 'now'} onClick={() => setWhen((w) => ({ ...w, mode: 'now' }))}>{s('Now', 'دلوقتي')}</Choice>
          <Choice theme={T} selected={when.mode === 'later'} onClick={() => setWhen((w) => ({
            mode: 'later', date: w.date || now?.date || '', time: w.time || '09:00',
          }))}>{s('Pick a time', 'اختار وقت')}</Choice>
          {when.mode === 'later' && (
            <>
              <input type="date" value={when.date} min={now?.date} onChange={(e) => setWhen((w) => ({ ...w, date: e.target.value }))}
                aria-label={s('Date', 'اليوم')} style={{ ...inputStyle(T), width: 160 }}/>
              <input type="time" value={when.time} step={300} onChange={(e) => setWhen((w) => ({ ...w, time: e.target.value }))}
                aria-label={s('Time', 'الساعة')} style={{ ...inputStyle(T), width: 120 }}/>
            </>
          )}
        </div>
        <div role="status" style={{ marginTop: 8, fontSize: 12, color: preview.moved ? T.caution : T.textMid, fontWeight: preview.moved ? 600 : 400 }}>
          {deliveryText}
        </div>
      </Field>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <HRButton theme={T} variant="primary" icon="broadcasts" disabled={busy || !!upload || recorder.status === 'recording'} onClick={submit}>{sendLabel}</HRButton>
        {error && <span role="alert" style={{ fontSize: 12, color: T.danger }}>{error}</span>}
      </div>
    </Panel>
    <BroadcastPreview theme={T} lang={lang} density={density}
      title={lang === 'ar' ? (clean(text.title_ar) || clean(text.title_en)) : clean(text.title_en)}
      body={lang === 'ar' ? (clean(text.body_ar) || clean(text.body_en)) : clean(text.body_en)}
      hasAudio={!!audio} duration={audio?.duration_s}/>
    </div>
  );
}

// Phone-style preview of what employees see.
export function BroadcastPreview({ theme, lang, density, title, body, hasAudio, duration }) {
  const T = theme;
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  return (
    <Panel theme={T} density={density}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>{s('Preview · in the app', 'معاينة · في التطبيق')}</div>
      <div style={{ background: '#0E2A26', borderRadius: 18, padding: 20, color: '#F5F1E8', minHeight: 160 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <img src="/wellness-mark.png" alt="" style={{ height: 16, filter: 'brightness(0) invert(1)' }}/>
          <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 600, letterSpacing: 0.3 }}><bdi>WELLNESS+</bdi> · {s('From your HR team', 'من فريق الموارد البشرية')}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: -0.2 }}>{title || s('Your title…', 'العنوان…')}</div>
        {body ? <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{body}</div> : null}
        {hasAudio && (
          <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 99, background: 'rgba(245,241,232,0.12)', fontSize: 12 }}>
            <HRIcon name="play" size={12}/>{s('Voice message', 'رسالة صوتية')}{duration ? ` · ${fmtDuration(duration)}` : ''}
          </div>
        )}
        {!body && !hasAudio && <div style={{ fontSize: 13, opacity: 0.6 }}>{s('Your message…', 'نص الرسالة…')}</div>}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
        {s('People get it in the app, and as a phone notification if they switched notifications on.', 'الناس بتوصلهم في التطبيق، وكإشعار على الموبايل لو مشغّلين الإشعارات.')}
      </div>
    </Panel>
  );
}
