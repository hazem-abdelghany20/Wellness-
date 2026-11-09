// Voice-note recorder for HR broadcasts: a small state machine (pure) and the
// browser helpers around MediaRecorder.
//
//   idle ──record──▶ requesting ──mic ok──▶ recording ──stop / 3 min──▶ recorded
//     ▲                  │                                              │
//     │                  └──blocked / no mic / unsupported──▶ error     │
//     └──────────────────────────── redo ◀──────────────────────────────┘

export const MAX_RECORD_SECONDS = 180;

export const initialRecorderState = Object.freeze({
  status: 'idle',   // idle | requesting | recording | recorded | error
  seconds: 0,       // while recording: elapsed; once recorded: length
  error: null,      // blocked | no_mic | busy | unsupported | insecure | failed | empty
  blob: null,
  url: null,
  mime: null,
});

// Events: record · started · tick · stopped {blob, url, mime, seconds} · failed {error} · reset
export function recorderReducer(state, event) {
  const s = state || initialRecorderState;
  switch (event?.type) {
    case 'record':
      return s.status === 'requesting' || s.status === 'recording' ? s : { ...initialRecorderState, status: 'requesting' };
    case 'started':
      return s.status === 'requesting' ? { ...s, status: 'recording', seconds: 0 } : s;
    case 'tick':
      return s.status === 'recording' ? { ...s, seconds: Math.min(MAX_RECORD_SECONDS, s.seconds + 1) } : s;
    case 'stopped': {
      if (s.status !== 'recording') return s;
      if (!event.blob || !event.blob.size) return { ...initialRecorderState, status: 'error', error: 'empty' };
      const secs = Number.isFinite(event.seconds) ? event.seconds : s.seconds;
      return { ...s, status: 'recorded', blob: event.blob, url: event.url || null, mime: event.mime || event.blob.type || null,
               seconds: Math.max(1, Math.round(secs)) };
    }
    case 'failed':
      return { ...initialRecorderState, status: 'error', error: event.error || 'failed' };
    case 'reset':
      return initialRecorderState;
    default:
      return s;
  }
}

// Has the time run out (auto-stop at 3 minutes)?
export const shouldAutoStop = (state) => state?.status === 'recording' && state.seconds >= MAX_RECORD_SECONDS;

// getUserMedia / MediaRecorder failure → error code.
export function recorderErrorCode(err) {
  const name = String(err?.name || '');
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'blocked';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'no_mic';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy';
  if (name === 'NotSupportedError' || err?.code === 'unsupported') return 'unsupported';
  return 'failed';
}

// Can this browser record at all? → 'ok' | 'insecure' | 'unsupported'.
export function recorderSupport(env = globalThis) {
  if (env?.isSecureContext === false) return 'insecure';
  const md = env?.navigator?.mediaDevices;
  if (!md || typeof md.getUserMedia !== 'function' || typeof env?.MediaRecorder !== 'function') return 'unsupported';
  return 'ok';
}

// The best recording type the browser offers. iPhones play audio/mp4 (m4a)
// everywhere; Chrome / Firefox record webm-opus, which the backend accepts.
export const RECORDER_MIME_PREFERENCE = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
];
export function pickRecorderMime(isTypeSupported) {
  if (typeof isTypeSupported !== 'function') return '';
  for (const m of RECORDER_MIME_PREFERENCE) {
    try { if (isTypeSupported(m)) return m; } catch { /* keep looking */ }
  }
  return '';
}

const EXT = { 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/ogg': 'ogg' };
export const baseMime = (mime) => String(mime || '').toLowerCase().split(';')[0].trim();

// 'voice-note-2026-11-09-1405.m4a'
export function recordingFileName(mime, now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
  return `voice-note-${stamp}.${EXT[baseMime(mime)] || 'webm'}`;
}

// A recorded blob as a File the uploader takes (type without codec parameters).
export function recordingToFile(blob, mime, now = new Date()) {
  const type = baseMime(mime || blob?.type) || 'audio/webm';
  const name = recordingFileName(type, now);
  if (typeof File === 'function') return new File([blob], name, { type });
  return Object.assign(blob, { name });
}

// Messages for the recorder states, EN / AR.
export const RECORDER_ERRORS = {
  blocked: {
    en: 'The browser blocked the microphone. Allow it from the icon in the address bar, or upload an audio file instead.',
    ar: 'المتصفح قفل المايك. اسمح بيه من الأيقونة اللي في شريط العنوان، أو ارفع ملف صوت بدل كده.',
  },
  no_mic: {
    en: 'No microphone was found. Plug one in, or upload an audio file instead.',
    ar: 'مفيش مايك. وصّل واحد، أو ارفع ملف صوت بدل كده.',
  },
  busy: {
    en: 'Another app is using the microphone. Close it and try again.',
    ar: 'فيه برنامج تاني بيستخدم المايك. اقفله وجرّب تاني.',
  },
  unsupported: {
    en: 'This browser can’t record. Upload an audio file instead (MP3 or M4A).',
    ar: 'المتصفح ده مبيسجّلش. ارفع ملف صوت بدل كده (MP3 أو M4A).',
  },
  insecure: {
    en: 'Recording works only on the secure (https) portal. Upload an audio file instead.',
    ar: 'التسجيل بيشتغل بس على البوابة الآمنة (https). ارفع ملف صوت بدل كده.',
  },
  empty: {
    en: 'Nothing was recorded. Try again and speak close to the microphone.',
    ar: 'مفيش حاجة اتسجّلت. جرّب تاني واتكلم قريب من المايك.',
  },
  failed: {
    en: 'The recording stopped unexpectedly. Try again, or upload a file.',
    ar: 'التسجيل وقف فجأة. جرّب تاني، أو ارفع ملف.',
  },
};

export function recorderErrorText(code, lang) {
  const m = RECORDER_ERRORS[code] || RECORDER_ERRORS.failed;
  return lang === 'ar' ? m.ar : m.en;
}
