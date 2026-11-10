import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// supabase client stub: signed-in HR of company c1.
const rpc = vi.fn();
const invoke = vi.fn();
const bucket = { createSignedUrls: vi.fn(), getPublicUrl: vi.fn(), remove: vi.fn() };
const query = {
  select: vi.fn(() => query), eq: vi.fn(() => query), update: vi.fn(() => query),
  order: vi.fn(async () => ({ data: [{ id: 'old' }], error: null })),
};
const from = vi.fn(() => query);
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'jwt-hr' } } })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1', app_metadata: { company_id: 'c1' } } } })),
      onAuthStateChange: vi.fn(),
    },
    rpc, from, storage: { from: vi.fn(() => bucket) }, functions: { invoke },
  })),
}));

class FakeXHR {
  static last = null;
  static sent = 0;
  constructor() { this.headers = {}; this.upload = {}; FakeXHR.last = this; }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(k, v) { this.headers[k] = v; }
  abort() { this.onabort?.(); }
  send(body) {
    FakeXHR.sent += 1;
    this.body = body;
    this.upload.onprogress?.({ lengthComputable: true, loaded: 2, total: 4 });
    queueMicrotask(() => { this.status = 200; this.responseText = '{}'; this.onload?.(); });
  }
}

// <audio> double: reports a duration once metadata "loads".
class FakeAudio {
  constructor() { this.duration = 42.4; }
  set src(_v) { queueMicrotask(() => this.onloadedmetadata?.()); }
}

let realXHR;
let realAudio;
let lib;
beforeEach(async () => {
  vi.clearAllMocks();
  rpc.mockImplementation(async (name, args) => ({ data: { name, args }, error: null }));
  realXHR = globalThis.XMLHttpRequest;
  realAudio = globalThis.Audio;
  globalThis.XMLHttpRequest = FakeXHR;
  globalThis.Audio = FakeAudio;
  FakeXHR.sent = 0;
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  lib = await import('../supabase-broadcasts.ts');
  (await import('../supabase-routines.ts')).clearMediaUrlCache();
});
afterEach(() => { globalThis.XMLHttpRequest = realXHR; globalThis.Audio = realAudio; });

describe('HR broadcast RPCs', () => {
  it('listBroadcasts → hr_list_broadcasts', async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: 'b1' }], error: null });
    expect(await lib.listBroadcasts()).toEqual([{ id: 'b1' }]);
    expect(rpc).toHaveBeenCalledWith('hr_list_broadcasts', { p_limit: 100 });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await lib.listBroadcasts(10)).toEqual([]);
  });

  it('saveBroadcast sends the input; audio becomes the media fields (duration rounded)', async () => {
    await lib.saveBroadcast({
      title_en: 'Podcast', scope: 'team', team_id: 't1', scheduled_at: '2026-11-10T09:00:00+02:00',
      audio: { path: 'c1/broadcasts/a.mp3', mime: 'audio/mpeg', duration_s: 41.6 },
    });
    expect(rpc).toHaveBeenCalledWith('hr_save_broadcast', { p_input: {
      title_en: 'Podcast', scope: 'team', team_id: 't1', scheduled_at: '2026-11-10T09:00:00+02:00',
      media_bucket: 'company-media', media_path: 'c1/broadcasts/a.mp3', media_mime: 'audio/mpeg', media_duration_s: 42,
    } });
  });

  it('saveBroadcast: audio null removes it, audio left out keeps it', async () => {
    await lib.saveBroadcast({ id: 'b1', audio: null });
    expect(rpc).toHaveBeenLastCalledWith('hr_save_broadcast', { p_input: { id: 'b1', media_path: null } });
    await lib.saveBroadcast({ id: 'b1', title_en: 'x' });
    expect(rpc).toHaveBeenLastCalledWith('hr_save_broadcast', { p_input: { id: 'b1', title_en: 'x' } });
  });

  it('cancelBroadcast → hr_cancel_broadcast; errors come back as-is', async () => {
    await lib.cancelBroadcast('b1');
    expect(rpc).toHaveBeenCalledWith('hr_cancel_broadcast', { p_broadcast_id: 'b1' });
    const err = { message: 'broadcast_already_sent', code: '22023' };
    rpc.mockResolvedValueOnce({ data: null, error: err });
    await expect(lib.cancelBroadcast('b1')).rejects.toBe(err);
  });
});

describe('broadcast audio', () => {
  it('audioMimeOf: audio types only (MediaRecorder parameters dropped)', () => {
    expect(lib.audioMimeOf({ type: 'audio/mpeg' })).toBe('audio/mpeg');
    expect(lib.audioMimeOf({ type: 'audio/webm;codecs=opus' })).toBe('audio/webm');
    expect(lib.audioMimeOf({ type: '', name: 'Voice note.M4A' })).toBe('audio/mp4');
    expect(lib.audioMimeOf({ type: 'audio/x-m4a' })).toBe('audio/x-m4a');
    expect(lib.audioMimeOf({ type: 'video/mp4' })).toBeNull();
    expect(lib.audioMimeOf({ type: 'audio/wav', name: 'a.wav' })).toBeNull();
  });

  it('uploadBroadcastAudio refuses a non-audio file before sending anything', async () => {
    await expect(lib.uploadBroadcastAudio(new Blob(['x'], { type: 'video/mp4' }))).rejects.toMatchObject({ code: 'bad_audio_type' });
    expect(FakeXHR.sent).toBe(0);
  });

  it('uploadBroadcastAudio refuses > 50 MB before sending anything', async () => {
    const big = { type: 'audio/mpeg', name: 'big.mp3', size: 50 * 1024 * 1024 + 1 };
    await expect(lib.uploadBroadcastAudio(big)).rejects.toMatchObject({ code: 'too_large' });
    expect(FakeXHR.sent).toBe(0);
  });

  it('uploadBroadcastAudio puts it in {company}/broadcasts/ with progress and reads the length', async () => {
    const progress = [];
    const out = await lib.uploadBroadcastAudio(new Blob(['abc'], { type: 'audio/mpeg' }), { onProgress: (p) => progress.push(p) });
    expect(FakeXHR.last.url).toMatch(/\/storage\/v1\/object\/company-media\/c1\/broadcasts\/\d+-[a-z0-9]+\.mp3$/);
    expect(FakeXHR.last.headers['Content-Type']).toBe('audio/mpeg');
    expect(progress).toContain(50);
    expect(progress.at(-1)).toBe(100);
    expect(out).toMatchObject({ mime: 'audio/mpeg', duration_s: 42, upload: { kind: 'audio', bucket: 'company-media' } });
    expect(out.path).toBe(out.upload.path);
  });

  it('getBroadcastMedia skips the call for no ids', async () => {
    expect(await lib.getBroadcastMedia([])).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('getBroadcastAudioUrl signs the file (cached for a day)', async () => {
    rpc.mockResolvedValue({ data: [{ broadcast_id: 'b1', media_type: 'audio', media_bucket: 'company-media',
      media_path: 'c1/broadcasts/a.mp3', media_mime: 'audio/mpeg', media_duration_s: 42 }], error: null });
    bucket.createSignedUrls.mockResolvedValue({ data: [{ path: 'c1/broadcasts/a.mp3', signedUrl: 'https://signed/a.mp3' }], error: null });
    expect(await lib.getBroadcastAudioUrl('b1')).toEqual({ url: 'https://signed/a.mp3', mime: 'audio/mpeg', duration_s: 42 });
    expect(rpc).toHaveBeenCalledWith('broadcast_media', { p_broadcast_ids: ['b1'] });
    await lib.getBroadcastAudioUrl('b1');
    expect(bucket.createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it('getBroadcastAudioUrl → null when there is no audio for me', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await lib.getBroadcastAudioUrl('b2')).toBeNull();
  });
});

describe('supabase-hr.ts broadcast calls (existing HR screen)', () => {
  it('schedule / cancel / list use the new RPCs', async () => {
    const hr = await import('../supabase-hr.ts');
    await hr.scheduleBroadcast({ title_en: 'x', body_en: 'y', scope: 'all', scheduled_at: '2026-11-10T08:00:00Z' });
    expect(rpc).toHaveBeenCalledWith('hr_save_broadcast', { p_input: { title_en: 'x', body_en: 'y', scope: 'all', scheduled_at: '2026-11-10T08:00:00Z' } });
    expect(invoke).not.toHaveBeenCalled();
    await hr.cancelBroadcast('b1');
    expect(rpc).toHaveBeenCalledWith('hr_cancel_broadcast', { p_broadcast_id: 'b1' });
    rpc.mockResolvedValueOnce({ data: [{ id: 'b1', deliver_at: 'x' }], error: null });
    expect(await hr.listBroadcasts()).toEqual([{ id: 'b1', deliver_at: 'x' }]);
    expect(from).not.toHaveBeenCalled();
  });

  it('fall back to the old calls while the sprint 3 SQL is not live', async () => {
    const missing = { code: 'PGRST202', message: 'Could not find the function public.hr_save_broadcast' };
    rpc.mockResolvedValue({ data: null, error: missing });
    invoke.mockResolvedValue({ data: { broadcast: { id: 'b9' } }, error: null });
    const hr = await import('../supabase-hr.ts');
    expect(await hr.scheduleBroadcast({ title_en: 'x', body_en: 'y', scope: 'all', scheduled_at: 'now' })).toEqual({ id: 'b9' });
    expect(invoke).toHaveBeenCalledWith('hr-schedule-broadcast', expect.anything());
    expect(await hr.listBroadcasts()).toEqual([{ id: 'old' }]);
    query.eq.mockResolvedValueOnce({ error: null });
    await hr.cancelBroadcast('b1');
    expect(query.update).toHaveBeenCalledWith({ status: 'cancelled' });
  });

  it('a real RPC error is not hidden by the fallback', async () => {
    const err = { code: '22023', message: 'body_required' };
    rpc.mockResolvedValue({ data: null, error: err });
    const hr = await import('../supabase-hr.ts');
    await expect(hr.scheduleBroadcast({ title_en: 'x', body_en: '', scope: 'all', scheduled_at: 'now' })).rejects.toBe(err);
    expect(invoke).not.toHaveBeenCalled();
  });
});
