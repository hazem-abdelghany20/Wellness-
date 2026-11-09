import { describe, it, expect, vi, beforeEach } from 'vitest';

// Sprint 3 additions to supabase-routines.ts: audio in company-media, bulk
// exercise media, file-name matching, friendly copy for push / broadcast codes.
const rpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getSession: vi.fn(), getUser: vi.fn(), onAuthStateChange: vi.fn() },
    rpc, from: vi.fn(), storage: { from: vi.fn() }, functions: { invoke: vi.fn() },
  })),
}));

let lib;
beforeEach(async () => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: { updated: 1, skipped: [] }, error: null });
  lib = await import('../supabase-routines.ts');
});

describe('company media: audio', () => {
  it('knows the five audio types and their extensions', () => {
    for (const t of ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg']) {
      expect(lib.MEDIA_MIME_KINDS[t]).toBe('audio');
    }
    expect(lib.mediaMimeOf({ type: '', name: 'ep1.mp3' })).toBe('audio/mpeg');
    expect(lib.mediaMimeOf({ type: '', name: 'note.oga' })).toBe('audio/ogg');
    expect(lib.mediaMimeOf({ type: 'audio/webm;codecs=opus' })).toBe('audio/webm');
    expect(lib.AUDIO_ACCEPT).toContain('.m4a');
  });

  it('an audio upload is never an exercise video', () => {
    expect(() => lib.mediaFieldsFrom({ bucket: 'company-media', path: 'c1/broadcasts/a.mp3', mime: 'audio/mpeg', kind: 'audio' }))
      .toThrow('bad_media_type');
    expect(lib.mediaFieldsFrom({ bucket: 'company-media', path: 'c1/exercises/a.mp4', mime: 'video/mp4', kind: 'video' }))
      .toMatchObject({ media_type: 'video', media_path: 'c1/exercises/a.mp4' });
  });
});

describe('bulk exercise media', () => {
  it('setExercisesMedia → hr_set_exercises_media (overwrite by default)', async () => {
    const items = [{ id: 'e1', media_type: 'video', media_bucket: 'company-media', media_path: 'c1/exercises/a.mp4', media_mime: 'video/mp4' }];
    expect(await lib.setExercisesMedia(items)).toEqual({ updated: 1, skipped: [] });
    expect(rpc).toHaveBeenCalledWith('hr_set_exercises_media', { p_items: items, p_overwrite: true });
    await lib.setExercisesMedia(items, { overwrite: false });
    expect(rpc).toHaveBeenLastCalledWith('hr_set_exercises_media', { p_items: items, p_overwrite: false });
  });

  it('matchFilesToExercises ignores case, punctuation, accents, harakat and the extension', () => {
    const exercises = [
      { id: 'e1', name_en: 'Neck tilt', name_ar: 'إمالة الرقبة' },
      { id: 'e2', name_en: 'Eye 20-20-20', name_ar: null },
      { id: 'e3', name_en: 'Café stretch', name_ar: null },
    ];
    const { matched, unmatched } = lib.matchFilesToExercises(
      ['NECK_TILT.mp4', 'eye 20 20 20.MOV', 'cafe-stretch.mp4', 'إمالةُ الرقبة.mov', 'Wall push-ups.mp4'], exercises);
    expect(matched).toEqual({
      'NECK_TILT.mp4': 'e1', 'eye 20 20 20.MOV': 'e2', 'cafe-stretch.mp4': 'e3', 'إمالةُ الرقبة.mov': 'e1',
    });
    expect(unmatched).toEqual(['Wall push-ups.mp4']);
  });
});

describe('settings types carry quiet hours', () => {
  it('setCompanySettings passes quiet_hours through', async () => {
    rpc.mockResolvedValue({ data: { quiet_hours: false }, error: null });
    expect(await lib.setCompanySettings({ quiet_hours: false })).toEqual({ quiet_hours: false });
    expect(rpc).toHaveBeenCalledWith('hr_set_company_settings', { p_patch: { quiet_hours: false } });
  });
});

describe('friendly copy for sprint 3 codes', () => {
  it('push and broadcast errors', async () => {
    const { friendlyError, friendlyErrorI18n } = await import('../errors.ts');
    expect(friendlyError(Object.assign(new Error('push_unsupported'), { reason: 'ios_needs_install' })).message)
      .toMatch(/Home Screen/);
    expect(friendlyError(Object.assign(new Error('push_unsupported'), { reason: 'no_push_manager' })).message)
      .toMatch(/can’t show reminders/);
    expect(friendlyError(new Error('push_denied')).message).toMatch(/blocked/);
    expect(friendlyError({ message: 'broadcast_already_sent', code: '22023' }).message).toBe('That message has already gone out.');
    expect(friendlyError({ message: 'bad_audio_type' }).message).toMatch(/MP3 or M4A/);
    expect(friendlyErrorI18n(new Error('push_denied'), 'ar')).toMatch(/الإشعارات/);
    // existing rules still win where they should
    expect(friendlyError({ message: 'not_authorized' }).message).toBe("You don't have permission to do that.");
  });
});
