import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Public rows are read straight from the tables (library_list needs a company).
const tables = vi.hoisted(() => ({ exercises: [], routines: [] }));
const calls = vi.hoisted(() => []);
vi.mock('../../../lib/supabase', () => {
  const query = (table) => {
    const q = {
      select: (cols) => { calls.push([table, 'select', cols]); return q; },
      is: (col, v) => { calls.push([table, 'is', col, v]); return q; },
      order: async () => ({ data: tables[table], error: null }),
    };
    return q;
  };
  return {
    supabase: {
      from: (t) => query(t),
      auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) },
      storage: { from: () => ({ remove: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) }) },
    },
    resolveMyCompanyId: async () => null,
  };
});
const lib = vi.hoisted(() => ({ saveExercise: vi.fn(), saveRoutine: vi.fn(), setLibraryStatus: vi.fn(), getRoutineDetail: vi.fn() }));
vi.mock('../../../lib/supabase-routines', async (orig) => ({ ...(await orig()), ...lib }));

import { AdminPublicExercisesView } from '../public-exercises.jsx';
import { AdminPublicRoutinesView } from '../public-routines.jsx';
import { HR_THEMES } from '../../../shared/tokens.jsx';

const T = HR_THEMES.dark;

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  tables.exercises = [{ id: 'ex-1', company_id: null, status: 'published', name_en: 'Neck release', body_areas: ['neck'], default_sets_reps: '2 × 10' }];
  tables.routines = [{ id: 'r-1', company_id: null, status: 'published', title_en: 'Starter stretch', workdays: [0, 1, 2, 3, 4], day_titles: {}, routine_items: [{ count: 6 }] }];
  lib.saveExercise.mockImplementation(async (input) => ({ id: 'ex-new', company_id: null, status: 'published', ...input }));
  lib.saveRoutine.mockImplementation(async (input) => ({ routine: { id: 'r-new', ...input }, items: [], assignments: null }));
  lib.setLibraryStatus.mockResolvedValue({});
});

describe('Admin public exercise library', () => {
  it('lists public exercises and saves new ones as public', async () => {
    render(<AdminPublicExercisesView theme={T} density="comfortable" lang="en"/>);
    expect(await screen.findByText('Neck release')).toBeInTheDocument();
    expect(calls).toContainEqual(['exercises', 'is', 'company_id', null]);
    expect(screen.queryByRole('tab', { name: /Wellness House/ })).not.toBeInTheDocument(); // no HR tabs here
    fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    expect(screen.getByText('Public: every company can use it in their routines.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name (English)'), { target: { value: 'Wall push-ups' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add exercise' }).at(-1));
    await waitFor(() => expect(lib.saveExercise).toHaveBeenCalledWith(expect.objectContaining({ name_en: 'Wall push-ups', public: true })));
  });

  it('archives a public exercise', async () => {
    render(<AdminPublicExercisesView theme={T} density="comfortable" lang="en"/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, archive' }));
    await waitFor(() => expect(lib.setLibraryStatus).toHaveBeenCalledWith('exercise', 'ex-1', 'archived'));
  });
});

describe('Admin public routine library', () => {
  it('lists public routines with their row count and builds a public routine from public exercises', async () => {
    render(<AdminPublicRoutinesView theme={T} density="comfortable" lang="en"/>);
    expect(await screen.findByText('Starter stretch')).toBeInTheDocument();
    expect(screen.getByText('6 rows · Sun–Thu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New routine' }));
    const select = await screen.findByLabelText('Exercise 1');
    expect([...select.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Wellness House']);
    fireEvent.change(screen.getByLabelText('Routine name (English)'), { target: { value: 'Office starter' } });
    fireEvent.change(select, { target: { value: 'ex-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save routine' }));
    await waitFor(() => expect(lib.saveRoutine).toHaveBeenCalledTimes(1));
    expect(lib.saveRoutine.mock.calls[0][0]).toMatchObject({ public: true, title_en: 'Office starter', items: [expect.objectContaining({ exercise_id: 'ex-1' })] });
    expect(await screen.findByText('Routine published. Every company can use it now.')).toBeInTheDocument();
  });

  it('quick-adds a public exercise from the builder', async () => {
    render(<AdminPublicRoutinesView theme={T} density="comfortable" lang="ar"/>);
    fireEvent.click(await screen.findByRole('button', { name: 'روتين جديد' }));
    fireEvent.change(await screen.findByLabelText('التمرين 1'), { target: { value: '__new' } });
    fireEvent.change(screen.getByLabelText('اسم التمرين الجديد'), { target: { value: 'Ankle circles' } });
    fireEvent.click(screen.getByRole('button', { name: 'ضيفه واستخدمه' }));
    await waitFor(() => expect(lib.saveExercise).toHaveBeenCalledWith(expect.objectContaining({ name_en: 'Ankle circles', public: true })));
  });
});
