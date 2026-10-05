import { describe, it, expect } from 'vitest';
import { toPlayerItem } from '../content-item.js';

describe('toPlayerItem', () => {
  it('turns a content_items row into the reader shape (with body)', () => {
    const item = toPlayerItem({
      id: 'a1', kind: 'article', duration_mins: 4,
      title_en: 'The Busy Trap', title_ar: 'فخ الأجندة المزدحمة',
      body_en: 'Quick Takeaway…', body_ar: 'في اختصار شديد…',
    });
    expect(item).toEqual({
      id: 'a1', kind: 'article', mins: 4,
      title: { en: 'The Busy Trap', ar: 'فخ الأجندة المزدحمة' },
      body: { en: 'Quick Takeaway…', ar: 'في اختصار شديد…' },
    });
  });

  it('passes an already-normalized item through unchanged', () => {
    const ready = { id: 'x', kind: 'article', mins: 3, title: { en: 'A', ar: 'ا' }, body: { en: 'b', ar: 'ب' } };
    expect(toPlayerItem(ready)).toBe(ready);
  });

  it('falls back to English when Arabic is missing', () => {
    const item = toPlayerItem({ id: 'y', title_en: 'Only EN', body_en: 'text' });
    expect(item.title.ar).toBe('Only EN');
    expect(item.body.ar).toBe('text');
  });
});
