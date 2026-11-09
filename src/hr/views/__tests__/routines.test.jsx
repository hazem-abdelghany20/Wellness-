import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const lib = vi.hoisted(() => ({
  listRoutines: vi.fn(), getRoutineDetail: vi.fn(), saveRoutine: vi.fn(), listExercises: vi.fn(), saveExercise: vi.fn(),
  setLibraryStatus: vi.fn(), setLibraryPref: vi.fn(), copyRoutine: vi.fn(), copyExercise: vi.fn(),
  listRoutineAssignments: vi.fn(), assignRoutine: vi.fn(), endRoutineAssignment: vi.fn(), getMyCompanySettings: vi.fn(),
  previewRoutineImport: vi.fn(), importRoutine: vi.fn(), uploadCompanyMedia: vi.fn(), removeCompanyMedia: vi.fn(async () => {}),
  resolveMedia: vi.fn(async () => null), getMediaUrl: vi.fn(async () => null),
}));
vi.mock('../../../lib/supabase-routines', async (orig) => ({ ...(await orig()), ...lib }));
vi.mock('../../../lib/supabase-hr', () => ({ listCompanyTeams: vi.fn(async () => [{ id: 'team-fin', name: 'Finance' }]) }));
const files = vi.hoisted(() => ({ readRoutineFile: vi.fn(), downloadRoutineTemplate: vi.fn(async () => {}) }));
vi.mock('../../../shared/authoring/sheet-files.js', () => files);

import { HRRoutinesPage } from '../routines.jsx';
import { HR_THEMES } from '../../../shared/tokens.jsx';

const neck = { id: 'ex-neck', company_id: 'c1', scope: 'company', status: 'published', name_en: 'Neck release', default_sets_reps: '2 × 10', body_areas: [] };
const push = { id: 'ex-push', company_id: null, scope: 'public', status: 'published', name_en: 'Wall push-ups', default_sets_reps: '3 × 10', body_areas: [] };
const desk = { id: 'r-desk', company_id: 'c1', scope: 'company', status: 'published', title_en: 'Daily desk routine', title_ar: null,
  workdays: [0, 1, 2, 3, 4], day_titles: {}, item_count: 10, assigned: true, hidden: false, pinned: false };
const starter = { id: 'r-pub', company_id: null, scope: 'public', status: 'published', title_en: 'Starter stretch', workdays: [0, 1, 2, 3, 4],
  day_titles: {}, item_count: 6, hidden: false, pinned: false };
const detailOf = (r, items = []) => ({ routine: { ...r, scope: r.company_id ? 'company' : 'public', can_edit: true }, items, assignments: [] });

beforeEach(() => {
  vi.clearAllMocks();
  lib.listRoutines.mockResolvedValue([desk, starter]);
  lib.listExercises.mockResolvedValue([neck, push]);
  lib.listRoutineAssignments.mockResolvedValue([
    { id: 'a1', routine_id: 'r-desk', routine_title_en: 'Daily desk routine', team_id: null, team_name: null,
      starts_on: '2026-11-01', ends_on: null, active: true, status: 'active' },
  ]);
  lib.getMyCompanySettings.mockResolvedValue({ today: '2026-11-09', timezone: 'Africa/Cairo' });
  lib.saveRoutine.mockImplementation(async (input) => detailOf({ id: input.id || 'r-new', company_id: 'c1', ...input }, []));
  lib.assignRoutine.mockResolvedValue({ id: 'a2' });
  lib.endRoutineAssignment.mockResolvedValue({ id: 'a1' });
  lib.saveExercise.mockImplementation(async (input) => ({ id: 'ex-quick', company_id: 'c1', status: 'published', ...input }));
});

const view = () => render(<HRRoutinesPage theme={HR_THEMES.light} lang="en" density="comfortable"/>);

describe('HR routines', () => {
  it('lists routines and who has them, and ends an assignment', async () => {
    view();
    expect((await screen.findAllByText('Daily desk routine')).length).toBe(2); // card + assignment
    expect(screen.getByText('10 rows · Sun–Thu')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('Who has which routine')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText(/Everyone · 1 Nov → no end date/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'End' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, end' }));
    await waitFor(() => expect(lib.endRoutineAssignment).toHaveBeenCalledWith('a1'));
  });

  it('builds a routine row by row, saves the full list, then assigns it from this Sunday', async () => {
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'New routine' }));
    await screen.findByLabelText('Exercise 1');
    fireEvent.change(screen.getByLabelText('Routine name (English)'), { target: { value: 'Desk' } });
    expect(screen.getByLabelText('Time 1')).toHaveValue('09:00');
    fireEvent.change(screen.getByLabelText('Exercise 1'), { target: { value: 'ex-neck' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    expect(screen.getByLabelText('Time 2')).toHaveValue('10:00');
    fireEvent.change(screen.getByLabelText('Exercise 2'), { target: { value: '__text' } });
    fireEvent.change(screen.getByLabelText('Step 2'), { target: { value: 'Drink a glass of water' } });
    fireEvent.change(screen.getByLabelText('Day 2'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    fireEvent.change(screen.getByLabelText('Exercise 3'), { target: { value: 'ex-push' } });
    fireEvent.change(screen.getByLabelText('Sets × reps 3'), { target: { value: '2 × 8' } });
    // Move the last row to the top, then delete the middle one.
    fireEvent.click(within(screen.getByRole('group', { name: 'Row 3' })).getByTitle('Move up'));
    fireEvent.click(within(screen.getByRole('group', { name: 'Row 2' })).getByTitle('Move up'));
    expect(screen.getByLabelText('Exercise 1')).toHaveValue('ex-push');

    // Phone preview of Sunday shows all three, by time.
    const preview = screen.getByRole('complementary', { name: 'Phone preview' });
    fireEvent.click(within(preview).getByRole('button', { name: 'Sun' }));
    expect(within(preview).getByText('Drink a glass of water')).toBeInTheDocument();
    expect(within(preview).getByText('0 of 3 done')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save routine' }));
    await waitFor(() => expect(lib.saveRoutine).toHaveBeenCalledTimes(1));
    const input = lib.saveRoutine.mock.calls[0][0];
    expect(input).toMatchObject({ title_en: 'Desk', workdays: [0, 1, 2, 3, 4] });
    expect(input.items.map((i) => [i.exercise_id, i.title_en, i.at_time, i.weekday, i.sets_reps, i.sort_order])).toEqual([
      ['ex-push', null, '11:00', null, '2 × 8', 1],
      ['ex-neck', null, '09:00', null, null, 2],
      [null, 'Drink a glass of water', '10:00', 0, null, 3],
    ]);

    // Assign panel: everyone, starting this Sunday (today is Monday 9 Nov).
    expect(await screen.findByText('Who gets “Desk”?')).toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-15');
    fireEvent.click(within(screen.getByRole('form', { name: 'Assign routine' })).getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(lib.assignRoutine).toHaveBeenCalledWith({ routineId: 'r-new', teamId: null, startsOn: '2026-11-15', endsOn: null }));
    expect(await screen.findByText(/Assigned. People see it from the start date./)).toBeInTheDocument();
  });

  it('shows row problems instead of saving', async () => {
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'New routine' }));
    await screen.findByLabelText('Exercise 1');
    fireEvent.click(screen.getByRole('button', { name: 'Save routine' }));
    expect(await screen.findByText('Pick an exercise.')).toBeInTheDocument();
    expect(screen.getByText('Add the name in English.')).toBeInTheDocument();
    expect(screen.getByText('Fix 2 highlighted fields.')).toBeInTheDocument();
    expect(lib.saveRoutine).not.toHaveBeenCalled();
  });

  it('adds a new exercise without leaving the routine', async () => {
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'New routine' }));
    fireEvent.change(await screen.findByLabelText('Exercise 1'), { target: { value: '__new' } });
    fireEvent.change(screen.getByLabelText('New exercise name'), { target: { value: 'Ankle circles' } });
    fireEvent.change(screen.getByLabelText('New exercise sets × reps'), { target: { value: '1 × 10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add and use' }));
    await waitFor(() => expect(lib.saveExercise).toHaveBeenCalledWith(expect.objectContaining({ name_en: 'Ankle circles', default_sets_reps: '1 × 10' })));
    await waitFor(() => expect(screen.getByLabelText('Exercise 1')).toHaveValue('ex-quick'));
  });

  it('assigns to one team with an end date and shows server errors in plain words', async () => {
    lib.assignRoutine.mockRejectedValueOnce({ message: 'already_assigned' });
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Assign' }));
    fireEvent.click(screen.getByRole('button', { name: 'One team' }));
    fireEvent.change(screen.getByLabelText('Team'), { target: { value: 'team-fin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-12-31' } });
    fireEvent.click(within(screen.getByRole('form', { name: 'Assign routine' })).getByRole('button', { name: 'Assign' }));
    expect(await screen.findByText('Those people already have this routine for those dates.')).toBeInTheDocument();
    expect(lib.assignRoutine).toHaveBeenCalledWith({ routineId: 'r-desk', teamId: 'team-fin', startsOn: '2026-11-09', endsOn: '2026-12-31' });
  });

  it('"Use this" copies a Wellness House routine and opens the copy', async () => {
    lib.copyRoutine.mockResolvedValue(detailOf({ ...starter, id: 'r-copy', company_id: 'c1' }, [
      { id: 'i1', exercise_id: 'ex-push', at_time: '10:00', weekday: null, exercise: push },
    ]));
    view();
    fireEvent.click(await screen.findByRole('tab', { name: 'Wellness House · 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use this' }));
    await waitFor(() => expect(lib.copyRoutine).toHaveBeenCalledWith('r-pub'));
    expect(await screen.findByDisplayValue('Starter stretch')).toBeInTheDocument();
    expect(await screen.findByText(/Copied to your company/)).toBeInTheDocument();
  });

  it('imports from a sheet: preview with problems and new exercises, then import and open it', async () => {
    files.readRoutineFile.mockResolvedValue([
      ['time', 'exercise', 'sets_reps', 'weekday'],
      ['09:00', 'Neck release', '2 x 10', ''],
      ['25:00', 'Wall push-ups', '3 x 10', ''],
      ['10:00', 'Ankle circles', '1 x 10', 'Friday'],
    ]);
    const summary = { dry_run: true, saved: false, rows: 3, items: 1, exercises_matched: 1, exercises_created: 0,
      new_exercises: ['Ankle circles'], problems: [{ row: 3, reason: 'bad_time', value: '25:00' }, { row: 4, reason: 'weekday_not_workday', value: 'Friday' }], warnings: [] };
    lib.previewRoutineImport.mockResolvedValue(summary);
    lib.importRoutine.mockResolvedValue({ ...summary, dry_run: false, saved: true, routine_id: 'r-imp', assignment_id: null });
    lib.getRoutineDetail.mockResolvedValue(detailOf({ id: 'r-imp', company_id: 'c1', title_en: 'coach plan', workdays: [0, 1, 2, 3, 4], day_titles: {} }, [
      { id: 'i1', exercise_id: 'ex-neck', at_time: '09:00', weekday: null, exercise: neck },
    ]));
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Import from sheet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download template' }));
    expect(files.downloadRoutineTemplate).toHaveBeenCalledWith('en');
    fireEvent.change(screen.getByLabelText('Choose the sheet'), { target: { files: [new File(['x'], 'coach_plan.xlsx')] } });

    await waitFor(() => expect(lib.previewRoutineImport).toHaveBeenCalledTimes(1));
    expect(lib.previewRoutineImport.mock.calls[0][0]).toEqual({ title_en: 'coach plan' });
    expect(lib.previewRoutineImport.mock.calls[0][1]).toEqual([
      { row: 2, exercise: 'Neck release', time: '09:00', sets_reps: '2 x 10' },
      { row: 3, exercise: 'Wall push-ups', time: '25:00', sets_reps: '3 x 10' },
      { row: 4, exercise: 'Ankle circles', time: '10:00', sets_reps: '1 x 10', weekday: 'Friday' },
    ]);
    expect(await screen.findByText('Time not understood (use 09:30) (“25:00”)')).toBeInTheDocument();
    expect(screen.getByText('That day isn’t a workday (“Friday”)')).toBeInTheDocument();
    expect(screen.getByText('Ankle circles')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 row' }));
    await waitFor(() => expect(lib.importRoutine).toHaveBeenCalledTimes(1));
    expect(lib.importRoutine.mock.calls[0][0]).toEqual({ title_en: 'coach plan', assign: true, team_id: null, starts_on: '2026-11-15' });
    await waitFor(() => expect(lib.getRoutineDetail).toHaveBeenCalledWith('r-imp'));
    expect(await screen.findByDisplayValue('coach plan')).toBeInTheDocument();
    expect(screen.getByText(/Imported 1 rows/)).toBeInTheDocument();
  });

  it('explains a sheet without an exercise column', async () => {
    files.readRoutineFile.mockResolvedValue([['time', 'reps'], ['09:00', '10']]);
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Import from sheet' }));
    fireEvent.change(screen.getByLabelText('Choose the sheet'), { target: { files: [new File(['x'], 'plan.csv')] } });
    expect(await screen.findByText(/couldn’t find an “exercise” column/)).toBeInTheDocument();
    expect(lib.previewRoutineImport).not.toHaveBeenCalled();
  });
});
