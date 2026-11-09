import { describe, it, expect } from 'vitest';
import {
  emptyRoutineForm, routineToForm, validateRoutineForm, buildRoutineInput, emptyRow, newRowAfter,
  moveRow, sortRowsByTime, toggleWorkday, workdaysLabel, previewDay, dayFocus, routineErrorCount,
} from '../routine-form.js';
import {
  routineHeaderField, sheetToRoutineRows, timeCell, bodyAreasCell, importReasonLabel,
  routineTemplateHeaders, routineTemplateHelpRows,
} from '../routine-sheet.js';
import { shapeRoutineReport, reportSheets, hourWindow, teamRowLabel } from '../report-shape.js';

const neck = { id: 'ex-neck', name_en: 'Neck release', name_ar: 'فك الرقبة', default_sets_reps: '2 × 10', scope: 'company' };
const push = { id: 'ex-push', name_en: 'Wall push-ups', default_sets_reps: '3 × 10', scope: 'public' };
const byId = new Map([[neck.id, neck], [push.id, push]]);

describe('routine form', () => {
  it('starts Sun–Thu and needs a name and a row', () => {
    const f = emptyRoutineForm();
    expect(f.workdays).toEqual([0, 1, 2, 3, 4]);
    const e = validateRoutineForm(f);
    expect(e.title_en.en).toBe('Add the name in English.');
    expect(e.rowsList.en).toBe('Add at least one row.');
  });

  it('flags row problems by row key', () => {
    const rows = [
      emptyRow({ key: 'a' }),                                      // no exercise
      emptyRow({ key: 'b', mode: 'text' }),                        // no step text
      emptyRow({ key: 'c', exercise_id: neck.id, at_time: '9.7' }), // bad time
      emptyRow({ key: 'd', exercise_id: neck.id, weekday: 5 }),    // Friday isn't a workday
    ];
    const e = validateRoutineForm({ ...emptyRoutineForm(), title_en: 'Desk', rows });
    expect(Object.keys(e.rows)).toEqual(['a', 'b', 'c', 'd']);
    expect(e.rows.a.exercise_id.en).toBe('Pick an exercise.');
    expect(e.rows.b.title_en.en).toBe('Type the step.');
    expect(e.rows.c.at_time).toBeTruthy();
    expect(e.rows.d.weekday).toBeTruthy();
    expect(routineErrorCount(e)).toBe(4);
  });

  it('builds the full save_routine input, keeping row ids and order', () => {
    const f = {
      ...emptyRoutineForm(), title_en: ' Daily desk routine ', workdays: [4, 0, 1, 2, 3],
      day_titles: { 0: { en: 'Upper body', ar: '' }, 5: { en: 'Not a workday' } },
      source: { bucket: 'company-media', path: 'c1/routines/t.pdf', mime: 'application/pdf' },
      rows: [
        emptyRow({ id: 'item-1', exercise_id: neck.id, at_time: '9:00', sets_reps: '' }),
        emptyRow({ mode: 'text', title_en: 'Drink a glass of water', at_time: '', weekday: null }),
        emptyRow({ exercise_id: push.id, at_time: '13:00', weekday: 0, sets_reps: '2 × 8' }),
      ],
    };
    const input = buildRoutineInput(f);
    expect(input).toMatchObject({
      title_en: 'Daily desk routine', title_ar: null, workdays: [0, 1, 2, 3, 4],
      day_titles: { 0: { en: 'Upper body' } },
      source_file_bucket: 'company-media', source_file_path: 'c1/routines/t.pdf', source_file_mime: 'application/pdf',
    });
    expect(input.public).toBeUndefined();
    expect(input.items).toEqual([
      { id: 'item-1', exercise_id: neck.id, title_en: null, title_ar: null, weekday: null, at_time: '09:00', sets_reps: null, sets_reps_ar: null, note_en: null, note_ar: null, sort_order: 1 },
      { exercise_id: null, title_en: 'Drink a glass of water', title_ar: null, weekday: null, at_time: null, sets_reps: null, sets_reps_ar: null, note_en: null, note_ar: null, sort_order: 2 },
      { exercise_id: push.id, title_en: null, title_ar: null, weekday: 0, at_time: '13:00', sets_reps: '2 × 8', sets_reps_ar: null, note_en: null, note_ar: null, sort_order: 3 },
    ]);
    expect(buildRoutineInput({ ...f, rows: [f.rows[0]] }, { isPublic: true }).public).toBe(true);
    expect(buildRoutineInput({ ...f, id: 'r1' }, { isPublic: true }).public).toBeUndefined();
  });

  it('reads a routine_detail back into the form', () => {
    const detail = {
      routine: { id: 'r1', title_en: 'Desk', title_ar: null, workdays: [0, 1, 2, 3, 4], day_titles: { 1: { en: 'Legs' } },
        source_file_bucket: 'company-media', source_file_path: 'c1/routines/x.png', source_file_mime: 'image/png', status: 'published' },
      items: [{ id: 'i1', exercise_id: 'ex-neck', at_time: '09:30', weekday: null, sets_reps: null, exercise: neck }],
    };
    const f = routineToForm(detail);
    expect(f).toMatchObject({ id: 'r1', title_en: 'Desk', day_titles: { 1: { en: 'Legs', ar: '' } }, source: { path: 'c1/routines/x.png', name: 'x.png' } });
    expect(f.rows[0]).toMatchObject({ id: 'i1', mode: 'exercise', exercise_id: 'ex-neck', at_time: '09:30', weekday: null });
  });

  it('adds rows an hour after the last, moves and sorts them', () => {
    expect(newRowAfter([]).at_time).toBe('09:00');
    expect(newRowAfter([emptyRow({ at_time: '10:30' }), emptyRow({ at_time: '' })]).at_time).toBe('11:30');
    const rows = [emptyRow({ key: 'x', at_time: '11:00' }), emptyRow({ key: 'y', at_time: '' }), emptyRow({ key: 'z', at_time: '09:00' })];
    expect(moveRow(rows, 0, 1).map((r) => r.key)).toEqual(['y', 'x', 'z']);
    expect(moveRow(rows, 0, -1)).toBe(rows);
    expect(sortRowsByTime(rows).map((r) => r.key)).toEqual(['z', 'x', 'y']);
    expect(toggleWorkday([0, 1, 2, 3, 4], 2)).toEqual([0, 1, 3, 4]);
    expect(workdaysLabel([0, 1, 2, 3, 4], 'en')).toBe('Sun–Thu');
    expect(workdaysLabel([0, 2], 'en')).toBe('Sun, Tue');
  });

  it('previews one day the way the Today tab lists it', () => {
    const f = {
      ...emptyRoutineForm(), day_titles: { 0: { en: 'Upper body', ar: 'الجزء العلوي' } },
      rows: [
        emptyRow({ key: 'late', exercise_id: neck.id, at_time: '15:00' }),
        emptyRow({ key: 'sun', exercise_id: push.id, at_time: '10:00', weekday: 0 }),
        emptyRow({ key: 'any', mode: 'text', title_en: 'Water', at_time: '' }),
        emptyRow({ key: 'early', exercise_id: neck.id, at_time: '09:00', sets_reps: '1 × 5' }),
      ],
    };
    expect(previewDay(f, 0, byId, 'en').map((p) => [p.key, p.time, p.title, p.setsReps])).toEqual([
      ['early', '09:00', 'Neck release', '1 × 5'],
      ['sun', '10:00', 'Wall push-ups', '3 × 10'],
      ['late', '15:00', 'Neck release', '2 × 10'],
      ['any', null, 'Water', ''],
    ]);
    expect(previewDay(f, 1, byId, 'ar').map((p) => p.key)).toEqual(['early', 'late', 'any']);
    expect(previewDay(f, 5, byId, 'en')).toEqual([]);
    expect(dayFocus(f, 0, 'ar')).toBe('الجزء العلوي');
  });
});

describe('routine sheet', () => {
  it('maps English and Arabic headers', () => {
    expect(['Time', 'Exercise', 'sets_reps', 'Weekday', 'Body areas', 'YouTube'].map(routineHeaderField))
      .toEqual(['time', 'exercise', 'sets_reps', 'weekday', 'body_areas', 'youtube']);
    expect(['الوقت', 'التمرين', 'المجموعات × التكرار', 'اليوم', 'منطقة الجسم', 'لينك'].map(routineHeaderField))
      .toEqual(['time', 'exercise', 'sets_reps', 'weekday', 'body_areas', 'youtube']);
    expect(routineHeaderField('Time / الوقت')).toBe('time');
    expect(routineHeaderField('Sets x reps')).toBe('sets_reps');
    expect(routineHeaderField('Notes')).toBe('note_en');
    expect(routineHeaderField('Colour')).toBe(null);
  });

  it('turns Excel times into HH:MM and body area names into ids', () => {
    expect(timeCell(new Date(Date.UTC(1899, 11, 30, 9, 30)))).toBe('09:30');
    expect(timeCell(0.5)).toBe('12:00');
    expect(timeCell('2:15 pm')).toBe('2:15 pm');
    expect(bodyAreasCell('Neck, upper back; الكتف')).toEqual(['neck', 'upper_back', 'shoulders']);
    expect(bodyAreasCell('Knees')).toEqual(['knees']); // unknown: the server warns
  });

  it('reads rows under the header, skipping empty lines, with Excel row numbers', () => {
    const sheet = [
      ['Coach plan, week 1'],
      ['time', 'exercise', 'sets_reps', 'weekday', 'body_areas', 'youtube', 'Colour'],
      ['09:00', 'Neck release', '2 x 10', '', 'neck', '', 'red'],
      ['', '', '', '', '', ''],
      [new Date(Date.UTC(1899, 11, 30, 13, 0)), 'Wall push-ups', new Date(Date.UTC(2026, 9, 8)), 'Sunday', 'chest, arms', 'https://youtu.be/dQw4w9WgXcQ'],
    ];
    const out = sheetToRoutineRows(sheet);
    expect(out.missing).toEqual([]);
    expect(out.unknownHeaders).toEqual(['Colour']);
    expect(out.rows).toEqual([
      { row: 3, exercise: 'Neck release', time: '09:00', sets_reps: '2 x 10', body_areas: ['neck'] },
      { row: 5, exercise: 'Wall push-ups', time: '13:00', weekday: 'Sunday', youtube: 'https://youtu.be/dQw4w9WgXcQ', body_areas: ['chest', 'arms'] },
    ]);
    expect(out.warnings).toEqual([{ row: 5, reason: 'excel_date', value: '2026-10-08' }]);
  });

  it('says when there is no exercise column or too many rows', () => {
    expect(sheetToRoutineRows([['time', 'reps'], ['09:00', '10']]).missing).toEqual(['exercise']);
    expect(sheetToRoutineRows([]).missing).toEqual(['exercise']);
    const many = [['exercise'], ...Array.from({ length: 101 }, (_, i) => [`Ex ${i}`])];
    expect(sheetToRoutineRows(many).tooMany).toBe(true);
  });

  it('labels server reasons and has a bilingual template', () => {
    expect(importReasonLabel('bad_time', 'en')).toMatch(/09:30/);
    expect(importReasonLabel('weekday_not_workday', 'ar')).toBe('اليوم ده مش يوم شغل');
    expect(importReasonLabel('something_new', 'en')).toBe('something_new');
    expect(routineTemplateHeaders('en')).toEqual(['time', 'exercise', 'sets_reps', 'weekday', 'body_areas', 'youtube']);
    expect(routineTemplateHeaders('ar').map(routineHeaderField)).toEqual(['time', 'exercise', 'sets_reps', 'weekday', 'body_areas', 'youtube']);
    expect(routineTemplateHelpRows('ar')[0][0]).toBe('العمود');
  });
});

const REPORT = {
  range: '14d', from: '2026-10-27', to: '2026-11-09', timezone: 'Africa/Cairo', min_cohort: 5, members: 40,
  suppressed: false, has_routine: true,
  today: { date: '2026-11-09', assigned: 40, active: 12, done: 37, due: 120, full_days: 3, pct: 31, active_pct: 30 },
  totals: { done: 400, due: 1000, full_days: 20, active_people: 30, completion_pct: 40 },
  by_day: [
    { date: '2026-11-08', weekday: 0, assigned: 40, active: 20, done: 60, due: 120, full_days: 5, pct: 50, active_pct: 50 },
    { date: '2026-11-09', weekday: 1, assigned: 40, active: 12, done: 37, due: 120, full_days: 3, pct: 31, active_pct: 30 },
  ],
  by_team: [
    { team_id: 't1', name: 'Finance', department: 'Ops', small: false, no_team: false, teams: 1, members: 10, active: 8, active_pct: 80, done: 150, due: 300, completion_pct: 50, avg_items_per_day: 1.5 },
    { team_id: null, name: null, department: null, small: true, no_team: false, teams: 3, members: 9, active: 4, active_pct: 44, done: 40, due: 200, completion_pct: 20, avg_items_per_day: 0.4 },
  ],
  small_teams_hidden: true,
  by_exercise: [
    { key: 'ex-neck', exercise_id: 'ex-neck', title_en: 'Neck release', title_ar: 'فك الرقبة', done: 200, due: 400, pct: 50 },
    { key: 'ex-push', exercise_id: 'ex-push', title_en: 'Wall push-ups', title_ar: null, done: 20, due: 400, pct: 5 },
  ],
  by_hour: Array.from({ length: 24 }, (_, h) => ({ hour: h, checks: h === 7 ? 3 : h === 10 ? 30 : 0 })),
};

describe('routine report shaping', () => {
  it('labels teams, keeps "Small teams" as given, and draws 08–18 widened to busy hours', () => {
    const r = shapeRoutineReport(REPORT, 'en');
    expect(r.teams.map((t) => t.label)).toEqual(['Finance', 'Small teams (3)']);
    expect(teamRowLabel({ no_team: true }, 'ar')).toBe('من غير فريق');
    expect(r.smallTeamsHidden).toBe(true);
    expect(r.today).toMatchObject({ done: 37, due: 120, pct: 31, active: 12, assigned: 40 });
    expect(r.exercises.map((x) => x.title)).toEqual(['Neck release', 'Wall push-ups']);
    expect(r.hours[0].hour).toBe(7);
    expect(r.hours[r.hours.length - 1].hour).toBe(18);
    expect(r.maxHour).toBe(30);
    expect(r.byDay[0].label).toBe('Sun 8');
    expect(hourWindow([]).length).toBe(11);
  });

  it('keeps percentages empty when the company is under the floor', () => {
    const r = shapeRoutineReport({ ...REPORT, suppressed: true, today: { ...REPORT.today, pct: null }, totals: { ...REPORT.totals, completion_pct: null } }, 'en');
    expect(r.suppressed).toBe(true);
    expect(r.today.pct).toBe(null);
    const sheets = reportSheets({ ...REPORT, suppressed: true, today: { ...REPORT.today, pct: null } }, null, 'en');
    expect(sheets[0].rows.find((row) => row[0] === 'Today: completion')[1]).toBe('—');
    expect(sheets[0].rows.at(-1)[1]).toMatch(/percentages are hidden/);
  });

  it('builds export sheets, with a people sheet only when names are on', () => {
    const people = { enabled: true, people: [{ user_id: 'u1', display_name: 'Amira', team_name: 'Finance', days_active: 5, items_done: 40, full_days: 2, streak: 3, last_active: '2026-11-09' }] };
    const en = reportSheets(REPORT, people, 'en');
    expect(en.map((s) => s.sheet)).toEqual(['Summary', 'By day', 'By team', 'By exercise', 'By hour', 'People who share']);
    expect(en[2].rows[2][0]).toBe('Small teams (3)');
    expect(en[3].rows[1]).toEqual(['Neck release', 200, 400, '50%']);
    expect(en[5].rows[1]).toEqual(['Amira', 'Finance', 5, 40, 2, 3, '2026-11-09']);
    expect(reportSheets(REPORT, { enabled: false, people: [] }, 'ar').map((s) => s.sheet)).toEqual(['ملخص', 'باليوم', 'بالفريق', 'بالتمرين', 'بالساعة']);
  });
});
