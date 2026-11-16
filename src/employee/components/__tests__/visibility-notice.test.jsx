import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({ supabase: {}, resolveMyCompanyId: vi.fn() }));
vi.mock('../../../lib/supabase-routines', async (orig) => ({
  ...(await orig()),
  getMyPrefs: vi.fn(),
  setMyPrefs: vi.fn(),
}));

import { getMyPrefs, setMyPrefs } from '../../../lib/supabase-routines';
import { THEMES } from '../../design-system.jsx';
import { useVisibilityNotice, VisibilityNotice } from '../visibility-notice.jsx';

const T = THEMES.brand;
const prefs = (extra = {}, company = {}) => ({
  routine_reminders: false, muted_item_ids: [], recognition_opt_in: false, share_with_hr: false,
  visibility_notice_seen_at: null, consent_version: 'v1',
  company: { timezone: 'Africa/Cairo', recognition: 'named', hr_people_view: true, everyone_visible: true, ...company },
  ...extra,
});

let last;
function Harness({ lang = 'en', enabled = true }) {
  const notice = useVisibilityNotice(enabled);
  last = notice;
  return (
    <div style={{ position: 'relative' }}>
      <div data-testid="state">{notice.pending ? 'pending' : notice.open ? 'open' : 'closed'}</div>
      <VisibilityNotice theme={T} lang={lang} notice={notice}/>
    </div>
  );
}

beforeEach(() => { vi.clearAllMocks(); last = null; });

describe('one-time "your company shows everyone" notice', () => {
  it('shows once, with the plain message, and OK remembers it', async () => {
    getMyPrefs.mockResolvedValue(prefs());
    setMyPrefs.mockResolvedValue(prefs({ visibility_notice_seen_at: '2026-11-15T09:00:00Z' }));
    render(<Harness/>);
    expect(screen.getByTestId('state')).toHaveTextContent('pending');
    const sheet = await screen.findByRole('dialog', { name: 'Your company shows everyone' });
    expect(sheet).toHaveTextContent('Your name appears on the company board with what you did (ticks, full days, streaks), and HR sees your routine progress. Never anything about your health.');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(setMyPrefs).toHaveBeenCalledWith({ visibility_notice_seen: true });
    await waitFor(() => expect(last.open).toBe(false));
    expect(setMyPrefs).toHaveBeenCalledTimes(1);
  });

  it('closes anyway when saving fails (it shows again next time)', async () => {
    getMyPrefs.mockResolvedValue(prefs());
    setMyPrefs.mockRejectedValue(new Error('Failed to fetch'));
    render(<Harness/>);
    await screen.findByRole('dialog', { name: 'Your company shows everyone' });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('state')).toHaveTextContent('closed');
  });

  it('the close button counts as OK', async () => {
    getMyPrefs.mockResolvedValue(prefs());
    setMyPrefs.mockResolvedValue(prefs({ visibility_notice_seen_at: '2026-11-15T09:00:00Z' }));
    render(<Harness/>);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(setMyPrefs).toHaveBeenCalledWith({ visibility_notice_seen: true });
  });

  it('never shows when already seen, when the company keeps the opt-ins, or when prefs fail', async () => {
    getMyPrefs.mockResolvedValue(prefs({ visibility_notice_seen_at: '2026-11-14T09:00:00Z' }));
    const a = render(<Harness/>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('closed'));
    expect(screen.queryByRole('dialog')).toBeNull();
    a.unmount();

    getMyPrefs.mockResolvedValue(prefs({}, { everyone_visible: false }));
    const b = render(<Harness/>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('closed'));
    expect(screen.queryByRole('dialog')).toBeNull();
    b.unmount();

    getMyPrefs.mockRejectedValue(new Error('Failed to fetch'));
    render(<Harness/>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('closed'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(setMyPrefs).not.toHaveBeenCalled();
  });

  it('does not ask for prefs before sign-in', async () => {
    render(<Harness enabled={false}/>);
    await act(async () => {});
    expect(getMyPrefs).not.toHaveBeenCalled();
    expect(screen.getByTestId('state')).toHaveTextContent('closed');
  });

  it('Arabic', async () => {
    getMyPrefs.mockResolvedValue(prefs());
    render(<Harness lang="ar"/>);
    const sheet = await screen.findByRole('dialog', { name: 'شركتك بتعرض الكل' });
    expect(sheet).toHaveAttribute('dir', 'rtl');
    expect(sheet).toHaveTextContent('عمره ما هيظهر حاجة عن صحتك');
    expect(screen.getByRole('button', { name: 'تمام' })).toBeInTheDocument();
  });
});
