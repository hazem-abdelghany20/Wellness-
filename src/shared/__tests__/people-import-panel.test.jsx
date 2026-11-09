import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HR_THEMES } from '../tokens.jsx';
import { PeopleImportPanel } from '../people-import-panel.jsx';

vi.mock('../../lib/supabase-invites', () => ({
  importPeople: vi.fn(),
  listPeopleInvites: vi.fn(),
}));
vi.mock('../sheet-io.js', async (orig) => ({
  ...(await orig()),
  downloadInviteSheet: vi.fn(),
  downloadTemplate: vi.fn(),
}));

import { importPeople, listPeopleInvites } from '../../lib/supabase-invites';
import { downloadInviteSheet } from '../sheet-io.js';

const T = HR_THEMES.dark;
const csv = [
  'name,email,team,role',
  'يوسف نجيب,yusuf@acme.com,العمليات,مدير',
  'Amira Hassan,amira@acme.com,sales,',
  'Dup,AMIRA@acme.com,Sales,employee',
  'Bad,not-an-email,Sales,employee',
  'Boss,boss@acme.com,Sales,ceo',
  'No Team,noteam@acme.com,,employee',
  'Nadia HR,nadia@acme.com,,hr_admin',
].join('\n');

function upload(text, name = 'people.csv', type = 'text/csv') {
  const file = new File([new TextEncoder().encode(text)], name, { type });
  fireEvent.change(screen.getByTestId('people-file'), { target: { files: [file] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  importPeople.mockResolvedValue({ invited: 3, new_invites: 3, already_invited: 0, updated: 0, teams_created: 1, new_teams: ['العمليات'], skipped: [] });
  listPeopleInvites.mockResolvedValue([{ name: 'x', email: 'x@acme.com', team: 'Sales', role: 'employee', token: 'tok', status: 'pending' }]);
});

describe('PeopleImportPanel', () => {
  it('previews counts, new teams and problem rows, then imports only the good rows', async () => {
    const onImported = vi.fn();
    render(<PeopleImportPanel theme={T} lang="en" density="comfortable" companyId="c1" companyName="Acme"
      existingTeams={[{ id: 't1', name: 'Sales' }]} onImported={onImported}/>);
    upload(csv);

    expect(await screen.findByText('Ready to import')).toBeInTheDocument();
    const problems = screen.getByRole('table');
    expect(within(problems).getByText('Same email appears earlier in the file')).toBeInTheDocument();
    expect(within(problems).getByText('Not a valid email')).toBeInTheDocument();
    expect(within(problems).getByText(/Unknown role/)).toHaveTextContent('“ceo”');
    expect(within(problems).getByText('Team is missing')).toBeInTheDocument();
    expect(screen.getByText('العمليات')).toBeInTheDocument(); // the one new team

    fireEvent.click(screen.getByRole('button', { name: 'Import 3 people' }));
    await waitFor(() => expect(importPeople).toHaveBeenCalled());
    expect(importPeople.mock.calls[0][0]).toBe('c1');
    expect(importPeople.mock.calls[0][1]).toEqual([
      { row: 2, name: 'يوسف نجيب', email: 'yusuf@acme.com', team: 'العمليات', role: 'manager' },
      { row: 3, name: 'Amira Hassan', email: 'amira@acme.com', team: 'sales', role: 'employee' },
      { row: 8, name: 'Nadia HR', email: 'nadia@acme.com', team: '', role: 'hr_admin' },
    ]);
    expect(onImported).toHaveBeenCalled();

    // After the import the summary offers the invite sheet (header button + summary button).
    expect(await screen.findByText('Teams created')).toBeInTheDocument();
    const sheetButtons = screen.getAllByRole('button', { name: 'Download invite sheet' });
    expect(sheetButtons).toHaveLength(2);
    fireEvent.click(sheetButtons[1]);
    await waitFor(() => expect(downloadInviteSheet).toHaveBeenCalled());
    expect(listPeopleInvites).toHaveBeenCalledWith('c1');
    expect(downloadInviteSheet.mock.calls[0][1]).toMatchObject({ lang: 'en', companyName: 'Acme' });
  });

  it('asks for an email column when the sheet has none', async () => {
    render(<PeopleImportPanel theme={T} lang="ar" density="comfortable" companyId="c1"/>);
    upload('name,team\nLina,Ops');
    expect(await screen.findByRole('alert')).toHaveTextContent('البريد الإلكتروني');
    expect(importPeople).not.toHaveBeenCalled();
  });

  it('rejects old .xls files with a hint', async () => {
    render(<PeopleImportPanel theme={T} lang="en" density="comfortable" companyId="c1"/>);
    upload('x', 'people.xls', 'application/vnd.ms-excel');
    expect(await screen.findByRole('alert')).toHaveTextContent('.xlsx or .csv');
  });
});
