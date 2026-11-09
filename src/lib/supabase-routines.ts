import { supabase, resolveMyCompanyId } from './supabase';
import { parseYouTubeUrl, isYouTubeId } from '../shared/habit-meta.js';

// Sprint 2: routines, checklists, libraries, recognition and company media.
// SQL: supabase/migrations/20261110000001_routines_and_libraries.sql
// (+ sprint 3, 20261111000001: week items carry their exercise, quiet_hours,
// report privacy folding, bulk exercise media, audio in company-media).
//
// Every function calls one RPC (or Storage) and throws the Supabase error
// as-is on failure; error.message is the code the SQL raises, e.g.
//   not_authenticated · not_authorized · public_item_read_only ·
//   item_not_due_today · routine_not_found · exercise_not_found ·
//   item_not_found · name_required · title_required · body_required ·
//   action_required · bad_body_area · bad_youtube_id · bad_media_type ·
//   bad_media_mime · bad_media_bucket · media_path_required ·
//   media_path_outside_company · weekday_not_workday · item_title_required ·
//   too_many_items · bad_workdays · bad_day_titles · starts_in_the_past ·
//   bad_dates · already_assigned · routine_not_published · team_not_found ·
//   end_in_the_past · bad_weeks · bad_success_days · fact_too_long ·
//   hide_public_items_only · unknown_setting / invalid_setting (details = key) ·
//   unknown_pref / invalid_pref · bad_period · bad_scope · bad_item_type.
// friendlyError() in ./errors maps the common ones to EN / AR copy.
//
// Dates are the company's local dates ('YYYY-MM-DD'); times are 'HH:MM'.
// Weekdays: 0 = Sunday … 6 = Saturday; the workweek is Sun–Thu (0–4).
// Library scope: company_id null = public (Wellness House), set = private.

// ── shared types ──────────────────────────────────────────────

export type Lang = 'en' | 'ar';
export type LibraryType = 'content' | 'exercise' | 'routine' | 'challenge_template';
export type LibraryScope = 'all' | 'public' | 'company';
export type LibraryStatus = 'draft' | 'published' | 'archived';
export type MediaBucket = 'company-media' | 'content-assets';
export type MediaType = 'video' | 'image' | 'youtube';
export type RecognitionMode = 'off' | 'teams' | 'named';
export type ReportRange = '7d' | '14d' | '30d' | '90d';

export type BodyArea =
  | 'neck' | 'shoulders' | 'upper_back' | 'lower_back' | 'chest' | 'arms' | 'wrists'
  | 'core' | 'hips' | 'legs' | 'eyes' | 'breathing' | 'full_body';

// Body areas an exercise can be tagged with (same list as the SQL check).
export const BODY_AREAS: ReadonlyArray<{ id: BodyArea; en: string; ar: string }> = [
  { id: 'neck', en: 'Neck', ar: 'الرقبة' },
  { id: 'shoulders', en: 'Shoulders', ar: 'الكتف' },
  { id: 'upper_back', en: 'Upper back', ar: 'أعلى الضهر' },
  { id: 'lower_back', en: 'Lower back', ar: 'أسفل الضهر' },
  { id: 'chest', en: 'Chest', ar: 'الصدر' },
  { id: 'arms', en: 'Arms', ar: 'الدراعات' },
  { id: 'wrists', en: 'Wrists', ar: 'الرسغ' },
  { id: 'core', en: 'Core', ar: 'البطن والوسط' },
  { id: 'hips', en: 'Hips', ar: 'الحوض' },
  { id: 'legs', en: 'Legs', ar: 'الرجلين' },
  { id: 'eyes', en: 'Eyes', ar: 'العين' },
  { id: 'breathing', en: 'Breathing', ar: 'التنفس' },
  { id: 'full_body', en: 'Full body', ar: 'الجسم كله' },
];

export const WEEKDAYS: ReadonlyArray<{ id: number; en: string; ar: string; short_en: string; short_ar: string }> = [
  { id: 0, en: 'Sunday', ar: 'الأحد', short_en: 'Sun', short_ar: 'أحد' },
  { id: 1, en: 'Monday', ar: 'الاثنين', short_en: 'Mon', short_ar: 'اثنين' },
  { id: 2, en: 'Tuesday', ar: 'الثلاثاء', short_en: 'Tue', short_ar: 'ثلاثاء' },
  { id: 3, en: 'Wednesday', ar: 'الأربعاء', short_en: 'Wed', short_ar: 'أربعاء' },
  { id: 4, en: 'Thursday', ar: 'الخميس', short_en: 'Thu', short_ar: 'خميس' },
  { id: 5, en: 'Friday', ar: 'الجمعة', short_en: 'Fri', short_ar: 'جمعة' },
  { id: 6, en: 'Saturday', ar: 'السبت', short_en: 'Sat', short_ar: 'سبت' },
];

// Media fields shared by exercises (and HR challenge payloads).
export interface MediaFields {
  media_type: MediaType | null;
  media_bucket: MediaBucket | null;
  media_path: string | null;
  media_mime: string | null;
  media_youtube_id: string | null;
  poster_path?: string | null;
}

export interface Exercise extends MediaFields {
  id: string;
  company_id: string | null;
  name_en: string;
  name_ar: string | null;
  how_en: string | null;
  how_ar: string | null;
  helps_en: string | null;
  helps_ar: string | null;
  body_areas: BodyArea[];
  default_sets_reps: string | null;
  default_sets_reps_ar: string | null;
  poster_path: string | null;
  status: LibraryStatus;
  copied_from?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Keys added by library_list() to every row.
export interface LibraryFlags {
  scope: 'public' | 'company';
  hidden: boolean;
  pinned: boolean;
  pref_sort: number | null;
  can_edit: boolean;
}

export interface DayTitle { en?: string; ar?: string }

export interface Routine {
  id: string;
  company_id: string | null;
  title_en: string;
  title_ar: string | null;
  note_en: string | null;
  note_ar: string | null;
  day_titles: Record<string, DayTitle>; // keyed '0'..'6'
  workdays: number[];
  source_file_bucket: MediaBucket | null;
  source_file_path: string | null;
  source_file_mime: string | null;
  status: LibraryStatus;
  copied_from: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoutineItem {
  id: string;
  routine_id: string;
  exercise_id: string | null;
  title_en: string | null;
  title_ar: string | null;
  weekday: number | null;   // null = every workday of the routine
  at_time: string | null;   // 'HH:MM'; null = any time today
  sets_reps: string | null;
  sets_reps_ar: string | null;
  note_en: string | null;
  note_ar: string | null;
  sort_order: number;
  exercise: Exercise | null;
}

export interface RoutineAssignmentSummary {
  id: string;
  team_id: string | null;
  team_name: string | null;
  starts_on: string;
  ends_on: string | null;
  active: boolean;
}

export interface RoutineDetail {
  routine: Routine & { scope: 'public' | 'company'; can_edit: boolean };
  items: RoutineItem[];
  assignments: RoutineAssignmentSummary[] | null; // HR of the owning company only
}

// ── employee: Today tab ───────────────────────────────────────

export interface TodayItem {
  id: string;
  routine_id: string;
  at_time: string | null;
  weekday: number | null;
  title_en: string;        // item title, else the exercise name
  title_ar: string;        // falls back to English
  sets_reps: string | null;
  sets_reps_ar: string | null;
  note_en: string | null;
  note_ar: string | null;
  checked: boolean;
  checked_at: string | null;
  is_past: boolean;        // its time has passed today (show "Not yet", never "missed")
  muted: boolean;          // in my muted reminders
  exercise: Exercise | null;
}

export interface TodayRoutine {
  id: string;
  title_en: string;
  title_ar: string | null;
  note_en: string | null;
  note_ar: string | null;
  day_title: DayTitle | null;   // "Today's focus" (weekly split)
  source_file_bucket: MediaBucket | null;
  source_file_path: string | null;
  source_file_mime: string | null;
  assignment_id: string;
  team_id: string | null;
}

export interface TodayState {
  date: string;
  weekday: number;
  now: string;             // company-local 'HH:MM'
  timezone: string;
  is_workday: boolean;
  assigned: boolean;       // false → show the plain Challenge tab
  routines: TodayRoutine[];
  items: TodayItem[];      // by time, untimed last
  progress: { done: number; total: number; pct: number | null; all_done: boolean; points: number };
  next_item_id: string | null;
  streak: number;          // workdays in a row with a tick
  reminders: { enabled: boolean; muted_item_ids: string[] };
}

export interface WeekDayItem {
  id: string;
  routine_id: string;
  exercise_id: string | null;
  at_time: string | null;
  title_en: string;
  title_ar: string;
  sets_reps: string | null;
  sets_reps_ar: string | null;
  note_en: string | null;
  note_ar: string | null;
  checked: boolean;
  exercise: Exercise | null;  // same shape as TodayItem.exercise — play it with resolveMedia()
}

export interface RoutineWeek {
  week_start: string;      // Sunday
  today: string;
  days: Array<{
    date: string; weekday: number; is_today: boolean; is_past: boolean; is_future: boolean;
    due: number; done: number; all_done: boolean; day_title: DayTitle | null; items: WeekDayItem[];
  }>;
  totals: { due: number; done: number; all_done_days: number };
  routines: Array<Pick<Routine, 'id' | 'title_en' | 'title_ar' | 'note_en' | 'note_ar' | 'day_titles'
    | 'source_file_bucket' | 'source_file_path' | 'source_file_mime'>>;
}

// Today's routine items for me, with exercise + media, ticks and progress.
export async function getMyToday(): Promise<TodayState> {
  const { data, error } = await supabase.rpc('my_today');
  if (error) throw error;
  return data as TodayState;
}

// Tick (checked = true) or untick one of today's items. Returns the new Today state.
export async function checkRoutineItem(itemId: string, checked = true): Promise<TodayState> {
  const { data, error } = await supabase.rpc('check_routine_item', { p_item_id: itemId, p_checked: checked });
  if (error) throw error;
  return data as TodayState;
}

// My Sun–Thu week (any date inside it; default this week): items per day, ticks, routines.
export async function getMyRoutineWeek(weekStart?: string): Promise<RoutineWeek> {
  const { data, error } = await supabase.rpc('my_routine_week', weekStart ? { p_week_start: weekStart } : {});
  if (error) throw error;
  return data as RoutineWeek;
}

// One routine with its rows (and assignments for its own HR).
export async function getRoutineDetail(routineId: string): Promise<RoutineDetail> {
  const { data, error } = await supabase.rpc('routine_detail', { p_routine_id: routineId });
  if (error) throw error;
  return data as RoutineDetail;
}

// ── settings and personal preferences ─────────────────────────

export interface CompanySettings {
  company_id: string;
  timezone: string;
  today: string;
  now: string;
  weekday: number;
  workweek: number[];
  recognition: RecognitionMode;
  weekly_habit_enabled: boolean;
  hr_people_view: boolean;
  quiet_hours: boolean;          // on (default): broadcasts only 08:00–20:00 company time
  quiet_window: { from: string; to: string };  // {from: '20:00', to: '08:00'}
  min_cohort: number;
}

export type CompanySettingsPatch = Partial<Pick<CompanySettings,
  'recognition' | 'weekly_habit_enabled' | 'hr_people_view' | 'quiet_hours' | 'timezone' | 'min_cohort'>>;

export interface MyPrefs {
  routine_reminders: boolean;
  muted_item_ids: string[];
  recognition_opt_in: boolean;
  recognition_opt_in_at: string | null;
  share_with_hr: boolean;
  share_with_hr_at: string | null;
  consent_version: string | null;
  company: Pick<CompanySettings, 'timezone' | 'workweek' | 'recognition' | 'weekly_habit_enabled' | 'hr_people_view'
    | 'quiet_hours' | 'quiet_window'>;
}

export type MyPrefsPatch = Partial<Pick<MyPrefs,
  'routine_reminders' | 'muted_item_ids' | 'recognition_opt_in' | 'share_with_hr'>>;

// My company's effective settings (timezone, today, recognition mode, …).
export async function getMyCompanySettings(): Promise<CompanySettings> {
  const { data, error } = await supabase.rpc('my_company_settings');
  if (error) throw error;
  return data as CompanySettings;
}

// HR: change recognition / weekly_habit_enabled / hr_people_view / quiet_hours / timezone / min_cohort.
export async function setCompanySettings(patch: CompanySettingsPatch): Promise<CompanySettings> {
  const { data, error } = await supabase.rpc('hr_set_company_settings', { p_patch: patch });
  if (error) throw error;
  return data as CompanySettings;
}

// My reminder switch, muted items and the two opt-ins (board, share with HR).
export async function getMyPrefs(): Promise<MyPrefs> {
  const { data, error } = await supabase.rpc('my_prefs');
  if (error) throw error;
  return data as MyPrefs;
}

// Change my prefs. Opting in to either moves my consent to v2.
export async function setMyPrefs(patch: MyPrefsPatch): Promise<MyPrefs> {
  const { data, error } = await supabase.rpc('set_my_prefs', { p_patch: patch });
  if (error) throw error;
  return data as MyPrefs;
}

// Mute or unmute one item's reminder (read-modify-write of muted_item_ids).
export async function setItemMuted(itemId: string, muted: boolean): Promise<MyPrefs> {
  const prefs = await getMyPrefs();
  const set = new Set(prefs.muted_item_ids || []);
  if (muted) set.add(itemId); else set.delete(itemId);
  return setMyPrefs({ muted_item_ids: [...set] });
}

// ── library (public + private, hide / pin, copy) ──────────────

export type LibraryRow<T = Record<string, any>> = T & LibraryFlags;

// Library rows of one type for my company, pinned first (see LibraryFlags).
// Employees never get hidden public items or drafts; HR gets them flagged.
export async function listLibrary<T = Record<string, any>>(
  type: LibraryType, scope: LibraryScope = 'all',
): Promise<LibraryRow<T>[]> {
  const { data, error } = await supabase.rpc('library_list', { p_type: type, p_scope: scope });
  if (error) throw error;
  return (data ?? []) as LibraryRow<T>[];
}

// Exercises in the library (Ours / Wellness House tabs: scope 'company' / 'public').
export function listExercises(scope: LibraryScope = 'all') {
  return listLibrary<Exercise>('exercise', scope);
}

// Routines in the library; rows also carry item_count and (HR) assigned.
export function listRoutines(scope: LibraryScope = 'all') {
  return listLibrary<Routine & { item_count: number; assigned: boolean }>('routine', scope);
}

// HR: hide (public items only) / pin / order an item for my company. Omitted keys keep their value.
export async function setLibraryPref(
  type: LibraryType, itemId: string, pref: { hidden?: boolean; pinned?: boolean; sortOrder?: number },
): Promise<{ item_type: LibraryType; item_id: string; hidden: boolean; pinned: boolean; sort_order: number | null }> {
  const { data, error } = await supabase.rpc('hr_set_library_pref', {
    p_item_type: type, p_item_id: itemId,
    p_hidden: pref.hidden ?? null, p_pinned: pref.pinned ?? null, p_sort_order: pref.sortOrder ?? null,
  });
  if (error) throw error;
  return data;
}

// Publish / draft / archive an item I own (challenge_template: 'published' | 'archived').
export async function setLibraryStatus(type: LibraryType, itemId: string, status: LibraryStatus) {
  const { data, error } = await supabase.rpc('set_library_status', {
    p_item_type: type, p_item_id: itemId, p_status: status,
  });
  if (error) throw error;
  return data as { item_type: LibraryType; id: string; status: LibraryStatus };
}

// HR "Use this": a private, editable copy of a public exercise.
export async function copyExercise(exerciseId: string): Promise<Exercise> {
  const { data, error } = await supabase.rpc('hr_copy_exercise', { p_exercise_id: exerciseId });
  if (error) throw error;
  return data as Exercise;
}

// HR "Use this": a private copy of a public routine with all its rows (not assigned yet).
export async function copyRoutine(routineId: string): Promise<RoutineDetail> {
  const { data, error } = await supabase.rpc('hr_copy_routine', { p_routine_id: routineId });
  if (error) throw error;
  return data as RoutineDetail;
}

// HR: set media on many of my company's exercises at once ("upload many
// videos, matched by file name": match names in the app, upload each file
// with uploadCompanyMedia, then call this once). Each item is
// { id, ...mediaFieldsFrom(upload) } (media_type null clears). overwrite
// false skips exercises that already have media. Public exercises are
// skipped (public_item_read_only) — copy them first.
export interface ExerciseMediaUpdate extends Partial<MediaFields> { id: string }
export interface BulkMediaResult {
  updated: number;
  skipped: Array<{ id: string; reason: string }>; // exercise_not_found · public_item_read_only · has_media ·
                                                   // duplicate · bad_media_mime · media_path_outside_company · …
}
export async function setExercisesMedia(
  items: ExerciseMediaUpdate[], opts: { overwrite?: boolean } = {},
): Promise<BulkMediaResult> {
  const { data, error } = await supabase.rpc('hr_set_exercises_media', {
    p_items: items, p_overwrite: opts.overwrite ?? true,
  });
  if (error) throw error;
  return data as BulkMediaResult;
}

// A file name → the exercise it is for: case, accents-free, punctuation and
// extension ignored ("Neck_tilt.MP4" ↔ "Neck tilt"). Returns the map
// file name → exercise id for the matches, and the files left over.
export function matchFilesToExercises<T extends { id: string; name_en: string; name_ar?: string | null }>(
  fileNames: string[], exercises: T[],
): { matched: Record<string, string>; unmatched: string[] } {
  const norm = (s: string) => String(s || '').toLowerCase()
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, '')  // Latin accents, Arabic harakat, tatweel
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const byName = new Map<string, string>();
  for (const e of exercises) {
    for (const n of [e.name_en, e.name_ar]) {
      const k = n ? norm(n) : '';
      if (k && !byName.has(k)) byName.set(k, e.id);
    }
  }
  const matched: Record<string, string> = {};
  const unmatched: string[] = [];
  for (const f of fileNames) {
    const id = byName.get(norm(f));
    if (id) matched[f] = id; else unmatched.push(f);
  }
  return { matched, unmatched };
}

// ── authoring ─────────────────────────────────────────────────

export interface ExerciseInput {
  id?: string;               // update when set; missing keys keep their value
  public?: boolean;          // Wellness House admin only
  name_en?: string;
  name_ar?: string | null;
  how_en?: string | null;
  how_ar?: string | null;
  helps_en?: string | null;
  helps_ar?: string | null;
  body_areas?: BodyArea[];
  default_sets_reps?: string | null;
  default_sets_reps_ar?: string | null;
  media_type?: MediaType | null;
  media_bucket?: MediaBucket | null;
  media_path?: string | null;
  media_mime?: string | null;
  media_youtube_id?: string | null;
  poster_path?: string | null;
  status?: LibraryStatus;
}

export interface RoutineItemInput {
  id?: string;               // keep it to update a row in place (its ticks stay)
  exercise_id?: string | null;
  title_en?: string | null;  // free text when there is no exercise ("Drink a glass of water")
  title_ar?: string | null;
  weekday?: number | null;   // null = every workday
  at_time?: string | null;   // 'HH:MM'
  sets_reps?: string | null;
  sets_reps_ar?: string | null;
  note_en?: string | null;
  note_ar?: string | null;
  sort_order?: number;
}

export interface RoutineInput {
  id?: string;
  public?: boolean;          // Wellness House admin only
  title_en?: string;
  title_ar?: string | null;
  note_en?: string | null;
  note_ar?: string | null;
  day_titles?: Record<string, DayTitle>;
  workdays?: number[];
  source_file_bucket?: MediaBucket | null;
  source_file_path?: string | null;
  source_file_mime?: string | null;
  status?: LibraryStatus;
  items?: RoutineItemInput[]; // when given: the full list (rows left out are removed)
}

// Create / update an exercise (HR: my company; Wellness admin: public with `public: true`).
export async function saveExercise(input: ExerciseInput): Promise<Exercise> {
  const { data, error } = await supabase.rpc('save_exercise', { p_input: input });
  if (error) throw error;
  return data as Exercise;
}

// Create / update a routine and (with `items`) replace its rows. Returns the routine detail.
export async function saveRoutine(input: RoutineInput): Promise<RoutineDetail> {
  const { data, error } = await supabase.rpc('save_routine', { p_input: input });
  if (error) throw error;
  return data as RoutineDetail;
}

export interface RoutineAssignment {
  id: string;
  routine_id: string;
  company_id: string;
  team_id: string | null;
  starts_on: string;
  ends_on: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface RoutineAssignmentRow {
  id: string;
  routine_id: string;
  routine_title_en: string;
  routine_title_ar: string | null;
  routine_status: LibraryStatus;
  team_id: string | null;
  team_name: string | null;
  starts_on: string;
  ends_on: string | null;
  active: boolean;
  created_at: string;
  status: 'upcoming' | 'active' | 'ended' | 'cancelled';
}

// HR: give a routine to everyone (teamId null) or a team, from a date (default today).
export async function assignRoutine(opts: {
  routineId: string; teamId?: string | null; startsOn?: string | null; endsOn?: string | null;
}): Promise<RoutineAssignment> {
  const { data, error } = await supabase.rpc('hr_assign_routine', {
    p_routine_id: opts.routineId, p_team_id: opts.teamId ?? null,
    p_starts_on: opts.startsOn ?? null, p_ends_on: opts.endsOn ?? null,
  });
  if (error) throw error;
  return data as RoutineAssignment;
}

// HR: stop an assignment (upcoming → cancelled; running → ends on endsOn, default today).
export async function endRoutineAssignment(assignmentId: string, endsOn?: string): Promise<RoutineAssignment> {
  const { data, error } = await supabase.rpc('hr_end_routine_assignment', {
    p_assignment_id: assignmentId, p_ends_on: endsOn ?? null,
  });
  if (error) throw error;
  return data as RoutineAssignment;
}

// HR: every routine assignment with names and a status.
export async function listRoutineAssignments(): Promise<RoutineAssignmentRow[]> {
  const { data, error } = await supabase.rpc('hr_routine_assignments');
  if (error) throw error;
  return (data ?? []) as RoutineAssignmentRow[];
}

// One row of the coach's sheet.
export interface RoutineImportRow {
  row?: number;              // sheet row number, echoed in problems
  time?: string;             // '9:30', '09:30', '2:15 pm', '9:30 م'
  exercise: string;          // English name; matched case-insensitively
  exercise_ar?: string;
  sets_reps?: string;
  sets_reps_ar?: string;
  weekday?: string | number; // '' / 'every' = every workday; 'sun', 'Sunday', 'الأحد', 0–6
  body_areas?: string | BodyArea[]; // 'neck, shoulders' or an array
  youtube?: string;          // link or 11-character id
  video_path?: string;       // a file already uploaded with uploadCompanyMedia (wins over youtube)
  how_en?: string;
  how_ar?: string;
  note_en?: string;
  note_ar?: string;
}

export interface RoutineImportSummary {
  dry_run: boolean;
  saved: boolean;            // false for a preview, or when no row could be imported (nothing kept)
  routine_id: string | null;
  assignment_id: string | null;
  rows: number;
  items: number;
  exercises_matched: number;
  exercises_created: number;
  new_exercises: string[];
  problems: Array<{ row: number; reason: string; value?: string }>;  // rows skipped
  warnings: Array<{ row: number; reason: string; value?: string }>;  // imported, something ignored
}

export interface RoutineImportHeader {
  title_en: string;
  title_ar?: string;
  note_en?: string;
  note_ar?: string;
  workdays?: number[];
  day_titles?: Record<string, DayTitle>;
  assign?: boolean;          // also assign it (team_id / starts_on)
  team_id?: string | null;
  starts_on?: string;
}

// HR: import a routine from sheet rows; creates missing exercises. dryRun = preview, saves nothing.
export async function importRoutine(
  routine: RoutineImportHeader, rows: RoutineImportRow[], opts: { dryRun?: boolean } = {},
): Promise<RoutineImportSummary> {
  const { data, error } = await supabase.rpc('hr_import_routine', {
    p_routine: routine, p_rows: rows, p_dry_run: !!opts.dryRun,
  });
  if (error) throw error;
  return data as RoutineImportSummary;
}

// HR: preview an import (same summary, nothing saved).
export function previewRoutineImport(routine: RoutineImportHeader, rows: RoutineImportRow[]) {
  return importRoutine(routine, rows, { dryRun: true });
}

export interface ContentItemInput {
  id?: string;
  public?: boolean;          // Wellness House admin only
  kind?: 'article' | 'fact'; // a fact is one or two lines (≤ 300 characters)
  title_en?: string;
  title_ar?: string | null;
  description_en?: string | null;
  description_ar?: string | null;
  body_en?: string | null;
  body_ar?: string | null;
  category?: 'sleep' | 'stress' | 'energy' | 'movement' | 'mindfulness' | 'nutrition' | 'general';
  duration_mins?: number | null;
  media_bucket?: MediaBucket | null;  // cover image
  media_path?: string | null;
  status?: 'draft' | 'published';
}

// HR: write a private article or fact (draft or published).
export async function saveContentItem(input: ContentItemInput) {
  const { data, error } = await supabase.rpc('save_content_item', { p_input: input });
  if (error) throw error;
  return data as Record<string, any>;
}

export interface ChallengeTemplateInput {
  id?: string;
  title_en?: string;
  title_ar?: string | null;
  weeks?: 1 | 2 | 3 | 4;
  success_days?: number;     // default 80% of the workdays (8 of 10 for two weeks)
  payload?: {
    category?: 'movement' | 'sleep' | 'mood' | 'hydration' | 'stress';
    action_en?: string; action_ar?: string;
    why_en?: string; why_ar?: string;
    tip_en?: string; tip_ar?: string;
    reminder_en?: string; reminder_ar?: string; reminder_time?: string;
    missed_en?: string; missed_ar?: string;
    check_mode?: 'same_day' | 'next_morning';
    article_slug?: string;
    media_type?: MediaType | null;
    media_bucket?: MediaBucket | null;
    media_path?: string | null;
    media_mime?: string | null;
    media_youtube_id?: string | null;
  };
}

// HR: save my company's own habit challenge (1–4 weeks). Schedule it like any template
// with scheduleHabitChallenge() in supabase-hr.ts.
export async function saveChallengeTemplate(input: ChallengeTemplateInput) {
  const { data, error } = await supabase.rpc('hr_save_challenge_template', { p_input: input });
  if (error) throw error;
  return data as Record<string, any>;
}

// ── HR reports (aggregate; names only with opt-in) ────────────

export interface RoutineReportDay {
  date: string; weekday: number;
  assigned: number; active: number; done: number; due: number; full_days: number;
  pct: number | null; active_pct: number | null;
}

export interface RoutineReportTeam {
  team_id: string | null;
  name: string | null;
  department: string | null;
  small: boolean;            // "Other teams": teams under the floor, teams folded for privacy and
                             // no-team people under the floor, grouped (shown only at/over the floor)
  no_team: boolean;          // people without a team, when they reach the floor (and aren't folded)
  teams: number;
  members: number;
  active: number;
  active_pct: number;
  done: number;
  due: number;
  completion_pct: number | null;
  avg_items_per_day: number | null;
}

export interface RoutineReport {
  range: ReportRange;
  from: string;
  to: string;
  timezone: string;
  min_cohort: number;
  members: number;
  suppressed: boolean;       // company under the floor: percentages are null
  has_routine: boolean;
  today: Omit<RoutineReportDay, 'weekday'>;
  totals: { done: number; due: number; full_days: number; active_people: number; completion_pct: number | null };
  by_day: RoutineReportDay[];        // days with something due or done
  by_team: RoutineReportTeam[];      // best first
  small_teams_hidden: boolean;       // the grouped rest is still under the floor (not shown)
  // Secondary suppression (sprint 3): total − the teams shown is always 0 or ≥ the floor.
  teams_folded: number;              // teams at/over the floor folded into "Other teams" for privacy
  breakdown_suppressed: boolean;     // no team shown on its own ("Teams are grouped to protect privacy")
  by_exercise: Array<{ key: string; exercise_id: string | null; title_en: string; title_ar: string | null;
                       done: number; due: number; pct: number | null }>; // most → least done
  by_hour: Array<{ hour: number; checks: number }>;                       // 0–23, company time
}

export interface RoutinePerson {
  user_id: string;
  display_name: string;
  initials: string;
  avatar_kind: string;
  team_id: string | null;
  team_name: string | null;
  days_active: number;
  items_done: number;
  full_days: number;
  streak: number;
  last_active: string | null;
}

export interface RoutinePeople {
  enabled: boolean;          // false while the company's hr_people_view is off
  range: ReportRange;
  from: string;
  to: string;
  people: RoutinePerson[];   // only people who chose "share my progress with HR"
  opted_in: number;
  not_shared: number;        // everyone else, as a count
}

// HR: routine report — today, by day, by team (5-floor), by exercise, by hour.
export async function getRoutineReport(range: ReportRange = '14d'): Promise<RoutineReport> {
  const { data, error } = await supabase.rpc('hr_routine_report', { p_range: range });
  if (error) throw error;
  return data as RoutineReport;
}

// HR: named list of people who opted in to share their progress (when the company view is on).
export async function getRoutinePeople(range: ReportRange = '14d'): Promise<RoutinePeople> {
  const { data, error } = await supabase.rpc('hr_routine_people', { p_range: range });
  if (error) throw error;
  return data as RoutinePeople;
}

// ── recognition ───────────────────────────────────────────────

export interface BoardPerson {
  user_id: string;
  display_name: string;
  initials: string;
  avatar_kind: string;
}

export interface RecognitionBoard {
  enabled: boolean;
  mode: RecognitionMode;
  period: 'today' | 'week';
  from: string;
  to: string;
  teams: Array<{ team_id: string; name: string; members: number; active: number;
                 active_pct: number; completion_pct: number | null; rank: number }>;
  named: null | {
    opted_in: number;
    top: Array<BoardPerson & { items_done: number; full_days: number; streak: number }>;
    did_everything: { names: BoardPerson[]; more: number };   // "Amira, Lina and 14 more"
    longest_streak: Array<BoardPerson & { streak: number }>;
  };
  me: { opted_in: boolean; items_done: number; streak: number };
}

// The company board: teams (≥ floor, no names) + opt-in names (effort only, no bottom list).
export async function getRecognitionBoard(period: 'today' | 'week' = 'today', limit = 5): Promise<RecognitionBoard> {
  const { data, error } = await supabase.rpc('recognition_board', { p_period: period, p_limit: limit });
  if (error) throw error;
  return data as RecognitionBoard;
}

// ── company media (private bucket, signed URLs) ───────────────

export const COMPANY_MEDIA_BUCKET = 'company-media';
export const PUBLIC_MEDIA_BUCKET = 'content-assets';
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
export const SIGNED_URL_SECONDS = 24 * 60 * 60;

// What company-media accepts, and what each becomes. Audio (sprint 3) is for
// broadcasts (voice notes / podcasts); prefer mp3 / m4a — iPhones don't play
// webm / ogg everywhere.
export type MediaKind = 'video' | 'image' | 'pdf' | 'audio';
export const MEDIA_MIME_KINDS: Readonly<Record<string, MediaKind>> = {
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'image/png': 'image',
  'image/jpeg': 'image',
  'application/pdf': 'pdf',
  'audio/mpeg': 'audio',
  'audio/mp4': 'audio',
  'audio/x-m4a': 'audio',
  'audio/webm': 'audio',
  'audio/ogg': 'audio',
};
export const MEDIA_ACCEPT = 'video/mp4,video/quicktime,.mp4,.mov,image/png,image/jpeg,.png,.jpg,.jpeg';
export const SOURCE_FILE_ACCEPT = 'image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf';
export const AUDIO_ACCEPT = 'audio/mpeg,audio/mp4,audio/x-m4a,audio/webm,audio/ogg,.mp3,.m4a,.webm,.ogg,.oga';
const EXT: Record<string, string> = {
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg',
};
const EXT_MIME: Record<string, string> = {
  mp4: 'video/mp4', mov: 'video/quicktime', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', webm: 'audio/webm', ogg: 'audio/ogg', oga: 'audio/ogg',
};

export type MediaFolder = 'exercises' | 'routines' | 'content' | 'challenges' | 'broadcasts';

export interface UploadedMedia {
  bucket: typeof COMPANY_MEDIA_BUCKET;
  path: string;              // {company_id}/{folder}/{file}
  mime: string;
  kind: MediaKind;
}

// The file's type from file.type or its extension; null when company-media won't take it.
// Parameters are dropped ('audio/webm;codecs=opus' → 'audio/webm', as MediaRecorder reports it).
export function mediaMimeOf(file: { type?: string; name?: string }): string | null {
  const t = String(file?.type || '').toLowerCase().split(';')[0].trim();
  if (MEDIA_MIME_KINDS[t]) return t;
  const ext = String(file?.name || '').toLowerCase().split('.').pop() || '';
  return EXT_MIME[ext] || null;
}

// Upload to my company's private folder with progress (XHR, like uploadChallengeMedia).
// Refuses files over 50 MB or of other types before sending anything.
export async function uploadCompanyMedia(
  file: Blob & { name?: string },
  opts: { folder: MediaFolder; contentType?: string; onProgress?: (pct: number) => void; signal?: AbortSignal;
          companyId?: string },
): Promise<UploadedMedia> {
  const mime = opts.contentType || mediaMimeOf(file);
  if (!mime || !MEDIA_MIME_KINDS[mime]) {
    throw Object.assign(new Error('bad_type'), { code: 'bad_type', status: 415 });
  }
  if (typeof file.size === 'number' && file.size > MAX_MEDIA_BYTES) {
    throw Object.assign(new Error('too_large'), { code: 'too_large', status: 413 });
  }
  const companyId = opts.companyId || (await resolveMyCompanyId());
  if (!companyId) throw Object.assign(new Error('not_in_company'), { status: 403 });

  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw Object.assign(new Error('not_signed_in'), { status: 401 });

  const path = `${companyId}/${opts.folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[mime] || 'bin'}`;

  await new Promise<void>((resolve, reject) => {
    const cancelled = () => Object.assign(new Error('Upload cancelled'), { name: 'AbortError' });
    if (opts.signal?.aborted) { reject(cancelled()); return; }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/storage/v1/object/${COMPANY_MEDIA_BUCKET}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (anonKey) xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.setRequestHeader('Cache-Control', 'max-age=86400');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) opts.onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { resolve(); return; }
      let body: any = {};
      try { body = JSON.parse(xhr.responseText || '{}'); } catch { /* not JSON */ }
      reject(Object.assign(new Error(body.message || body.error || `Upload failed (${xhr.status})`), {
        status: Number(body.statusCode) || xhr.status, code: body.error,
      }));
    };
    xhr.onerror = () => reject(Object.assign(new Error('Network error'), { status: 0 }));
    xhr.onabort = () => reject(cancelled());
    opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });

  opts.onProgress?.(100);
  return { bucket: COMPANY_MEDIA_BUCKET, path, mime, kind: MEDIA_MIME_KINDS[mime] };
}

// The exercise media fields for an upload (or a YouTube id) — pass into saveExercise().
export function mediaFieldsFrom(media: UploadedMedia | { youtube_id: string } | null): MediaFields {
  if (!media) return { media_type: null, media_bucket: null, media_path: null, media_mime: null, media_youtube_id: null };
  if ('youtube_id' in media) {
    return { media_type: 'youtube', media_bucket: null, media_path: null, media_mime: null, media_youtube_id: media.youtube_id };
  }
  if (media.kind !== 'video' && media.kind !== 'image') {
    throw Object.assign(new Error('bad_media_type'), { code: 'bad_media_type' });
  }
  return { media_type: media.kind, media_bucket: media.bucket, media_path: media.path, media_mime: media.mime, media_youtube_id: null };
}

// Delete a file from my company's folder (HR only).
export async function removeCompanyMedia(path: string) {
  const { error } = await supabase.storage.from(COMPANY_MEDIA_BUCKET).remove([path]);
  if (error) throw error;
}

// Signed URLs are reused for a day so the phone's HTTP cache keeps working.
type CachedUrl = { url: string; expires: number };
const URL_CACHE_KEY = 'wp.signed-urls.v1';
const urlCache = new Map<string, CachedUrl>();
let urlCacheLoaded = false;

function loadUrlCache() {
  if (urlCacheLoaded) return;
  urlCacheLoaded = true;
  try {
    const raw = globalThis.localStorage?.getItem(URL_CACHE_KEY);
    if (!raw) return;
    const now = Date.now();
    for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, CachedUrl>)) {
      if (v && typeof v.url === 'string' && v.expires > now) urlCache.set(k, v);
    }
  } catch { /* storage blocked or corrupt: memory only */ }
}

function saveUrlCache() {
  try {
    globalThis.localStorage?.setItem(URL_CACHE_KEY, JSON.stringify(Object.fromEntries(urlCache)));
  } catch { /* storage blocked: memory only */ }
}

// Forget cached signed URLs (call on sign-out).
export function clearMediaUrlCache() {
  urlCache.clear();
  urlCacheLoaded = true;
  try { globalThis.localStorage?.removeItem(URL_CACHE_KEY); } catch { /* ignore */ }
}

export interface MediaRef { bucket: MediaBucket | null | undefined; path: string | null | undefined }

// URLs for many files at once: signed (company-media, reused for a day) or public (content-assets).
export async function getMediaUrls(refs: MediaRef[]): Promise<(string | null)[]> {
  loadUrlCache();
  const out: (string | null)[] = refs.map(() => null);
  const now = Date.now();
  const toSign: { i: number; key: string; path: string }[] = [];
  refs.forEach((r, i) => {
    if (!r?.path) return;
    if (r.bucket === PUBLIC_MEDIA_BUCKET) {
      out[i] = supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(r.path).data.publicUrl;
      return;
    }
    if (r.bucket !== COMPANY_MEDIA_BUCKET) return;
    const key = `${r.bucket}/${r.path}`;
    const hit = urlCache.get(key);
    if (hit && hit.expires - now > 60 * 60 * 1000) { out[i] = hit.url; return; }
    toSign.push({ i, key, path: r.path });
  });
  if (toSign.length) {
    const unique = [...new Set(toSign.map((t) => t.path))];
    const { data, error } = await supabase.storage.from(COMPANY_MEDIA_BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
    if (error) throw error;
    const byPath = new Map<string, string>();
    for (const row of data ?? []) {
      if (row && !row.error && row.path && row.signedUrl) byPath.set(row.path, row.signedUrl);
    }
    const expires = now + SIGNED_URL_SECONDS * 1000;
    for (const t of toSign) {
      const url = byPath.get(t.path) || null;
      out[t.i] = url;
      if (url) urlCache.set(t.key, { url, expires });
    }
    saveUrlCache();
  }
  return out;
}

// URL for one file (see getMediaUrls); null when there is no file.
export async function getMediaUrl(ref: MediaRef): Promise<string | null> {
  return (await getMediaUrls([ref]))[0];
}

// What the sprint 1 player (<HabitMedia payload=…>) needs for an exercise or challenge payload:
// { media_type, media_url (signed / public), media_youtube_id, media_mime, poster_url }.
export async function resolveMedia(m: Partial<MediaFields> & { media_url?: string | null } | null | undefined) {
  if (!m || !m.media_type) return null;
  if (m.media_type === 'youtube') {
    return isYouTubeId(m.media_youtube_id)
      ? { media_type: 'youtube' as const, media_youtube_id: m.media_youtube_id, media_url: null, media_mime: null, poster_url: null }
      : null;
  }
  const bucket = m.media_bucket || (m.media_url ? null : PUBLIC_MEDIA_BUCKET);
  const [url, poster] = await getMediaUrls([
    { bucket, path: m.media_path }, { bucket, path: m.poster_path },
  ]);
  const mediaUrl = url || m.media_url || null;
  if (!mediaUrl) return null;
  return { media_type: m.media_type, media_url: mediaUrl, media_youtube_id: null, media_mime: m.media_mime || null, poster_url: poster };
}

// A YouTube id from a link or a bare id; null otherwise.
export function youtubeIdFrom(input: string | null | undefined): string | null {
  const raw = String(input ?? '').trim();
  if (isYouTubeId(raw)) return raw;
  const parsed = parseYouTubeUrl(raw);
  return parsed.ok ? parsed.id : null;
}

// Display helpers ──────────────────────────────────────────────

// An item's title / sets × reps in a language, falling back to English.
export function itemText(item: { title_en?: string | null; title_ar?: string | null;
  sets_reps?: string | null; sets_reps_ar?: string | null }, lang: Lang) {
  return {
    title: (lang === 'ar' ? item.title_ar : null) || item.title_en || item.title_ar || '',
    setsReps: (lang === 'ar' ? item.sets_reps_ar : null) || item.sets_reps || item.sets_reps_ar || '',
  };
}
