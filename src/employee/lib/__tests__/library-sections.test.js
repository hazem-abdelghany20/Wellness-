import { describe, it, expect } from 'vitest';
import { splitLibrary, scopeOf, isFact } from '../library-sections.js';

const row = (id, extra = {}) => ({ id, kind: 'article', title_en: id, published: true, status: 'published', hidden: false, pinned: false, scope: 'public', company_id: null, ...extra });

describe('splitLibrary', () => {
  it('splits company and Wellness House items, pinned first, server order otherwise', () => {
    const rows = [
      row('c1', { scope: 'company', company_id: 'co' }),
      row('c2', { scope: 'company', company_id: 'co', pinned: true }),
      row('p1'), row('p2'), row('p3', { pinned: true }),
    ];
    const out = splitLibrary(rows);
    expect(out.company.map((r) => r.id)).toEqual(['c2', 'c1']);
    expect(out.public.map((r) => r.id)).toEqual(['p3', 'p1', 'p2']);
  });

  it('never shows hidden, draft or archived items', () => {
    const out = splitLibrary([
      row('ok'), row('hid', { hidden: true }), row('dr', { status: 'draft', published: false, scope: 'company', company_id: 'co' }),
      row('ar', { status: 'archived' }), row('unpub', { published: false }),
    ]);
    expect([...out.company, ...out.public].map((r) => r.id)).toEqual(['ok']);
  });

  it('reads the scope from company_id when the row has none', () => {
    expect(scopeOf({ company_id: 'co' })).toBe('company');
    expect(scopeOf({ company_id: null })).toBe('public');
    expect(isFact({ kind: 'fact' })).toBe(true);
    expect(splitLibrary(null)).toEqual({ company: [], public: [] });
  });
});
