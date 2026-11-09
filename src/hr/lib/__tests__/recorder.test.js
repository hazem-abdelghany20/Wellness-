import { describe, it, expect } from 'vitest';
import {
  recorderReducer, initialRecorderState, shouldAutoStop, recorderErrorCode, recorderSupport, pickRecorderMime,
  recordingFileName, recordingToFile, recorderErrorText, MAX_RECORD_SECONDS, baseMime,
} from '../recorder.js';

const run = (events, from = initialRecorderState) => events.reduce(recorderReducer, from);

describe('recorder state machine', () => {
  it('goes idle → requesting → recording → recorded', () => {
    let st = run([{ type: 'record' }]);
    expect(st.status).toBe('requesting');
    st = run([{ type: 'started' }, { type: 'tick' }, { type: 'tick' }], st);
    expect(st).toMatchObject({ status: 'recording', seconds: 2 });
    const blob = new Blob(['abc'], { type: 'audio/webm' });
    st = recorderReducer(st, { type: 'stopped', blob, url: 'blob:x', mime: 'audio/webm;codecs=opus', seconds: 2.4 });
    expect(st).toMatchObject({ status: 'recorded', url: 'blob:x', mime: 'audio/webm;codecs=opus', seconds: 2 });
    expect(st.blob).toBe(blob);
  });

  it('redo resets, a second record while busy is ignored, and stray events do nothing', () => {
    const rec = run([{ type: 'record' }, { type: 'started' }]);
    expect(recorderReducer(rec, { type: 'record' })).toBe(rec);
    expect(recorderReducer(initialRecorderState, { type: 'tick' })).toBe(initialRecorderState);
    expect(recorderReducer(initialRecorderState, { type: 'started' })).toBe(initialRecorderState);
    expect(recorderReducer(initialRecorderState, { type: 'stopped', blob: new Blob(['x']) })).toBe(initialRecorderState);
    expect(recorderReducer(rec, { type: 'reset' })).toBe(initialRecorderState);
    expect(recorderReducer(rec, { type: 'nope' })).toBe(rec);
  });

  it('fails with a reason, an empty take is an error, and the limit stops it', () => {
    expect(run([{ type: 'record' }, { type: 'failed', error: 'blocked' }])).toMatchObject({ status: 'error', error: 'blocked' });
    const rec = run([{ type: 'record' }, { type: 'started' }]);
    expect(recorderReducer(rec, { type: 'stopped', blob: new Blob([]) })).toMatchObject({ status: 'error', error: 'empty' });
    let long = { ...rec, seconds: MAX_RECORD_SECONDS - 1 };
    expect(shouldAutoStop(long)).toBe(false);
    long = recorderReducer(long, { type: 'tick' });
    expect(long.seconds).toBe(MAX_RECORD_SECONDS);
    expect(shouldAutoStop(long)).toBe(true);
    expect(recorderReducer(long, { type: 'tick' }).seconds).toBe(MAX_RECORD_SECONDS); // never past 3:00
    // From an error you can try again.
    expect(recorderReducer({ ...initialRecorderState, status: 'error', error: 'blocked' }, { type: 'record' }).status).toBe('requesting');
  });
});

describe('recorder helpers', () => {
  it('maps browser errors', () => {
    expect(recorderErrorCode({ name: 'NotAllowedError' })).toBe('blocked');
    expect(recorderErrorCode({ name: 'SecurityError' })).toBe('blocked');
    expect(recorderErrorCode({ name: 'NotFoundError' })).toBe('no_mic');
    expect(recorderErrorCode({ name: 'NotReadableError' })).toBe('busy');
    expect(recorderErrorCode({ name: 'NotSupportedError' })).toBe('unsupported');
    expect(recorderErrorCode(new Error('x'))).toBe('failed');
    expect(recorderErrorText('blocked', 'en')).toMatch(/blocked the microphone/);
    expect(recorderErrorText('blocked', 'ar')).toMatch(/المايك/);
    expect(recorderErrorText('???', 'en')).toMatch(/stopped unexpectedly/);
  });

  it('checks support', () => {
    const ok = { isSecureContext: true, navigator: { mediaDevices: { getUserMedia() {} } }, MediaRecorder: function MR() {} };
    expect(recorderSupport(ok)).toBe('ok');
    expect(recorderSupport({ ...ok, isSecureContext: false })).toBe('insecure');
    expect(recorderSupport({ ...ok, MediaRecorder: undefined })).toBe('unsupported');
    expect(recorderSupport({ isSecureContext: true, navigator: {} , MediaRecorder: ok.MediaRecorder })).toBe('unsupported');
  });

  it('prefers m4a (plays on iPhones), then webm-opus', () => {
    expect(pickRecorderMime((m) => m === 'audio/mp4' || m === 'audio/webm')).toBe('audio/mp4');
    expect(pickRecorderMime((m) => m.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickRecorderMime(() => false)).toBe('');
    expect(pickRecorderMime(null)).toBe('');
    expect(pickRecorderMime(() => { throw new Error('x'); })).toBe('');
  });

  it('names the file and drops codec parameters', () => {
    const at = new Date(2026, 10, 9, 14, 5);
    expect(recordingFileName('audio/mp4', at)).toBe('voice-note-2026-11-09-1405.m4a');
    expect(recordingFileName('audio/webm;codecs=opus', at)).toBe('voice-note-2026-11-09-1405.webm');
    expect(baseMime('audio/webm;codecs=opus')).toBe('audio/webm');
    const f = recordingToFile(new Blob(['abc'], { type: 'audio/webm;codecs=opus' }), 'audio/webm;codecs=opus', at);
    expect(f.name).toBe('voice-note-2026-11-09-1405.webm');
    expect(f.type).toBe('audio/webm');
  });
});
