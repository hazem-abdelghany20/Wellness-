import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// supabase client stub: a signed-in admin session + storage helpers.
const storageBucket = {
  getPublicUrl: vi.fn((path) => ({ data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/content-assets/${path}` } })),
  remove: vi.fn(async () => ({ error: null })),
};
const fromResult = { data: [], error: null };
const query = {
  select: vi.fn(() => query), eq: vi.fn(() => query), order: vi.fn(async () => fromResult),
};
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'jwt-admin' } } })),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(() => query),
    rpc: vi.fn(),
    storage: { from: vi.fn(() => storageBucket) },
    functions: { invoke: vi.fn() },
  })),
}));

// Minimal XMLHttpRequest double that records the request.
class FakeXHR {
  static last = null;
  static respond = { status: 200, body: '{"Key":"content-assets/x"}' };
  constructor() { this.headers = {}; this.upload = {}; FakeXHR.last = this; }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(k, v) { this.headers[k] = v; }
  abort() { this.onabort?.(); }
  send(body) {
    this.body = body;
    this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
    queueMicrotask(() => {
      this.status = FakeXHR.respond.status;
      this.responseText = FakeXHR.respond.body;
      if (FakeXHR.respond.network) this.onerror?.(); else this.onload?.();
    });
  }
}

let realXHR;
beforeEach(() => {
  vi.clearAllMocks();
  realXHR = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = FakeXHR;
  FakeXHR.respond = { status: 200, body: '{}' };
});
afterEach(() => { globalThis.XMLHttpRequest = realXHR; });

describe('uploadChallengeMedia', () => {
  it('posts the file to content-assets with the admin JWT and reports progress', async () => {
    const { uploadChallengeMedia } = await import('../supabase-admin.ts');
    const progress = [];
    const blob = new Blob(['x'], { type: 'video/quicktime' });
    const out = await uploadChallengeMedia(blob, { contentType: 'video/quicktime', onProgress: (p) => progress.push(p) });
    const xhr = FakeXHR.last;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toMatch(/^https:\/\/test\.supabase\.co\/storage\/v1\/object\/content-assets\/challenges\/\d+-[a-z0-9]+\.mov$/);
    expect(xhr.headers).toMatchObject({
      Authorization: 'Bearer jwt-admin', apikey: 'test-anon-key', 'Content-Type': 'video/quicktime', 'x-upsert': 'false',
    });
    expect(xhr.body).toBe(blob);
    expect(progress).toEqual([50, 100]);
    expect(out.path).toMatch(/^challenges\/.+\.mov$/);
    expect(out.publicUrl).toBe(`https://test.supabase.co/storage/v1/object/public/content-assets/${out.path}`);
  });

  it('surfaces the storage status code (e.g. too large) and saves nothing', async () => {
    FakeXHR.respond = { status: 400, body: '{"statusCode":"413","error":"Payload too large","message":"The object exceeded the maximum allowed size"}' };
    const { uploadChallengeMedia } = await import('../supabase-admin.ts');
    await expect(uploadChallengeMedia(new Blob(['x']), { contentType: 'video/mp4' }))
      .rejects.toMatchObject({ status: 413, message: 'The object exceeded the maximum allowed size' });
    expect(storageBucket.getPublicUrl).not.toHaveBeenCalled();
  });

  it('reports network failures', async () => {
    FakeXHR.respond = { network: true };
    const { uploadChallengeMedia } = await import('../supabase-admin.ts');
    await expect(uploadChallengeMedia(new Blob(['x']), { contentType: 'image/png' })).rejects.toMatchObject({ status: 0 });
  });

  it('can be cancelled', async () => {
    const { uploadChallengeMedia } = await import('../supabase-admin.ts');
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(uploadChallengeMedia(new Blob(['x']), { contentType: 'image/png', signal: ctrl.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('listHabitTemplates (HR picker)', () => {
  it('leaves archived templates out', async () => {
    fromResult.data = [
      { id: 'a', kind: 'habit', title_en: 'Water', archived_at: null },
      { id: 'b', kind: 'habit', title_en: 'Walk', archived_at: '2026-11-01T00:00:00Z' },
      { id: 'c', kind: 'habit', title_en: 'Reset' },
    ];
    const { listHabitTemplates } = await import('../supabase-hr.ts');
    const rows = await listHabitTemplates();
    expect(rows.map((r) => r.id)).toEqual(['a', 'c']);
    expect(query.eq).toHaveBeenCalledWith('kind', 'habit');
  });
});
