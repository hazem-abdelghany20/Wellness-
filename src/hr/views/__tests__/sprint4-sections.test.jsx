import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const lib = vi.hoisted(() => ({
  getMyCompanySettings: vi.fn(), setCompanySettings: vi.fn(),
  getRoutineReport: vi.fn(), getRoutinePeople: vi.fn(),
  listRoutines: vi.fn(), getRoutineDetail: vi.fn(),
  saveChallengeTemplate: vi.fn(), setLibraryStatus: vi.fn(),
}));
vi.mock('../../../lib/supabase-routines', async (orig) => ({ ...(await orig()), ...lib }));
vi.mock('../../../shared/authoring/sheet-files.js', () => ({ downloadRoutineReport: vi.fn(async () => {}) }));

const challenges = vi.hoisted(() => ({
  templates: [], scheduled: [], teams: [], loading: false, error: null,
  schedule: vi.fn(), cancel: vi.fn(), refetch: vi.fn(async () => {}),
}));
vi.mock('../../hooks/use-challenges.js', () => ({ useChallenges: () => challenges }));

const catalog = vi.hoisted(() => ({
  items: [], byCategory: { wh_service: [], amazon: [], custom: [] }, loading: false, error: null,
  upsert: vi.fn(), deactivate: vi.fn(), refetch: vi.fn(),
}));
vi.mock('../../hooks/use-gift-catalog.js', () => ({ useGiftCatalog: () => catalog }));

import { RoutineSettingsPanels } from '../settings-routine.jsx';
import { HRChallengesPage } from '../challenges.jsx';
import { HRRoutineReportPage } from '../routine-report.jsx';
import { HRGiftCatalogPage } from '../gifts-catalog.jsx';
import { RoutineBuilder } from '../../../shared/authoring/routine-builder.jsx';
import { HR_THEMES } from '../../../shared/tokens.jsx';

// Render-heavy screens: give them room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 20000 });
const T = HR_THEMES.light;
const TODAY = '2026-11-16'; // a Monday: the coming Sunday is 22 Nov

const SETTINGS = { timezone: 'Africa/Cairo', recognition: 'named', weekly_habit_enabled: true, hr_people_view: false,
  everyone_visible: false, quiet_hours: true, quiet_window: { from: '20:00', to: '08:00' } };

beforeEach(() => {
  vi.clearAllMocks();
  challenges.templates = [
    { id: 'tp-pub', company_id: null, title_en: 'The Water Bottle', target: 4, payload: { action_en: 'Keep a bottle on your desk.', success_days: 4 } },
    { id: 'tp-own', company_id: 'c1', title_en: 'Two-week water', target: 8, payload: { action_en: 'Drink 6 glasses.', weeks: 2, success_days: 8 } },
  ];
  challenges.scheduled = [];
  challenges.teams = [{ id: 't1', name: 'Finance' }];
  challenges.schedule.mockResolvedValue({ id: 'c-new', workdays: 3, success_days: 3 });
  challenges.cancel.mockResolvedValue();
  catalog.byCategory = { wh_service: [], amazon: [], custom: [] };
  catalog.upsert.mockResolvedValue({});
});

describe('Settings: everyone takes part', () => {
  it('asks before turning it on, then locks the HR people view on', async () => {
    lib.getMyCompanySettings.mockResolvedValue(SETTINGS);
    lib.setCompanySettings.mockImplementation(async (patch) => ({ ...SETTINGS, ...patch, hr_people_view: !!patch.everyone_visible }));
    const onSaved = vi.fn();
    render(<RoutineSettingsPanels theme={T} lang="en" density="comfortable" onSaved={onSaved}/>);
    const sw = await screen.findByRole('button', { name: 'Everyone takes part (no opt-in)' });
    expect(screen.getByText(/Nothing about health is ever shown\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'HR people view' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Teams \+ people who opt in/ })).toBeInTheDocument();

    // Cancel: nothing is saved.
    fireEvent.click(sw);
    expect(lib.setCompanySettings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Turn on' })).not.toBeInTheDocument();
    expect(lib.setCompanySettings).not.toHaveBeenCalled();

    // Turn on: saved on its own, like the other switches.
    fireEvent.click(sw);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    await waitFor(() => expect(lib.setCompanySettings).toHaveBeenCalledWith({ everyone_visible: true }));
    expect(onSaved).toHaveBeenCalledWith({ everyone_visible: true });
    expect(await screen.findByText('On because everyone takes part')).toBeInTheDocument();
    const peopleView = screen.getByRole('button', { name: 'HR people view' });
    expect(peopleView).toBeDisabled();
    expect(peopleView).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Teams \+ names/ })).toBeInTheDocument(); // nobody opts in any more
    expect(screen.queryByRole('button', { name: 'Turn on' })).not.toBeInTheDocument();

    // Turning it off needs no confirm.
    fireEvent.click(screen.getByRole('button', { name: 'Everyone takes part (no opt-in)' }));
    await waitFor(() => expect(lib.setCompanySettings).toHaveBeenLastCalledWith({ everyone_visible: false }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'HR people view' })).toBeEnabled());
  });

  it('reads in Arabic and points to the board when it only shows teams', async () => {
    lib.getMyCompanySettings.mockResolvedValue({ ...SETTINGS, recognition: 'teams', everyone_visible: true, hr_people_view: true });
    render(<RoutineSettingsPanels theme={T} lang="ar" density="comfortable"/>);
    expect(await screen.findByText('الكل مشارك (من غير اختيار)')).toBeInTheDocument();
    expect(screen.getByText('مفتوح علشان الكل مشارك')).toBeInTheDocument();
    expect(screen.getByText(/اللوحة بتعرض الفرق بس/)).toBeInTheDocument();
  });
});

describe('Challenges: own dates, several at once', () => {
  const view = (props = {}) => render(<HRChallengesPage theme={T} lang="en" density="comfortable" today={TODAY} {...props}/>);

  it('schedules a template from a start date to an end date, days needed capped to the working days', async () => {
    challenges.scheduled = [{ id: 'c-run', title_en: 'Stand up hourly', team_name: null, start_date: '2026-11-15', end_date: '2026-11-26', status: 'active', auto: false, participants: 4, completed: 0 }];
    view();
    // A challenge already runs on those days: nothing warns or blocks.
    expect(screen.queryByText(/already has a challenge/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-22');
    expect(screen.getByLabelText('End date')).toHaveValue('2026-11-26');   // the coming Sunday → that Thursday

    fireEvent.click(screen.getByRole('button', { name: /Two-week water/ }));
    expect(screen.getByLabelText('End date')).toHaveValue('2026-12-03');   // the template's two weeks
    expect(screen.getByLabelText('Days needed')).toHaveValue(8);
    expect(screen.getByText(/10 working days \(Sun–Thu\) in these dates/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-24' } }); // 3 days of it
    expect(screen.getByText(/3 working days \(Sun–Thu\) in these dates/)).toBeInTheDocument();
    expect(screen.getByLabelText('Days needed')).toHaveValue(3);
    fireEvent.change(screen.getByLabelText('Who'), { target: { value: 't1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    await waitFor(() => expect(challenges.schedule).toHaveBeenCalledWith({
      templateId: 'tp-own', startDate: '2026-11-22', endDate: '2026-11-24', successDays: 3, teamId: 't1',
    }));
    expect(await screen.findByText('Sent. Everyone it is for got a note in the app.')).toBeInTheDocument();
  });

  it('checks the dates first, and says when the same challenge already runs on those days', async () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: /The Water Bottle/ }));
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-21' } }); // Friday + Saturday
    expect(screen.getByText(/0 working days/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(await screen.findByText('Those dates have no working day (Sunday to Thursday).')).toBeInTheDocument();
    expect(challenges.schedule).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-22' } });
    expect(screen.getByLabelText('End date')).toHaveValue('2026-11-26'); // an end before the new start follows the start again
    challenges.schedule.mockRejectedValueOnce(Object.assign(new Error('habit_week_taken'), { details: 'قزازة المية | The Water Bottle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(await screen.findByText('That challenge already runs on those days. Pick other dates.')).toBeInTheDocument();
    expect(challenges.schedule).toHaveBeenCalledWith({ templateId: 'tp-pub', startDate: '2026-11-22', endDate: '2026-11-26', successDays: 4, teamId: null });
  });

  it('ends a running challenge after a confirm, cancels an upcoming one, and shows dates', async () => {
    challenges.scheduled = [
      { id: 'c-up', title_en: 'Walk at lunch', team_name: 'Finance', start_date: '2026-11-23', end_date: '2026-11-25', status: 'upcoming', auto: false, participants: 0, completed: 0 },
      { id: 'c-run', title_en: 'Stand up hourly', team_name: null, start_date: '2026-11-15', end_date: '2026-11-19', status: 'active', auto: false, participants: 4, completed: 0 },
      { id: 'c-old', title_en: 'Water', team_name: null, start_date: '2026-11-01', end_date: '2026-11-05', status: 'done', auto: false, participants: 9, completed: 5, completion_pct: 50 },
      { id: 'c-cut', title_en: 'Stairs', team_name: null, start_date: '2026-11-08', end_date: '2026-11-12', status: 'cancelled', auto: false, participants: 6, completed: 1, completion_pct: 3 },
      { id: 'c-off', title_en: 'Tea break', team_name: null, start_date: '2026-11-08', end_date: '2026-11-12', status: 'cancelled', auto: false, participants: 0, completed: 0 },
    ];
    view();
    expect(screen.getByText(/Finance · 23 Nov → 25 Nov/)).toBeInTheDocument();
    // Ended while running: people kept their days, so it shows its numbers, not "Cancelled".
    expect(screen.getByText('Ended early')).toBeInTheDocument();
    expect(screen.getByText('6 took part · 1 completed')).toBeInTheDocument();
    expect(screen.getAllByText('Cancelled')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'End now' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'End now' }));
    expect(screen.getByText('End this challenge today? People keep the days they logged.')).toBeInTheDocument();
    expect(challenges.cancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, end it' }));
    await waitFor(() => expect(challenges.cancel).toHaveBeenCalledWith('c-run'));
    expect(await screen.findByText('Ended. People keep the days they logged.')).toBeInTheDocument();

    challenges.cancel.mockRejectedValueOnce(new Error('only_upcoming_can_be_cancelled'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(challenges.cancel).toHaveBeenLastCalledWith('c-up'));
    expect(await screen.findByText('That challenge is already over.')).toBeInTheDocument();
  });

  it('starts a challenge from routine exercises: hidden rows are not offered, the day counts by itself', async () => {
    lib.listRoutines.mockResolvedValue([
      { id: 'r-desk', scope: 'company', status: 'published', title_en: 'Daily desk routine', workdays: [0, 1, 2, 3, 4], assigned: true },
      { id: 'r-old', scope: 'company', status: 'archived', title_en: 'Old routine', workdays: [0, 1, 2, 3, 4], assigned: false },
    ]);
    lib.getRoutineDetail.mockResolvedValue({
      routine: { id: 'r-desk', title_en: 'Daily desk routine', workdays: [0, 1, 2, 3, 4] },
      items: [
        { id: 'i1', at_time: '09:00', weekday: null, exercise: { name_en: 'Neck release' } },
        { id: 'i2', at_time: '13:00', weekday: 2, title_en: 'Walk 10 minutes', exercise: null },
        { id: 'i3', at_time: '15:00', weekday: null, hidden_at: '2026-11-15T08:00:00Z', exercise: { name_en: 'Squats' } },
      ],
    });
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Challenge from routine exercises' }));
    const form = screen.getByRole('form', { name: 'Challenge from routine exercises' });
    expect(screen.getByText('The day counts by itself when a person ticks these in Today. No extra button.')).toBeInTheDocument();
    await waitFor(() => expect(lib.listRoutines).toHaveBeenCalledWith('company'));

    // Nothing filled in yet: the problems show, nothing is sent.
    fireEvent.click(within(form).getByRole('button', { name: 'Start challenge' }));
    expect(await within(form).findByText('Pick a routine.')).toBeInTheDocument();
    expect(within(form).getByText('Add the name in English.')).toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText('Name (English)'), { target: { value: 'Walk on Tuesday' } });
    const routine = await within(form).findByLabelText('Routine');
    expect(within(routine).queryByText('Old routine')).not.toBeInTheDocument(); // archived routines are left out
    fireEvent.change(routine, { target: { value: 'r-desk' } });
    await waitFor(() => expect(lib.getRoutineDetail).toHaveBeenCalledWith('r-desk'));
    const rows = await within(form).findByRole('group', { name: 'Exercises that count' });
    expect(within(rows).getAllByRole('checkbox')).toHaveLength(2);
    expect(within(rows).queryByText('Squats')).not.toBeInTheDocument();
    expect(within(form).getByText('1 hidden row is not offered.')).toBeInTheDocument();
    expect(within(rows).getByText('Every workday')).toBeInTheDocument();
    expect(within(rows).getByText('Only Tuesday')).toBeInTheDocument();

    // Only the Tuesday row: one day of the week can count, so days needed is 1.
    fireEvent.click(within(rows).getByRole('checkbox', { name: /Walk 10 minutes/ }));
    expect(within(form).getByText(/the exercises you ticked are due on 1 of them/)).toBeInTheDocument();
    expect(within(form).getByLabelText('Days needed')).toHaveValue(1);
    // With the every-day row too, all 5 working days can count: 80% by default.
    fireEvent.click(within(rows).getByRole('checkbox', { name: /Neck release/ }));
    expect(within(form).getByLabelText('Days needed')).toHaveValue(4);
    expect(within(form).getByText('2 of up to 20 picked')).toBeInTheDocument();

    fireEvent.click(within(form).getByRole('button', { name: 'Start challenge' }));
    await waitFor(() => expect(challenges.schedule).toHaveBeenCalledWith({
      title_en: 'Walk on Tuesday', routineItemIds: ['i2', 'i1'], startDate: '2026-11-22', endDate: '2026-11-26', successDays: 4, teamId: null,
    }));
    expect(await screen.findByText('Sent. Everyone it is for got a note in the app.')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Challenge from routine exercises' })).not.toBeInTheDocument();
  });

  it('keeps the routine form open and explains a refusal', async () => {
    lib.listRoutines.mockResolvedValue([{ id: 'r-desk', scope: 'company', status: 'published', title_en: 'Daily desk routine', workdays: [0, 1, 2, 3, 4], assigned: false }]);
    lib.getRoutineDetail.mockResolvedValue({ routine: { id: 'r-desk', workdays: [0, 1, 2, 3, 4] }, items: [{ id: 'i1', at_time: '09:00', weekday: null, exercise: { name_en: 'Neck release' } }] });
    challenges.schedule.mockRejectedValueOnce(new Error('item_not_found'));
    view({ lang: 'ar' });
    fireEvent.click(screen.getByRole('button', { name: 'تحدي من تمارين الروتين' }));
    const form = screen.getByRole('form', { name: 'تحدي من تمارين الروتين' });
    fireEvent.change(within(form).getByLabelText('الاسم (بالإنجليزي)'), { target: { value: 'Stretch week' } });
    fireEvent.change(await within(form).findByLabelText('الروتين'), { target: { value: 'r-desk' } });
    expect(await within(form).findByText(/الروتين ده لسه مش متوزّع على حد/)).toBeInTheDocument();
    fireEvent.click(await within(form).findByRole('checkbox'));
    fireEvent.click(within(form).getByRole('button', { name: 'ابدأ التحدي' }));
    expect(await within(form).findByText('فيه تمرين من دول اتشال أو اتخفى. اختار تاني.')).toBeInTheDocument();
  });
});

describe('Routine report: everyone is listed', () => {
  it('drops the opt-in wording when the company shows everyone', async () => {
    lib.getRoutineReport.mockResolvedValue({
      range: '14d', from: '2026-11-03', to: '2026-11-16', timezone: 'Africa/Cairo', min_cohort: 5, members: 40, suppressed: false, has_routine: true,
      today: { date: '2026-11-16', assigned: 40, active: 12, done: 37, due: 120, full_days: 3, pct: 31, active_pct: 30 },
      totals: { done: 400, due: 1000, full_days: 20, active_people: 30, completion_pct: 40 },
      by_day: [], by_team: [], by_exercise: [], by_hour: [{ hour: 10, checks: 30 }],
    });
    lib.getRoutinePeople.mockResolvedValue({ enabled: true, everyone: true, opted_in: 2, not_shared: 0, people: [
      { user_id: 'u1', display_name: 'Amira Hassan', initials: 'AH', team_name: 'Finance', days_active: 5, items_done: 42, full_days: 2, streak: 3, last_active: '2026-11-15' },
      { user_id: 'u2', display_name: 'Omar Said', initials: 'OS', team_name: null, days_active: 0, items_done: 0, full_days: 0, streak: 0, last_active: null },
    ] });
    render(<HRRoutineReportPage theme={T} lang="en" density="comfortable"/>);
    expect(await screen.findByText('Everyone is listed (company setting)')).toBeInTheDocument();
    expect(screen.getByText('Omar Said')).toBeInTheDocument();
    expect(screen.queryByText(/share · /)).not.toBeInTheDocument();
    expect(screen.queryByText('People who share their progress')).not.toBeInTheDocument();
    expect(screen.queryByText(/chose to share|chose, in their app/)).not.toBeInTheDocument();
  });
});

describe('Routine builder: hide / show one row', () => {
  const neck = { id: 'ex-neck', company_id: 'c1', scope: 'company', status: 'published', name_en: 'Neck release', default_sets_reps: '2 × 10' };
  const push = { id: 'ex-push', company_id: 'c1', scope: 'company', status: 'published', name_en: 'Wall push-ups', default_sets_reps: '3 × 10' };
  const detail = (hidden = null) => ({
    routine: { id: 'r1', company_id: 'c1', title_en: 'Desk', workdays: [0, 1, 2, 3, 4], day_titles: {}, status: 'published', scope: 'company', can_edit: true },
    items: [
      { id: 'i1', exercise_id: 'ex-neck', at_time: '09:00', weekday: null, sets_reps: null, exercise: neck, hidden_at: hidden },
      { id: 'i2', exercise_id: 'ex-push', at_time: '10:00', weekday: null, sets_reps: null, exercise: push, hidden_at: null },
    ],
    assignments: [],
  });
  const builder = (props = {}) => render(
    <RoutineBuilder theme={T} lang="en" density="comfortable" detail={detail()} exercises={[neck, push]} todayWeekday={0}
      onSave={vi.fn(async () => detail())} onCancel={() => {}} onCreateExercise={vi.fn()} {...props}/>);

  it('hides a saved row without losing unsaved edits, and saving never sends hidden_at', async () => {
    const onSetItemHidden = vi.fn(async (id, hidden) => detail(hidden ? '2026-11-16T09:00:00Z' : null));
    const onSave = vi.fn(async () => detail('2026-11-16T09:00:00Z'));
    builder({ onSetItemHidden, onSave });
    const preview = screen.getByRole('complementary', { name: 'Phone preview' });
    expect(within(preview).getByText('0 of 2 done')).toBeInTheDocument();

    // An unsaved edit in another row, and a brand-new row.
    fireEvent.change(screen.getByLabelText('Sets × reps 2'), { target: { value: '5 × 5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    expect(within(screen.getByRole('group', { name: 'Row 3' })).queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('group', { name: 'Row 1' })).getByRole('button', { name: 'Hide' }));
    await waitFor(() => expect(onSetItemHidden).toHaveBeenCalledWith('i1', true));
    const row1 = screen.getByRole('group', { name: 'Row 1' });
    expect(await within(row1).findByText('Hidden')).toBeInTheDocument();
    expect(within(row1).getByText('Employees don’t see it. History stays.')).toBeInTheDocument();
    expect(within(row1).getByRole('button', { name: 'Show' })).toBeInTheDocument();
    expect(screen.getByLabelText('Sets × reps 2')).toHaveValue('5 × 5');            // the edit is still there
    expect(screen.getByRole('group', { name: 'Row 3' })).toBeInTheDocument();      // so is the new row
    expect(screen.getByText(/3 rows · 1 hidden/)).toBeInTheDocument();
    expect(within(preview).queryByText('Neck release')).not.toBeInTheDocument();   // not in the phone preview
    expect(within(preview).getByText('0 of 1 done')).toBeInTheDocument();

    // Save: the hidden row is still sent (with its id), without hidden_at.
    fireEvent.change(screen.getByLabelText('Exercise 3'), { target: { value: 'ex-push' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save routine' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const input = onSave.mock.calls[0][0];
    expect(input.items.map((it) => it.id)).toEqual(['i1', 'i2', undefined]);
    expect(input.items.some((it) => 'hidden_at' in it)).toBe(false);
    expect(input.items[1].sets_reps).toBe('5 × 5');
  });

  it('shows the row again, reports a refusal, and has no button without the prop', async () => {
    const onSetItemHidden = vi.fn(async (id, hidden) => detail(hidden ? '2026-11-16T09:00:00Z' : null));
    const { unmount } = render(
      <RoutineBuilder theme={T} lang="en" density="comfortable" detail={detail('2026-11-15T08:00:00Z')} exercises={[neck, push]} todayWeekday={0}
        onSave={vi.fn()} onCancel={() => {}} onCreateExercise={vi.fn()} onSetItemHidden={onSetItemHidden}/>);
    const row1 = screen.getByRole('group', { name: 'Row 1' });
    expect(within(row1).getByText('Hidden')).toBeInTheDocument();   // the tag is there when the routine is opened again
    fireEvent.click(within(row1).getByRole('button', { name: 'Show' }));
    await waitFor(() => expect(onSetItemHidden).toHaveBeenCalledWith('i1', false));
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Row 1' })).queryByText('Hidden')).not.toBeInTheDocument());

    onSetItemHidden.mockRejectedValueOnce(new Error('item_not_found'));
    fireEvent.click(within(screen.getByRole('group', { name: 'Row 2' })).getByRole('button', { name: 'Hide' }));
    expect(await screen.findByText('A row was removed meanwhile. Reload and try again.')).toBeInTheDocument();
    unmount();

    builder(); // the admin console passes no onSetItemHidden
    expect(screen.queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show' })).not.toBeInTheDocument();
  });
});

describe('Gifts: rewards with no money value', () => {
  it('adds a reward HR wrote itself, with no price and no amount shown', async () => {
    catalog.byCategory = { wh_service: [], amazon: [], custom: [
      { id: 'g1', category: 'custom', name_en: 'A thank-you from the CEO', name_ar: null, value_minor: 0, currency: 'EGP', active: true },
      { id: 'g2', category: 'custom', name_en: 'Team lunch', name_ar: null, value_minor: 50000, currency: 'EGP', active: true },
    ] };
    render(<HRGiftCatalogPage theme={T} lang="en" density="comfortable"/>);
    expect(screen.getByText('A thank-you from the CEO')).toBeInTheDocument();
    expect(screen.queryByText('0 EGP')).not.toBeInTheDocument();
    expect(screen.getByText('500 EGP')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Amazon/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Sprint 2|Tremendous|voucher|cash/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Add your own rewards: a thank-you note, an early leave, a team lunch\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add reward' }));
    expect(screen.getByText('New reward')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled(); // only the name is needed
    fireEvent.change(screen.getByPlaceholderText('A thank-you from the CEO'), { target: { value: 'Leave an hour early' } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(catalog.upsert).toHaveBeenCalledWith(expect.objectContaining({
      name_en: 'Leave an hour early', value_minor: 0, currency: 'EGP', category: 'custom', active: true,
    })));
  });

  it('keeps WH services, and an Amazon tab only for a catalog that already has Amazon items', () => {
    catalog.byCategory = { wh_service: [{ id: 'w1', category: 'wh_service', name_en: 'Sleep Reset', value_minor: 150000, currency: 'EGP', active: true }],
      amazon: [{ id: 'a1', category: 'amazon', name_en: 'Old voucher', value_minor: 20000, currency: 'EGP', active: true }], custom: [] };
    render(<HRGiftCatalogPage theme={T} lang="en" density="comfortable"/>);
    expect(screen.getByText('No rewards of your own yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /WH Services/ }));
    expect(screen.getByText('1,500 EGP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add WH service' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Amazon/ })).toBeInTheDocument();
  });
});
