import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  supabase: {}, resolveMyCompanyId: vi.fn(),
  getContentItems: vi.fn(), getFeaturedContent: vi.fn(async () => []),
  saveContentProgress: vi.fn(), getContentProgress: vi.fn(), markArticleOpened: vi.fn(),
}));
vi.mock('../../../lib/supabase-routines', async (orig) => ({ ...(await orig()), listLibrary: vi.fn() }));

import { listLibrary } from '../../../lib/supabase-routines';
import { getContentItems } from '../../../lib/supabase';
import { THEMES } from '../../design-system.jsx';
import { ScreenLibrary } from '../content.jsx';

const t = (k) => (k === 'minutes' ? 'min' : k);
const row = (id, title, extra = {}) => ({
  id, slug: id, kind: 'article', category: 'stress', title_en: title, title_ar: `${title} (ع)`, body_en: null, body_ar: null,
  duration_mins: 4, published: true, status: 'published', featured: false, company_id: null,
  scope: 'public', hidden: false, pinned: false, pref_sort: null, can_edit: false, ...extra,
});
const rows = () => [
  row('c1', 'Our Ramadan hours', { scope: 'company', company_id: 'co' }),
  row('c2', 'Desk water rule', { scope: 'company', company_id: 'co', kind: 'fact', duration_mins: null,
    body_en: 'Keep a full bottle on your desk. Finish it by lunch.', body_ar: 'خلي قزازة مليانة على مكتبك.' }),
  row('c3', 'Pinned by HR', { scope: 'company', company_id: 'co', pinned: true }),
  row('p1', 'Sleep basics'),
  row('p2', 'Breathing at your desk', { pinned: true }),
  row('p3', 'Stress first aid'),
];
const go = vi.fn();

beforeEach(() => { vi.clearAllMocks(); });

describe('Library: company + Wellness House', () => {
  it('shows "From your company" first, then "From Wellness House", pinned first', async () => {
    listLibrary.mockResolvedValue(rows());
    render(<ScreenLibrary theme={THEMES.brand} t={t} dir="ltr" go={go}/>);
    const company = await screen.findByRole('region', { name: 'From your company' });
    const pub = screen.getByRole('region', { name: 'From Wellness House' });
    expect(listLibrary).toHaveBeenCalledWith('content', 'all');
    expect(company.compareDocumentPosition(pub) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The hero takes the first pinned item (company first); the rest keep their order.
    expect(screen.getByText('Pinned by HR')).toBeInTheDocument();
    expect(within(company).queryByText('Pinned by HR')).toBeNull();
    expect(within(company).getByText('Our Ramadan hours')).toBeInTheDocument();
    const pubTitles = within(pub).getAllByText(/Sleep basics|Breathing at your desk|Stress first aid/).map((n) => n.textContent);
    expect(pubTitles).toEqual(['Breathing at your desk', 'Sleep basics', 'Stress first aid']);
    expect(within(pub).getByText('Pinned')).toBeInTheDocument();
  });

  it('a fact is a short card with no read time', async () => {
    listLibrary.mockResolvedValue(rows());
    render(<ScreenLibrary theme={THEMES.brand} t={t} dir="ltr" go={go}/>);
    const company = await screen.findByRole('region', { name: 'From your company' });
    const fact = within(company).getByText('Desk water rule').closest('div[style]').parentElement;
    expect(within(fact).getByText('Fact')).toBeInTheDocument();
    expect(within(fact).getByText('Keep a full bottle on your desk. Finish it by lunch.')).toBeInTheDocument();
    expect(within(fact).queryByText(/min/)).toBeNull();
    // Articles still show their read time and open in the reader.
    fireEvent.click(within(company).getByText('Our Ramadan hours'));
    expect(go).toHaveBeenCalledWith('player', { item: expect.objectContaining({ id: 'c1', kind: 'article' }) });
  });

  it('never shows hidden or draft items', async () => {
    listLibrary.mockResolvedValue([
      ...rows(),
      row('d1', 'Draft post', { scope: 'company', company_id: 'co', status: 'draft', published: false }),
      row('h1', 'Hidden public item', { hidden: true }),
    ]);
    render(<ScreenLibrary theme={THEMES.brand} t={t} dir="ltr" go={go}/>);
    await screen.findByRole('region', { name: 'From your company' });
    expect(screen.queryByText('Draft post')).toBeNull();
    expect(screen.queryByText('Hidden public item')).toBeNull();
  });

  it('no company section when the company has no items', async () => {
    listLibrary.mockResolvedValue(rows().filter((r) => r.scope === 'public'));
    render(<ScreenLibrary theme={THEMES.brand} t={t} dir="ltr" go={go}/>);
    expect(await screen.findByRole('region', { name: 'From Wellness House' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'From your company' })).toBeNull();
  });

  it('falls back to the plain list if the library call is missing', async () => {
    listLibrary.mockRejectedValue(new Error('function library_list does not exist'));
    getContentItems.mockResolvedValue([row('p1', 'Sleep basics', { scope: undefined })]);
    render(<ScreenLibrary theme={THEMES.brand} t={t} dir="ltr" go={go}/>);
    const pub = await screen.findByRole('region', { name: 'From Wellness House' });
    expect(within(pub).getByText('Sleep basics')).toBeInTheDocument();
  });

  it('Arabic headings, right to left', async () => {
    listLibrary.mockResolvedValue(rows());
    render(<ScreenLibrary theme={THEMES.brand} t={t} dir="rtl" go={go}/>);
    expect(await screen.findByRole('region', { name: 'من شركتك' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'من Wellness House' })).toBeInTheDocument();
    expect(screen.getByTestId('screen-library')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByText('معلومة')).toBeInTheDocument();
  });
});
