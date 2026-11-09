import React from 'react';
import {
  recorderReducer, initialRecorderState, shouldAutoStop, recorderErrorCode, recorderSupport,
  pickRecorderMime, MAX_RECORD_SECONDS,
} from './recorder.js';

// Record a voice note in the browser (MediaRecorder). The state machine is
// in recorder.js; this hook owns the microphone, the timer and the object URL.
// env is injectable for tests (navigator.mediaDevices, MediaRecorder, URL).
export function useVoiceRecorder({ env = globalThis, max = MAX_RECORD_SECONDS } = {}) {
  const [state, dispatch] = React.useReducer(recorderReducer, initialRecorderState);
  const r = React.useRef({ stream: null, rec: null, chunks: [], timer: null, startedAt: 0, url: null, discard: false, alive: true });

  const stopTracks = React.useCallback(() => {
    const cur = r.current;
    if (cur.timer) { clearInterval(cur.timer); cur.timer = null; }
    try { cur.stream?.getTracks?.().forEach((t) => t.stop()); } catch { /* already stopped */ }
    cur.stream = null;
  }, []);

  const revoke = React.useCallback(() => {
    const cur = r.current;
    if (cur.url) { try { env.URL?.revokeObjectURL?.(cur.url); } catch { /* ignore */ } cur.url = null; }
  }, [env]);

  const stop = React.useCallback(() => {
    const rec = r.current.rec;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch { stopTracks(); }
    }
  }, [stopTracks]);

  const start = React.useCallback(async () => {
    const support = recorderSupport(env);
    if (support !== 'ok') { dispatch({ type: 'failed', error: support }); return; }
    revoke();
    dispatch({ type: 'record' });
    const cur = r.current;
    cur.discard = false;
    let stream;
    try {
      stream = await env.navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      if (cur.alive) dispatch({ type: 'failed', error: recorderErrorCode(e) });
      return;
    }
    if (!cur.alive) { try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ } return; }
    cur.stream = stream;
    try {
      const MR = env.MediaRecorder;
      const mime = pickRecorderMime(typeof MR.isTypeSupported === 'function' ? (m) => MR.isTypeSupported(m) : null);
      const rec = mime ? new MR(stream, { mimeType: mime }) : new MR(stream);
      cur.rec = rec;
      cur.chunks = [];
      rec.ondataavailable = (e) => { if (e?.data && e.data.size) cur.chunks.push(e.data); };
      rec.onerror = (e) => {
        stopTracks();
        if (cur.alive) dispatch({ type: 'failed', error: recorderErrorCode(e?.error || e) });
      };
      rec.onstop = () => {
        const seconds = (Date.now() - cur.startedAt) / 1000;
        stopTracks();
        cur.rec = null;
        if (!cur.alive || cur.discard) return;
        const type = rec.mimeType || mime || cur.chunks[0]?.type || 'audio/webm';
        const blob = new Blob(cur.chunks, { type });
        let url = null;
        try { url = blob.size ? env.URL?.createObjectURL?.(blob) || null : null; } catch { url = null; }
        cur.url = url;
        dispatch({ type: 'stopped', blob, url, mime: type, seconds });
      };
      rec.start(1000);
      cur.startedAt = Date.now();
      dispatch({ type: 'started' });
      cur.timer = setInterval(() => dispatch({ type: 'tick' }), 1000);
    } catch (e) {
      stopTracks();
      if (cur.alive) dispatch({ type: 'failed', error: recorderErrorCode(e) });
    }
  }, [env, revoke, stopTracks]);

  // Redo / remove: throw the take away.
  const reset = React.useCallback(() => {
    r.current.discard = true;
    stop();
    stopTracks();
    revoke();
    dispatch({ type: 'reset' });
  }, [stop, stopTracks, revoke]);

  React.useEffect(() => {
    if (shouldAutoStop(state) || (state.status === 'recording' && state.seconds >= max)) stop();
  }, [state, max, stop]);

  React.useEffect(() => {
    const cur = r.current;
    cur.alive = true;
    return () => {
      cur.alive = false;
      cur.discard = true;
      const rec = cur.rec;
      if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch { /* ignore */ } }
      if (cur.timer) clearInterval(cur.timer);
      try { cur.stream?.getTracks?.().forEach((t) => t.stop()); } catch { /* ignore */ }
      if (cur.url) { try { env.URL?.revokeObjectURL?.(cur.url); } catch { /* ignore */ } }
    };
  }, [env]);

  return { ...state, max, start, stop, reset };
}
