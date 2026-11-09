import { describe, it, expect } from 'vitest';
import {
  zonedToUtcIso, utcToZoned, inQuietHours, quietShift, previewDelivery, fmtCompanyDateTime, fmtDuration,
  deliveryLine, reachLine, groupBroadcasts, minutesOf, broadcastErrorCopy,
} from '../broadcast-schedule.js';

describe('company time ⇄ instant', () => {
  it('turns a Cairo wall time into UTC and back', () => {
    // Cairo is UTC+2 in November.
    expect(zonedToUtcIso('2026-11-10', '09:30', 'Africa/Cairo')).toBe('2026-11-10T07:30:00.000Z');
    expect(utcToZoned('2026-11-10T07:30:00.000Z', 'Africa/Cairo')).toEqual({ date: '2026-11-10', time: '09:30' });
    // Riyadh UTC+3, across midnight.
    expect(zonedToUtcIso('2026-11-11', '01:00', 'Asia/Riyadh')).toBe('2026-11-10T22:00:00.000Z');
    expect(utcToZoned('2026-11-10T22:00:00Z', 'Asia/Riyadh')).toEqual({ date: '2026-11-11', time: '01:00' });
  });

  it('handles daylight saving (London summer) and bad input', () => {
    expect(zonedToUtcIso('2026-07-01', '08:00', 'Europe/London')).toBe('2026-07-01T07:00:00.000Z');
    expect(zonedToUtcIso('', '08:00', 'UTC')).toBe(null);
    expect(zonedToUtcIso('2026-07-01', '25:00', 'UTC')).toBe(null);
    expect(utcToZoned('nope', 'UTC')).toBe(null);
    expect(minutesOf('08:30')).toBe(510);
  });
});

describe('quiet hours', () => {
  const window = { from: '20:00', to: '08:00' };
  it('knows the night window, wrapping midnight', () => {
    expect(inQuietHours('21:00', window)).toBe(true);
    expect(inQuietHours('20:00', window)).toBe(true);
    expect(inQuietHours('07:59', window)).toBe(true);
    expect(inQuietHours('08:00', window)).toBe(false);
    expect(inQuietHours('12:00', window)).toBe(false);
  });

  it('moves an evening message to the next morning and an early one to the same morning', () => {
    expect(quietShift('2026-11-10', '21:00', { quiet: true, window })).toEqual({ date: '2026-11-11', time: '08:00', moved: true });
    expect(quietShift('2026-11-10', '06:30', { quiet: true, window })).toEqual({ date: '2026-11-10', time: '08:00', moved: true });
    expect(quietShift('2026-11-10', '10:00', { quiet: true, window })).toEqual({ date: '2026-11-10', time: '10:00', moved: false });
    expect(quietShift('2026-11-10', '21:00', { quiet: false, window })).toEqual({ date: '2026-11-10', time: '21:00', moved: false });
  });

  it('previews what the composer says before saving', () => {
    const now = { date: '2026-11-10', time: '14:00' };
    const later = previewDelivery({ mode: 'later', date: '2026-11-10', time: '21:00' }, { now, tz: 'Africa/Cairo', quiet: true, window });
    expect(later).toMatchObject({ sendNow: false, past: false, moved: true, date: '2026-11-11', time: '08:00', iso: '2026-11-10T19:00:00.000Z' });

    const ok = previewDelivery({ mode: 'later', date: '2026-11-12', time: '09:00' }, { now, tz: 'Africa/Cairo' });
    expect(ok).toMatchObject({ sendNow: false, moved: false, date: '2026-11-12', time: '09:00' });

    const past = previewDelivery({ mode: 'later', date: '2026-11-10', time: '09:00' }, { now, tz: 'Africa/Cairo' });
    expect(past).toMatchObject({ sendNow: true, past: true, date: '2026-11-10', time: '14:00', iso: null });

    const nowAtNight = previewDelivery({ mode: 'now' }, { now: { date: '2026-11-10', time: '22:15' }, tz: 'Africa/Cairo', quiet: true });
    expect(nowAtNight).toMatchObject({ sendNow: true, moved: true, date: '2026-11-11', time: '08:00' });
    expect(previewDelivery({ mode: 'now' }, { now: { date: '2026-11-10', time: '22:15' }, quiet: false }).moved).toBe(false);
  });
});

describe('list lines', () => {
  const tz = 'Africa/Cairo';
  it('formats dates, times and durations in both languages', () => {
    expect(fmtCompanyDateTime('2026-11-11', '08:00', 'en')).toBe('Wed 11 Nov, 08:00');
    expect(fmtCompanyDateTime('2026-11-11', '08:00', 'ar')).toMatch(/٠٨:٠٠$/);
    expect(fmtDuration(65)).toBe('1:05');
    expect(fmtDuration(9)).toBe('0:09');
    expect(fmtDuration(null)).toBe('');
  });

  it('says when a scheduled one arrives, and flags quiet hours', () => {
    const quiet = { status: 'scheduled', scheduled_at: '2026-11-10T19:00:00Z', deliver_at: '2026-11-11T06:00:00Z' };
    expect(deliveryLine(quiet, tz, 'en')).toEqual({ text: 'Will arrive Wed 11 Nov, 08:00 — quiet hours', quiet: true });
    expect(deliveryLine(quiet, tz, 'ar').text).toMatch(/ساعات الهدوء$/);
    const plain = { status: 'scheduled', scheduled_at: '2026-11-11T08:00:00Z', deliver_at: '2026-11-11T08:00:00Z' };
    expect(deliveryLine(plain, tz, 'en')).toEqual({ text: 'Will arrive Wed 11 Nov, 10:00', quiet: false });
    expect(deliveryLine({ status: 'sent', sent_at: '2026-11-09T07:12:00Z', scheduled_at: '2026-11-09T07:00:00Z' }, tz, 'en').text).toBe('Sent Mon 9 Nov, 09:12');
    expect(deliveryLine({ status: 'cancelled', scheduled_at: '2026-11-09T07:00:00Z' }, tz, 'en').text).toBe('Cancelled · was set for Mon 9 Nov, 09:00');
  });

  it('counts people and push results for sent ones only', () => {
    expect(reachLine({ status: 'sent', recipients: 42, push_sent: 38, push_failed: 2 }, 'en')).toBe('42 people · push: 38 sent, 2 failed');
    expect(reachLine({ status: 'sent', recipients: 1, push_sent: 0, push_failed: 0 }, 'en')).toBe('1 person · push: 0 sent');
    expect(reachLine({ status: 'sent', recipients: 3, push_sent: 3, push_failed: 0 }, 'ar')).toBe('٣ شخص · إشعارات: ٣ وصلت');
    expect(reachLine({ status: 'scheduled' }, 'en')).toBe('');
  });

  it('groups scheduled (soonest first), sent and cancelled (newest first)', () => {
    const g = groupBroadcasts([
      { id: 'a', status: 'scheduled', deliver_at: '2026-11-12T08:00:00Z' },
      { id: 'b', status: 'scheduled', deliver_at: '2026-11-11T08:00:00Z' },
      { id: 'c', status: 'sent', sent_at: '2026-11-01T08:00:00Z' },
      { id: 'd', status: 'sent', sent_at: '2026-11-05T08:00:00Z' },
      { id: 'e', status: 'cancelled', updated_at: '2026-11-02T08:00:00Z' },
    ]);
    expect(g.scheduled.map((b) => b.id)).toEqual(['b', 'a']);
    expect(g.sent.map((b) => b.id)).toEqual(['d', 'c']);
    expect(g.cancelled.map((b) => b.id)).toEqual(['e']);
    expect(groupBroadcasts(null)).toEqual({ scheduled: [], sent: [], cancelled: [] });
  });
});

describe('broadcast errors', () => {
  it('has copy for the sprint 3 codes in both languages', () => {
    expect(broadcastErrorCopy('body_required', 'en')).toBe('Write the message, or add a voice message.');
    expect(broadcastErrorCopy('broadcast_already_sent', 'ar')).toBe('الرسالة دي اتبعتت خلاص.');
    expect(broadcastErrorCopy('bad_scheduled_at', 'en')).toBe('Pick a valid date and time.');
    expect(broadcastErrorCopy('whatever', 'en')).toBe(null);
  });
});
