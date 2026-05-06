import { describe, it, expect } from 'vitest';
import { prayerTimes, CAIRO, solarParams } from '../sun-times.js';

function asMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

describe('sun-times', () => {
  it('returns sensible Cairo times for a summer solstice (longer day)', () => {
    const date = new Date(Date.UTC(2024, 5, 20)); // 2024-06-20
    const t = prayerTimes(date, CAIRO);
    expect(t).toBeTruthy();
    const sunrise = asMinutes(t.sunrise);
    const sunset  = asMinutes(t.sunset);
    const dayLen  = sunset - sunrise;
    // Cairo summer solstice: ~14h day. Allow ±60 min tolerance.
    expect(dayLen).toBeGreaterThan(13 * 60);
    expect(dayLen).toBeLessThan(15 * 60);
    // fajr is before sunrise.
    expect(asMinutes(t.fajr)).toBeLessThan(sunrise);
    // iftar equals sunset.
    expect(t.iftar).toBe(t.sunset);
  });

  it('returns sensible Cairo times for winter solstice (shorter day)', () => {
    const date = new Date(Date.UTC(2024, 11, 21)); // 2024-12-21
    const t = prayerTimes(date, CAIRO);
    const sunrise = asMinutes(t.sunrise);
    const sunset  = asMinutes(t.sunset);
    const dayLen  = sunset - sunrise;
    // Cairo winter solstice: ~10h day.
    expect(dayLen).toBeGreaterThan(9 * 60);
    expect(dayLen).toBeLessThan(11 * 60);
  });

  it('suhoor equals fajr by definition', () => {
    const date = new Date(Date.UTC(2026, 2, 1));
    const t = prayerTimes(date, CAIRO);
    expect(t.suhoor).toBe(t.fajr);
  });

  it('produces HH:MM format with leading zeros', () => {
    const date = new Date(Date.UTC(2025, 0, 1));
    const t = prayerTimes(date, CAIRO);
    expect(t.fajr).toMatch(/^\d{2}:\d{2}$/);
    expect(t.sunrise).toMatch(/^\d{2}:\d{2}$/);
    expect(t.sunset).toMatch(/^\d{2}:\d{2}$/);
  });

  it('solarParams declination flips sign across the equinoxes', () => {
    const summer = solarParams(2460481.5); // mid-June 2024
    const winter = solarParams(2460665.5); // mid-Dec 2024
    expect(summer.declination).toBeGreaterThan(0);
    expect(winter.declination).toBeLessThan(0);
  });
});
