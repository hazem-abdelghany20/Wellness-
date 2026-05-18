import { describe, expect, it } from 'vitest';
import { normalizeAction } from '../home.jsx';

describe('normalizeAction', () => {
  it('maps server daily-plan actions into visible home-card fields', () => {
    const action = normalizeAction({
      id: 'content-123',
      type: 'content',
      title_en: 'Sleep onset — a cue for tonight',
      title_ar: 'بداية النوم — إشارة لهذه الليلة',
      duration_mins: 6,
      content_id: '123',
    });

    expect(action).toMatchObject({
      id: 'content-123',
      type: 'content',
      content_id: '123',
      kind: 'Content',
      minutes: 6,
      label: {
        en: 'Sleep onset — a cue for tonight',
        ar: 'بداية النوم — إشارة لهذه الليلة',
      },
    });
  });

  it('keeps check-in and breathe actions actionable with sensible defaults', () => {
    expect(normalizeAction({ id: 'daily-checkin', type: 'checkin' })).toMatchObject({
      icon: 'smile',
      kind: 'Check-in',
      minutes: 1,
      label: { en: 'Daily check-in', ar: 'التسجيل اليومي' },
    });

    expect(normalizeAction({ id: 'box-breath', type: 'breathe', duration_mins: 4 })).toMatchObject({
      icon: 'wind',
      kind: 'Reset',
      minutes: 4,
    });
  });
});
