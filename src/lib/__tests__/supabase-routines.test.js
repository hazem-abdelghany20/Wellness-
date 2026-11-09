import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// supabase client stub: a signed-in HR user of company c1.
const rpc = vi.fn();
const bucket = {
  getPublicUrl: vi.fn((path) => ({ data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/content-assets/${path}` } })),
  createSignedUrls: vi.fn(),
  remove: vi.fn(async () => ({ error: null })),
};
const storageFrom = vi.fn(() => bucket);
const single = vi.fn();
const query = {
  select: vi.fn(() => query), eq: vi.fn(() => query), order: vi.fn(async () => ({ data: [], error: null })),
  update: vi.fn(() => query), single,
};
const from = vi.fn(() => query);

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'jwt-hr' } } })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1', app_metadata: { company_id: 'c1' } } } })),
      onAuthStateChange: vi.fn(),
    },
    from,
    rpc,
    storage: { from: storageFrom },
    functions: { invoke: vi.fn() },
  })),
}));

// Minimal XMLHttpRequest double that records the request.
class FakeXHR {
  static last = null;
  static sent = 0;
  static respond = { status: 200, body: '{}' };
  constructor() { this.headers = {}; this.upload = {}; FakeXHR.last = this; }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(k, v) { this.headers[k] = v; }
  abort() { this.onabort?.(); }
  send(body) {
    FakeXHR.sent += 1;
    this.body = body;
    this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
    queueMicrotask(() => {
      this.status = FakeXHR.respond.status;
      this.responseText = FakeXHR.respond.body;
      if (FakeXHR.respond.network) this.onerror?.(); else this.onload?.();
    });
  }
}

let realXHR;
let lib;
beforeEach(async () => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: { ok: true }, error: null });
  realXHR = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = FakeXHR;
  FakeXHR.respond = { status: 200, body: '{}' };
  FakeXHR.sent = 0;
  lib = await import('../supabase-routines.ts');
  lib.clearMediaUrlCache();
});
afterEach(() => { globalThis.XMLHttpRequest = realXHR; });

describe('RPC wrappers', () => {
  // [call, rpc name, args]
  const cases = [
    [(l) => l.getMyToday(), 'my_today', undefined],
    [(l) => l.checkRoutineItem('i1'), 'check_routine_item', { p_item_id: 'i1', p_checked: true }],
    [(l) => l.checkRoutineItem('i1', false), 'check_routine_item', { p_item_id: 'i1', p_checked: false }],
    [(l) => l.getMyRoutineWeek(), 'my_routine_week', {}],
    [(l) => l.getMyRoutineWeek('2026-11-08'), 'my_routine_week', { p_week_start: '2026-11-08' }],
    [(l) => l.getRoutineDetail('r1'), 'routine_detail', { p_routine_id: 'r1' }],
    [(l) => l.getMyCompanySettings(), 'my_company_settings', undefined],
    [(l) => l.setCompanySettings({ recognition: 'named' }), 'hr_set_company_settings', { p_patch: { recognition: 'named' } }],
    [(l) => l.getMyPrefs(), 'my_prefs', undefined],
    [(l) => l.setMyPrefs({ share_with_hr: true }), 'set_my_prefs', { p_patch: { share_with_hr: true } }],
    [(l) => l.listLibrary('content'), 'library_list', { p_type: 'content', p_scope: 'all' }],
    [(l) => l.listExercises('company'), 'library_list', { p_type: 'exercise', p_scope: 'company' }],
    [(l) => l.listRoutines('public'), 'library_list', { p_type: 'routine', p_scope: 'public' }],
    [(l) => l.setLibraryStatus('exercise', 'e1', 'archived'), 'set_library_status',
      { p_item_type: 'exercise', p_item_id: 'e1', p_status: 'archived' }],
    [(l) => l.copyExercise('e1'), 'hr_copy_exercise', { p_exercise_id: 'e1' }],
    [(l) => l.copyRoutine('r1'), 'hr_copy_routine', { p_routine_id: 'r1' }],
    [(l) => l.saveExercise({ name_en: 'Neck tilt' }), 'save_exercise', { p_input: { name_en: 'Neck tilt' } }],
    [(l) => l.saveRoutine({ title_en: 'Desk Day', items: [] }), 'save_routine', { p_input: { title_en: 'Desk Day', items: [] } }],
    [(l) => l.endRoutineAssignment('a1'), 'hr_end_routine_assignment', { p_assignment_id: 'a1', p_ends_on: null }],
    [(l) => l.endRoutineAssignment('a1', '2026-11-12'), 'hr_end_routine_assignment', { p_assignment_id: 'a1', p_ends_on: '2026-11-12' }],
    [(l) => l.saveContentItem({ kind: 'fact', title_en: 'x', body_en: 'y' }), 'save_content_item',
      { p_input: { kind: 'fact', title_en: 'x', body_en: 'y' } }],
    [(l) => l.saveChallengeTemplate({ title_en: 'Water', weeks: 2 }), 'hr_save_challenge_template',
      { p_input: { title_en: 'Water', weeks: 2 } }],
    [(l) => l.getRoutineReport(), 'hr_routine_report', { p_range: '14d' }],
    [(l) => l.getRoutineReport('90d'), 'hr_routine_report', { p_range: '90d' }],
    [(l) => l.getRoutinePeople('7d'), 'hr_routine_people', { p_range: '7d' }],
    [(l) => l.getRecognitionBoard(), 'recognition_board', { p_period: 'today', p_limit: 5 }],
    [(l) => l.getRecognitionBoard('week', 3), 'recognition_board', { p_period: 'week', p_limit: 3 }],
  ];

  it.each(cases)('%#: calls the right RPC with the right arguments', async (call, name, args) => {
    rpc.mockResolvedValue({ data: { name }, error: null });
    const out = await call(lib);
    if (args === undefined) expect(rpc).toHaveBeenCalledWith(name);
    else expect(rpc).toHaveBeenCalledWith(name, args);
    expect(out).toEqual({ name });
  });

  it('throws the Supabase error as-is', async () => {
    const err = { message: 'item_not_due_today', code: 'P0002' };
    rpc.mockResolvedValue({ data: null, error: err });
    await expect(lib.checkRoutineItem('i9')).rejects.toBe(err);
    await expect(lib.getRoutineReport()).rejects.toBe(err);
  });

  it('lists come back as [] when the RPC returns null', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await lib.listLibrary('routine')).toEqual([]);
    expect(await lib.listRoutineAssignments()).toEqual([]);
  });

  it('setLibraryPref sends NULL for what it leaves alone', async () => {
    await lib.setLibraryPref('content', 'c9', { pinned: true });
    expect(rpc).toHaveBeenCalledWith('hr_set_library_pref', {
      p_item_type: 'content', p_item_id: 'c9', p_hidden: null, p_pinned: true, p_sort_order: null,
    });
  });

  it('assignRoutine maps to the SQL argument names (everyone, from today by default)', async () => {
    await lib.assignRoutine({ routineId: 'r1' });
    expect(rpc).toHaveBeenLastCalledWith('hr_assign_routine', {
      p_routine_id: 'r1', p_team_id: null, p_starts_on: null, p_ends_on: null,
    });
    await lib.assignRoutine({ routineId: 'r1', teamId: 't1', startsOn: '2026-11-15', endsOn: '2026-12-31' });
    expect(rpc).toHaveBeenLastCalledWith('hr_assign_routine', {
      p_routine_id: 'r1', p_team_id: 't1', p_starts_on: '2026-11-15', p_ends_on: '2026-12-31',
    });
  });

  it('importRoutine saves, previewRoutineImport is a dry run', async () => {
    const rows = [{ row: 2, time: '9:30', exercise: 'Neck tilt', sets_reps: '2 × 10' }];
    await lib.importRoutine({ title_en: 'Coach sheet', assign: true }, rows);
    expect(rpc).toHaveBeenLastCalledWith('hr_import_routine', {
      p_routine: { title_en: 'Coach sheet', assign: true }, p_rows: rows, p_dry_run: false,
    });
    await lib.previewRoutineImport({ title_en: 'Coach sheet' }, rows);
    expect(rpc).toHaveBeenLastCalledWith('hr_import_routine', {
      p_routine: { title_en: 'Coach sheet' }, p_rows: rows, p_dry_run: true,
    });
  });

  it('setItemMuted adds and removes one id from the muted list', async () => {
    rpc.mockImplementation(async (name) => (name === 'my_prefs'
      ? { data: { muted_item_ids: ['a', 'b'] }, error: null }
      : { data: { muted_item_ids: [] }, error: null }));
    await lib.setItemMuted('c', true);
    expect(rpc).toHaveBeenLastCalledWith('set_my_prefs', { p_patch: { muted_item_ids: ['a', 'b', 'c'] } });
    await lib.setItemMuted('a', false);
    expect(rpc).toHaveBeenLastCalledWith('set_my_prefs', { p_patch: { muted_item_ids: ['b'] } });
  });
});

describe('uploadCompanyMedia', () => {
  it('posts into my company folder in company-media with my JWT and reports progress', async () => {
    const progress = [];
    const blob = new Blob(['x'], { type: 'video/mp4' });
    const out = await lib.uploadCompanyMedia(blob, { folder: 'exercises', onProgress: (p) => progress.push(p) });
    const xhr = FakeXHR.last;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toMatch(/^https:\/\/test\.supabase\.co\/storage\/v1\/object\/company-media\/c1\/exercises\/\d+-[a-z0-9]+\.mp4$/);
    expect(xhr.headers).toMatchObject({
      Authorization: 'Bearer jwt-hr', apikey: 'test-anon-key', 'Content-Type': 'video/mp4', 'x-upsert': 'false',
    });
    expect(xhr.body).toBe(blob);
    expect(progress).toEqual([25, 100]);
    expect(out).toMatchObject({ bucket: 'company-media', mime: 'video/mp4', kind: 'video' });
    expect(out.path).toMatch(/^c1\/exercises\/.+\.mp4$/);
  });

  it('takes the type from the extension when the browser gives none (.mov from an iPhone)', async () => {
    const file = Object.assign(new Blob(['x']), { name: 'IMG_0042.MOV' });
    const out = await lib.uploadCompanyMedia(file, { folder: 'routines' });
    expect(out).toMatchObject({ mime: 'video/quicktime', kind: 'video' });
    expect(FakeXHR.last.headers['Content-Type']).toBe('video/quicktime');
  });

  it('refuses a file over 50 MB before sending anything', async () => {
    const big = { size: 50 * 1024 * 1024 + 1, type: 'video/mp4', name: 'big.mp4' };
    await expect(lib.uploadCompanyMedia(big, { folder: 'exercises' })).rejects.toMatchObject({ code: 'too_large', status: 413 });
    expect(FakeXHR.sent).toBe(0);
  });

  it('refuses other file types before sending anything', async () => {
    const gif = Object.assign(new Blob(['x'], { type: 'image/gif' }), { name: 'a.gif' });
    await expect(lib.uploadCompanyMedia(gif, { folder: 'exercises' })).rejects.toMatchObject({ code: 'bad_type', status: 415 });
    expect(FakeXHR.sent).toBe(0);
  });

  it('surfaces the storage status (RLS / size) and network failures', async () => {
    FakeXHR.respond = { status: 400, body: '{"statusCode":"403","error":"Unauthorized","message":"new row violates row-level security policy"}' };
    await expect(lib.uploadCompanyMedia(new Blob(['x'], { type: 'image/png' }), { folder: 'content' }))
      .rejects.toMatchObject({ status: 403, message: 'new row violates row-level security policy' });
    FakeXHR.respond = { network: true };
    await expect(lib.uploadCompanyMedia(new Blob(['x'], { type: 'image/png' }), { folder: 'content' }))
      .rejects.toMatchObject({ status: 0 });
  });

  it('can be cancelled', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(lib.uploadCompanyMedia(new Blob(['x'], { type: 'image/jpeg' }), { folder: 'content', signal: ctrl.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
  });

  it('mediaFieldsFrom turns an upload or a YouTube id into exercise fields', () => {
    expect(lib.mediaFieldsFrom({ bucket: 'company-media', path: 'c1/exercises/a.mp4', mime: 'video/mp4', kind: 'video' }))
      .toEqual({ media_type: 'video', media_bucket: 'company-media', media_path: 'c1/exercises/a.mp4', media_mime: 'video/mp4', media_youtube_id: null });
    expect(lib.mediaFieldsFrom({ youtube_id: 'dQw4w9WgXcQ' }))
      .toMatchObject({ media_type: 'youtube', media_youtube_id: 'dQw4w9WgXcQ', media_path: null });
    expect(lib.mediaFieldsFrom(null)).toMatchObject({ media_type: null });
    expect(() => lib.mediaFieldsFrom({ bucket: 'company-media', path: 'c1/routines/t.pdf', mime: 'application/pdf', kind: 'pdf' }))
      .toThrow('bad_media_type');
  });
});

describe('media URLs', () => {
  it('signs company-media paths once, in one batch, and reuses them', async () => {
    bucket.createSignedUrls.mockResolvedValue({
      data: [
        { path: 'c1/exercises/a.mp4', signedUrl: 'https://s/a?token=1', error: null },
        { path: 'c1/exercises/b.png', signedUrl: 'https://s/b?token=1', error: null },
      ],
      error: null,
    });
    const urls = await lib.getMediaUrls([
      { bucket: 'company-media', path: 'c1/exercises/a.mp4' },
      { bucket: 'company-media', path: 'c1/exercises/b.png' },
      { bucket: 'company-media', path: 'c1/exercises/a.mp4' },
      { bucket: 'content-assets', path: 'challenges/x.mp4' },
      { bucket: null, path: null },
    ]);
    expect(urls).toEqual([
      'https://s/a?token=1', 'https://s/b?token=1', 'https://s/a?token=1',
      'https://test.supabase.co/storage/v1/object/public/content-assets/challenges/x.mp4', null,
    ]);
    expect(storageFrom).toHaveBeenCalledWith('company-media');
    expect(bucket.createSignedUrls).toHaveBeenCalledTimes(1);
    expect(bucket.createSignedUrls).toHaveBeenCalledWith(['c1/exercises/a.mp4', 'c1/exercises/b.png'], 86400);

    // Same URL again (so the phone's cache works), no new request.
    expect(await lib.getMediaUrl({ bucket: 'company-media', path: 'c1/exercises/a.mp4' })).toBe('https://s/a?token=1');
    expect(bucket.createSignedUrls).toHaveBeenCalledTimes(1);
    // Kept across reloads too.
    expect(JSON.parse(localStorage.getItem('wp.signed-urls.v1'))['company-media/c1/exercises/a.mp4'].url).toBe('https://s/a?token=1');
  });

  it('a path the user may not read comes back null', async () => {
    bucket.createSignedUrls.mockResolvedValue({ data: [{ path: 'c2/x.mp4', signedUrl: null, error: 'Object not found' }], error: null });
    expect(await lib.getMediaUrl({ bucket: 'company-media', path: 'c2/x.mp4' })).toBeNull();
  });

  it('resolveMedia gives the sprint 1 player its payload shape', async () => {
    bucket.createSignedUrls.mockResolvedValue({
      data: [{ path: 'c1/exercises/a.mp4', signedUrl: 'https://s/a', error: null },
             { path: 'c1/exercises/a.jpg', signedUrl: 'https://s/p', error: null }],
      error: null,
    });
    expect(await lib.resolveMedia({
      media_type: 'video', media_bucket: 'company-media', media_path: 'c1/exercises/a.mp4',
      media_mime: 'video/mp4', poster_path: 'c1/exercises/a.jpg',
    })).toEqual({ media_type: 'video', media_url: 'https://s/a', media_youtube_id: null, media_mime: 'video/mp4', poster_url: 'https://s/p' });
    expect(await lib.resolveMedia({ media_type: 'youtube', media_youtube_id: 'dQw4w9WgXcQ' }))
      .toMatchObject({ media_type: 'youtube', media_youtube_id: 'dQw4w9WgXcQ' });
    expect(await lib.resolveMedia({ media_type: 'youtube', media_youtube_id: 'nope' })).toBeNull();
    // Sprint 1 public payloads already carry a URL.
    expect(await lib.resolveMedia({ media_type: 'image', media_url: 'https://cdn/x.png' }))
      .toMatchObject({ media_type: 'image', media_url: 'https://cdn/x.png' });
    expect(await lib.resolveMedia(null)).toBeNull();
  });
});

describe('small helpers', () => {
  it('youtubeIdFrom accepts links and bare ids', () => {
    expect(lib.youtubeIdFrom('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(lib.youtubeIdFrom('youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ');
    expect(lib.youtubeIdFrom('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(lib.youtubeIdFrom('https://vimeo.com/1')).toBeNull();
    expect(lib.youtubeIdFrom('')).toBeNull();
  });

  it('mediaMimeOf reads the type or the extension', () => {
    expect(lib.mediaMimeOf({ type: 'image/jpeg' })).toBe('image/jpeg');
    expect(lib.mediaMimeOf({ type: '', name: 'table.PDF' })).toBe('application/pdf');
    expect(lib.mediaMimeOf({ type: 'image/gif', name: 'a.gif' })).toBeNull();
  });

  it('itemText falls back to English', () => {
    expect(lib.itemText({ title_en: 'Neck tilt', title_ar: 'إمالة الرقبة', sets_reps: '2 × 10' }, 'ar'))
      .toEqual({ title: 'إمالة الرقبة', setsReps: '2 × 10' });
    expect(lib.itemText({ title_en: 'Neck tilt', title_ar: null, sets_reps: null, sets_reps_ar: '٢ × ١٠' }, 'ar'))
      .toEqual({ title: 'Neck tilt', setsReps: '٢ × ١٠' });
  });

  it('body areas and weekdays match the SQL lists', () => {
    expect(lib.BODY_AREAS.map((a) => a.id)).toEqual(['neck', 'shoulders', 'upper_back', 'lower_back', 'chest', 'arms',
      'wrists', 'core', 'hips', 'legs', 'eyes', 'breathing', 'full_body']);
    expect(lib.WEEKDAYS[0]).toMatchObject({ id: 0, en: 'Sunday' });
  });
});

describe('HR content (supabase-hr.ts): shared rows are never written', () => {
  it('the library shows a public item this company hid as unpublished', async () => {
    rpc.mockResolvedValue({ data: [
      { id: 'p1', scope: 'public', hidden: true, pinned: false, status: 'published', published: true },
      { id: 'o1', scope: 'company', hidden: false, pinned: true, status: 'draft', published: false },
    ], error: null });
    const { getContentLibrary } = await import('../supabase-hr.ts');
    const rows = await getContentLibrary();
    expect(rpc).toHaveBeenCalledWith('library_list', { p_type: 'content', p_scope: 'all' });
    expect(rows[0]).toMatchObject({ id: 'p1', status: 'hidden', published: false, hidden: true });
    expect(rows[1]).toMatchObject({ id: 'o1', status: 'draft' });
  });

  it('falls back to the old select before the sprint 2 SQL is applied', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.library_list' } });
    query.order.mockResolvedValueOnce({ data: [{ id: 'x' }], error: null });
    const { getContentLibrary } = await import('../supabase-hr.ts');
    expect(await getContentLibrary()).toEqual([{ id: 'x' }]);
    expect(from).toHaveBeenCalledWith('content_items');
  });

  it('unpublishing a public article hides it for this company only', async () => {
    single.mockResolvedValue({ data: { id: 'p1', company_id: null, status: 'published', published: true }, error: null });
    rpc.mockResolvedValue({ data: { hidden: true, pinned: false }, error: null });
    const { updateContentItem } = await import('../supabase-hr.ts');
    const out = await updateContentItem('p1', { status: 'draft' });
    expect(rpc).toHaveBeenCalledWith('hr_set_library_pref', {
      p_item_type: 'content', p_item_id: 'p1', p_hidden: true, p_pinned: null, p_sort_order: null,
    });
    expect(query.update).not.toHaveBeenCalled();
    expect(out).toMatchObject({ id: 'p1', status: 'hidden', published: false });
  });

  it('any other edit to a public article is refused', async () => {
    single.mockResolvedValue({ data: { id: 'p1', company_id: null }, error: null });
    const { updateContentItem } = await import('../supabase-hr.ts');
    await expect(updateContentItem('p1', { title_en: 'x' })).rejects.toThrow('public_item_read_only');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('our own article is saved through save_content_item', async () => {
    single.mockResolvedValue({ data: { id: 'o1', company_id: 'c1', status: 'draft' }, error: null });
    rpc.mockResolvedValue({ data: { id: 'o1', company_id: 'c1', status: 'published' }, error: null });
    const { updateContentItem } = await import('../supabase-hr.ts');
    const out = await updateContentItem('o1', { published: true });
    expect(rpc).toHaveBeenCalledWith('save_content_item', { p_input: { id: 'o1', status: 'published' } });
    expect(out).toMatchObject({ id: 'o1', status: 'published', scope: 'company' });
  });
});

describe('admin lists and friendly errors', () => {
  it('the admin template and content lists show public rows only', async () => {
    query.order.mockResolvedValueOnce({ data: [{ id: 'pub', company_id: null }, { id: 'hr', company_id: 'c1' }], error: null });
    const admin = await import('../supabase-admin.ts');
    expect((await admin.listChallengeTemplates()).map((r) => r.id)).toEqual(['pub']);
    query.order.mockResolvedValueOnce({ data: [{ id: 'a' }, { id: 'b', company_id: 'c2' }], error: null });
    expect((await admin.listGlobalContent()).map((r) => r.id)).toEqual(['a']);
  });

  it('maps the new error codes in EN and AR', async () => {
    const { friendlyError, friendlyErrorI18n } = await import('../errors.ts');
    expect(friendlyError({ message: 'public_item_read_only', code: '42501' }).message).toMatch(/Wellness House library/);
    expect(friendlyErrorI18n({ message: 'public_item_read_only' }, 'ar')).toMatch(/Wellness House/);
    expect(friendlyError(new Error('too_large')).message).toMatch(/50 MB/);
    expect(friendlyError({ message: 'The object exceeded the maximum allowed size' }).message).toMatch(/50 MB/);
    expect(friendlyError({ message: 'item_not_due_today' }).message).toMatch(/today/);
    expect(friendlyError({ message: 'not_authorized' }).message).toBe("You don't have permission to do that.");
  });
});
