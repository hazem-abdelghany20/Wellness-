import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({ supabase: {}, resolveMyCompanyId: vi.fn() }));
vi.mock('../../../lib/supabase-routines', async (orig) => ({
  ...(await orig()),
  getRecognitionBoard: vi.fn(),
  setMyPrefs: vi.fn(),
}));

import { getRecognitionBoard, setMyPrefs } from '../../../lib/supabase-routines';
import { THEMES } from '../../design-system.jsx';
import { RecognitionBoard, TopTodayStrip } from '../recognition-board.jsx';
import { makeBoard } from '../../test-fixtures/routine.js';

const T = THEMES.brand;
beforeEach(() => { vi.clearAllMocks(); try { sessionStorage.clear(); } catch { /* ignore */ } });

describe('RecognitionBoard (Score tab)', () => {
  it('shows nothing when the company has the board off', async () => {
    getRecognitionBoard.mockResolvedValue(makeBoard('off'));
    render(<RecognitionBoard theme={T} lang="en"/>);
    await waitFor(() => expect(getRecognitionBoard).toHaveBeenCalledWith('today'));
    expect(screen.queryByTestId('recognition-board')).toBeNull();
  });

  it('teams mode: teams only, never a person’s name, no opt-in invitation', async () => {
    getRecognitionBoard.mockResolvedValue(makeBoard('teams'));
    render(<RecognitionBoard theme={T} lang="en"/>);
    expect(await screen.findByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('75% active')).toBeInTheDocument();
    expect(screen.queryByText(/Amira/)).toBeNull();
    expect(screen.queryByText(/Lina/)).toBeNull();
    expect(screen.queryByRole('region', { name: /Show your name/ })).toBeNull();
    expect(screen.getByText(/You/)).toBeInTheDocument();
    expect(screen.getByText(/4 done today/)).toBeInTheDocument();
    expect(screen.getByText(/Teams only, no names/)).toBeInTheDocument();
  });

  it('named mode: opted-in names, "and N more", top and longest streak', async () => {
    getRecognitionBoard.mockResolvedValue(makeBoard('named'));
    render(<RecognitionBoard theme={T} lang="en"/>);
    expect(await screen.findByText('Did everything today')).toBeInTheDocument();
    expect(screen.getByText(/and 14 more/)).toBeInTheDocument();
    expect(screen.getAllByText('Amira Hassan').length).toBeGreaterThan(1);
    expect(screen.getByText('Lina Adel')).toBeInTheDocument();
    expect(screen.getByText('10 done')).toBeInTheDocument();
    expect(screen.getByText('5 days')).toBeInTheDocument();
    expect(screen.getByText('Your name is not on the board.')).toBeInTheDocument();
  });

  it('invites me to opt in and saves it on "Yes, show my name"', async () => {
    getRecognitionBoard.mockResolvedValueOnce(makeBoard('named'))
      .mockResolvedValue(makeBoard('named', { me: { opted_in: true, items_done: 4, streak: 2 } }));
    setMyPrefs.mockResolvedValue({ recognition_opt_in: true });
    render(<RecognitionBoard theme={T} lang="en"/>);
    const invite = await screen.findByRole('region', { name: 'Show your name on the company board?' });
    expect(invite).toHaveTextContent('never anything about your health');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, show my name' }));
    await waitFor(() => expect(setMyPrefs).toHaveBeenCalledWith({ recognition_opt_in: true }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Show your name on the company board?' })).toBeNull());
    expect(screen.getByText(/Your name can show on the board/)).toBeInTheDocument();
  });

  it('"Not now" hides the invitation without saving anything', async () => {
    getRecognitionBoard.mockResolvedValue(makeBoard('named'));
    render(<RecognitionBoard theme={T} lang="en"/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region', { name: 'Show your name on the company board?' })).toBeNull();
    expect(setMyPrefs).not.toHaveBeenCalled();
  });

  it('switches between today and this week', async () => {
    getRecognitionBoard.mockImplementation(async (p) => ({ ...makeBoard('teams'), period: p }));
    render(<RecognitionBoard theme={T} lang="en"/>);
    await screen.findByText('Finance');
    fireEvent.click(screen.getByRole('button', { name: 'This week' }));
    await waitFor(() => expect(getRecognitionBoard).toHaveBeenLastCalledWith('week'));
    expect(await screen.findByText(/4 done this week/)).toBeInTheDocument();
  });

  it('Arabic copy, right to left', async () => {
    getRecognitionBoard.mockResolvedValue(makeBoard('named'));
    render(<RecognitionBoard theme={T} lang="ar"/>);
    expect(await screen.findByText('لوحة الشركة')).toBeInTheDocument();
    expect(screen.getByText('عملوا كل حاجة النهارده')).toBeInTheDocument();
    expect(screen.getByText(/و١٤ كمان/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'أيوه، اظهر اسمي' })).toBeInTheDocument();
  });
});

describe('TopTodayStrip (Today tab)', () => {
  it('one line: top team, and how many did everything in named mode', async () => {
    getRecognitionBoard.mockResolvedValue(makeBoard('named'));
    render(<TopTodayStrip theme={T} lang="en" onSeeBoard={() => {}}/>);
    const line = await screen.findByTestId('top-today');
    expect(line).toHaveTextContent('Top team today: Finance · 15 people did everything today');
    expect(line).not.toHaveTextContent('Amira');
  });
  it('nothing when the board is off', async () => {
    getRecognitionBoard.mockResolvedValue(makeBoard('off'));
    const { container } = render(<TopTodayStrip theme={T} lang="en"/>);
    await waitFor(() => expect(getRecognitionBoard).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
