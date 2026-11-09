// Test data shaped like the sprint 2 RPCs (my_today, my_routine_week,
// recognition_board). Used by the employee tests only.

export function ex(id, extra = {}) {
  return {
    id, company_id: 'c1', name_en: extra.name_en || 'Exercise', name_ar: extra.name_ar || null,
    how_en: null, how_ar: null, helps_en: null, helps_ar: null, body_areas: [],
    default_sets_reps: null, default_sets_reps_ar: null,
    media_type: null, media_bucket: null, media_path: null, media_mime: null, media_youtube_id: null, poster_path: null,
    status: 'published', ...extra,
  };
}

export function item(id, at, en, ar, sets, extra = {}) {
  return {
    id, routine_id: 'r1', at_time: at, weekday: null,
    title_en: en, title_ar: ar, sets_reps: sets, sets_reps_ar: null, note_en: null, note_ar: null,
    checked: false, checked_at: null, is_past: false, muted: false, exercise: null, ...extra,
  };
}

export function makeToday(overrides = {}) {
  const items = overrides.items || [
    item('i1', '08:30', 'Shoulder rolls', 'لف الكتف', '2 × 10', { checked: true, checked_at: '2026-11-10T06:31:00Z', is_past: true }),
    item('i2', '10:00', 'Neck release', 'إطالة الرقبة', '2 × 8–10', {
      is_past: true,
      exercise: ex('e2', {
        name_en: 'Neck release', name_ar: 'إطالة الرقبة', body_areas: ['neck', 'shoulders'],
        how_en: 'Tilt your ear to your shoulder and hold.', how_ar: 'ميّل ودنك ناحية كتفك واثبت.',
        helps_en: 'Eases a stiff neck.', helps_ar: 'بيريّح الرقبة.',
        media_type: 'video', media_bucket: 'company-media', media_path: 'c1/exercises/neck.mp4', media_mime: 'video/mp4',
      }),
    }),
    item('i3', '11:30', 'Wrist stretch', 'إطالة الرسغ', '1 × 30 s'),
    item('i4', null, 'Drink a glass of water', 'اشرب كوباية مية', null),
  ];
  const done = items.filter((i) => i.checked).length;
  return {
    date: '2026-11-10', weekday: 2, now: '10:30', timezone: 'Africa/Cairo', is_workday: true, assigned: true,
    routines: [{
      id: 'r1', title_en: 'Daily desk routine', title_ar: 'روتين المكتب', note_en: null, note_ar: null,
      day_title: { en: 'Upper body', ar: 'الجزء العلوي' },
      source_file_bucket: null, source_file_path: null, source_file_mime: null, assignment_id: 'a1', team_id: null,
    }],
    items,
    progress: { done, total: items.length, pct: Math.round((100 * done) / items.length), all_done: done === items.length, points: Math.min(20, 2 * done) },
    next_item_id: 'i3',
    streak: 3,
    reminders: { enabled: false, muted_item_ids: [] },
    ...overrides,
  };
}

export function makeWeek() {
  const day = (date, weekday, flags, items) => ({
    date, weekday, ...flags,
    due: items.length, done: items.filter((i) => i.checked).length,
    all_done: items.length > 0 && items.every((i) => i.checked),
    day_title: weekday === 2 ? { en: 'Upper body', ar: 'الجزء العلوي' } : weekday === 3 ? { en: 'Lower body', ar: 'الجزء السفلي' } : null,
    items,
  });
  const wi = (id, at, en, checked = false) => ({ id, routine_id: 'r1', exercise_id: null, at_time: at, title_en: en, title_ar: en, sets_reps: '2 × 10', sets_reps_ar: null, checked });
  return {
    week_start: '2026-11-08', today: '2026-11-10',
    days: [
      day('2026-11-08', 0, { is_today: false, is_past: true, is_future: false }, [wi('a', '08:30', 'Shoulder rolls', true), wi('b', '10:00', 'Neck release', true)]),
      day('2026-11-09', 1, { is_today: false, is_past: true, is_future: false }, [wi('a', '08:30', 'Shoulder rolls', true), wi('b', '10:00', 'Neck release')]),
      day('2026-11-10', 2, { is_today: true, is_past: false, is_future: false }, [wi('a', '08:30', 'Shoulder rolls', true), wi('b', '10:00', 'Neck release'), wi('c', '11:30', 'Wall push-ups')]),
      day('2026-11-11', 3, { is_today: false, is_past: false, is_future: true }, [wi('a', '08:30', 'Shoulder rolls'), wi('d', '12:00', 'Squats')]),
      day('2026-11-12', 4, { is_today: false, is_past: false, is_future: true }, [wi('a', '08:30', 'Shoulder rolls')]),
    ],
    totals: { due: 10, done: 4, all_done_days: 1 },
    routines: [{ id: 'r1', title_en: 'Daily desk routine', title_ar: 'روتين المكتب', note_en: 'From Coach Karim.', note_ar: 'من الكوتش كريم.', day_titles: {}, source_file_bucket: null, source_file_path: null, source_file_mime: null }],
  };
}

export function makeBoard(mode = 'teams', extra = {}) {
  const base = {
    enabled: mode !== 'off', mode, period: 'today', from: '2026-11-10', to: '2026-11-10',
    teams: mode === 'off' ? [] : [
      { team_id: 't1', name: 'Finance', members: 8, active: 6, active_pct: 75, completion_pct: 60, rank: 1 },
      { team_id: 't2', name: 'Sales', members: 10, active: 5, active_pct: 50, completion_pct: 40, rank: 2 },
    ],
    named: null,
    me: { opted_in: false, items_done: 4, streak: 2 },
  };
  const named = {
    opted_in: 3,
    top: [
      { user_id: 'u2', display_name: 'Amira Hassan', initials: 'AH', avatar_kind: 'monogram', items_done: 10, full_days: 1, streak: 5 },
      { user_id: 'u3', display_name: 'Lina Adel', initials: 'LA', avatar_kind: 'orbit', items_done: 8, full_days: 0, streak: 2 },
    ],
    did_everything: { names: [{ user_id: 'u2', display_name: 'Amira Hassan', initials: 'AH', avatar_kind: 'monogram' }], more: 14 },
    longest_streak: [{ user_id: 'u2', display_name: 'Amira Hassan', initials: 'AH', avatar_kind: 'monogram', streak: 5 }],
  };
  // In 'teams' mode a stray named block must still never be shown.
  return { ...base, named: mode === 'off' ? null : named, ...extra };
}
