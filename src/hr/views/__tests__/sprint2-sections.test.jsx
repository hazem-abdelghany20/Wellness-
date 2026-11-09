import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const lib = vi.hoisted(() => ({
  saveContentItem: vi.fn(), setLibraryStatus: vi.fn(), setLibraryPref: vi.fn(), saveChallengeTemplate: vi.fn(),
  getMyCompanySettings: vi.fn(), setCompanySettings: vi.fn(),
  uploadCompanyMedia: vi.fn(), removeCompanyMedia: vi.fn(async () => {}), resolveMedia: vi.fn(async () => null), getMediaUrl: vi.fn(),
}));
vi.mock('../../../lib/supabase-routines', async (orig) => ({ ...(await orig()), ...lib }));

const content = vi.hoisted(() => ({ items: [], loading: false, error: null, update: vi.fn(), refetch: vi.fn(async () => {}) }));
vi.mock('../../hooks/use-content.js', () => ({ useContent: () => content }));

const challenges = vi.hoisted(() => ({
  templates: [], scheduled: [], teams: [], loading: false, error: null,
  schedule: vi.fn(), cancel: vi.fn(), refetch: vi.fn(async () => {}),
}));
vi.mock('../../hooks/use-challenges.js', () => ({ useChallenges: () => challenges }));

const participation = vi.hoisted(() => ({ data: null, loading: false, error: null }));
vi.mock('../../hooks/use-participation.js', () => ({ useParticipation: () => participation }));
vi.mock('../../hooks/use-broadcasts.js', () => ({ useBroadcasts: () => ({ list: [] }) }));
vi.mock('../../state/auth-context.jsx', () => ({ useHRAuth: () => ({ company: { name: 'Nile' } }) }));

import { HRContentPage } from '../content.jsx';
import { HRChallengesPage } from '../challenges.jsx';
import { RoutineSettingsPanels } from '../settings-routine.jsx';
import { HRDashboard } from '../dashboard.jsx';
import { HR_THEMES, HR_STRINGS } from '../../../shared/tokens.jsx';

const T = HR_THEMES.light;

beforeEach(() => {
  vi.clearAllMocks();
  content.items = [
    { id: 'own-1', company_id: 'c1', scope: 'company', kind: 'fact', status: 'draft', title_en: 'Did you know', body_en: 'Stand up every 30 minutes.', pinned: false, hidden: false },
    { id: 'pub-1', company_id: null, scope: 'public', kind: 'article', status: 'published', title_en: 'Sleep basics', category: 'sleep', duration_mins: 4, pinned: false, hidden: false },
  ];
  content.update.mockResolvedValue({});
  lib.saveContentItem.mockResolvedValue({ id: 'new' });
  lib.setLibraryStatus.mockResolvedValue({});
  lib.setLibraryPref.mockResolvedValue({});
  challenges.templates = [
    { id: 'tp-pub', company_id: null, title_en: 'The Water Bottle', target: 4, payload: { action_en: 'Keep a bottle on your desk.', success_days: 4 } },
    { id: 'tp-own', company_id: 'c1', title_en: 'Two-week water', target: 8,
      payload: { action_en: 'Drink 6 glasses.', weeks: 2, success_days: 8, media_type: 'video', media_bucket: 'company-media', media_path: 'c1/challenges/w.mp4' } },
  ];
  challenges.scheduled = [];
  challenges.schedule.mockResolvedValue({});
  lib.saveChallengeTemplate.mockResolvedValue({ id: 'tp-new' });
});

describe('HR content: two libraries', () => {
  it('your company: publish, write a fact; Wellness House: hide and pin only', async () => {
    render(<HRContentPage theme={T} S={HR_STRINGS.en} lang="en" density="comfortable"/>);
    expect(screen.getByRole('tab', { name: 'Your company · 1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Stand up every 30 minutes.')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(lib.setLibraryStatus).toHaveBeenCalledWith('content', 'own-1', 'published'));

    fireEvent.click(screen.getByRole('button', { name: 'Write' }));
    fireEvent.click(screen.getByRole('button', { name: /^Fact/ }));
    fireEvent.change(screen.getByLabelText('Title (English)'), { target: { value: 'Water' } });
    fireEvent.change(screen.getByLabelText('The fact (Arabic)'), { target: { value: 'اشرب مية كل ساعة.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() => expect(lib.saveContentItem).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'fact', title_en: 'Water', body_ar: 'اشرب مية كل ساعة.', status: 'draft' })));

    fireEvent.click(screen.getByRole('tab', { name: 'Wellness House · 1' }));
    expect(screen.getByText('Sleep basics')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    await waitFor(() => expect(content.update).toHaveBeenCalledWith('pub-1', { status: 'draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
    await waitFor(() => expect(content.update).toHaveBeenCalledWith('pub-1', { pinned: true }));
  });
});

describe('HR challenges: own templates', () => {
  it('groups own and Wellness House templates and shows multi-week lengths', () => {
    render(<HRChallengesPage theme={T} lang="en" density="comfortable"/>);
    expect(screen.getByText('Your company')).toBeInTheDocument();
    expect(screen.getByText('Wellness House')).toBeInTheDocument();
    expect(screen.getByText('2 weeks')).toBeInTheDocument();
    expect(screen.getByText(/8 of 10 days/)).toBeInTheDocument();
    expect(screen.getByText(/4 of 5 days/)).toBeInTheDocument();
    expect(screen.getByText('How-to video')).toBeInTheDocument(); // company-media payload, no media_url
  });

  it('creates a two-week challenge with 8 of 10 days by default and picks it', async () => {
    render(<HRChallengesPage theme={T} lang="en" density="comfortable"/>);
    fireEvent.click(screen.getByRole('button', { name: 'Create your own challenge' }));
    const form = screen.getByRole('form', { name: 'Challenge' });
    fireEvent.change(within(form).getByLabelText('Name (English)'), { target: { value: 'Drink water' } });
    fireEvent.change(within(form).getByLabelText('The daily action (English)'), { target: { value: 'Drink 6 glasses.' } });
    fireEvent.click(within(form).getByRole('button', { name: '2 weeks' }));
    expect(within(form).getByLabelText('Days needed to win')).toHaveValue(8);
    // preview: the days come week by week (2 × Sun–Thu), not start + i
    expect(screen.getByText('Week 2')).toBeInTheDocument();
    expect(screen.getByText('0 of 8 days for the reward')).toBeInTheDocument();
    fireEvent.click(within(form).getByRole('button', { name: 'Create challenge' }));
    await waitFor(() => expect(lib.saveChallengeTemplate).toHaveBeenCalledWith({
      title_en: 'Drink water', weeks: 2, success_days: 8, payload: { action_en: 'Drink 6 glasses.' },
    }));
    expect(challenges.refetch).toHaveBeenCalled();
    expect(await screen.findByText(/Challenge created and picked below/)).toBeInTheDocument();
  });

  it('archives an own template', async () => {
    render(<HRChallengesPage theme={T} lang="en" density="comfortable"/>);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, archive' }));
    await waitFor(() => expect(lib.setLibraryStatus).toHaveBeenCalledWith('challenge_template', 'tp-own', 'archived'));
  });
});

describe('HR settings: recognition, weekly habit, names, time zone', () => {
  it('saves each setting on its own and shows errors in the UI language', async () => {
    lib.getMyCompanySettings.mockResolvedValue({ timezone: 'Africa/Cairo', recognition: 'off', weekly_habit_enabled: true, hr_people_view: false });
    lib.setCompanySettings.mockImplementation(async (patch) => ({ timezone: 'Africa/Cairo', recognition: 'off', weekly_habit_enabled: true, hr_people_view: false, ...patch }));
    const onSaved = vi.fn();
    render(<RoutineSettingsPanels theme={T} lang="en" density="comfortable" onSaved={onSaved}/>);
    fireEvent.click(await screen.findByRole('button', { name: /Teams \+ people who opt in/ }));
    await waitFor(() => expect(lib.setCompanySettings).toHaveBeenCalledWith({ recognition: 'named' }));
    expect(onSaved).toHaveBeenCalledWith({ recognition: 'named' });
    expect(screen.getByText(/pause it while a routine runs/)).toBeInTheDocument();
    expect(screen.getByLabelText('Time zone')).toHaveValue('Africa/Cairo');

    lib.setCompanySettings.mockRejectedValueOnce({ message: 'invalid_setting', details: 'timezone' });
    fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'Asia/Dubai' } });
    expect(await screen.findByText('That value isn’t allowed for “Time zone”.')).toBeInTheDocument();
  });

  it('works in Arabic', async () => {
    lib.getMyCompanySettings.mockResolvedValue({ timezone: 'Europe/Paris', recognition: 'teams', weekly_habit_enabled: false, hr_people_view: true });
    render(<RoutineSettingsPanels theme={T} lang="ar" density="comfortable"/>);
    expect(await screen.findByText('التقدير')).toBeInTheDocument();
    expect(screen.getByText('متوقفة')).toBeInTheDocument();
    expect(screen.getByLabelText('المنطقة الزمنية')).toHaveValue('Europe/Paris'); // a zone outside the list stays selectable
  });
});

describe('HR dashboard: today’s routine card', () => {
  const base = { members: 40, took_part: 10, completed: 4, reads: 2, weekly: [], top_articles: [] };
  const renderDash = () => render(<HRDashboard theme={T} S={HR_STRINGS.en} cfg={{ lang: 'en' }} density="comfortable" gap={20} range="30d"
    companyName="Nile" firstName="Hana" setNav={setNav}/>);
  const setNav = vi.fn();

  it('shows done / due and links to the report only while a routine is assigned', () => {
    participation.data = { ...base, routine: { has_routine: true, due_today: 120, done_today: 37, active_today: 12, assigned_today: 40, pct_today: 31 } };
    renderDash();
    expect(screen.getByText("Today's routine")).toBeInTheDocument();
    expect(screen.getByText(/31% done/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'See the report' }));
    expect(setNav).toHaveBeenCalledWith('report');
  });

  it('is absent without a routine', () => {
    participation.data = { ...base, routine: { has_routine: false } };
    renderDash();
    expect(screen.queryByText("Today's routine")).not.toBeInTheDocument();
  });
});
