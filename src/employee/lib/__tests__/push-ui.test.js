import { describe, it, expect } from 'vitest';
import {
  reminderView, unsupportedText, deniedHelp, pushErrorText, parseOpenLink, withoutOpenParams, fmtDuration,
} from '../push-ui.js';

const st = (state, reason = null, extra = {}) => ({
  state, permission: 'default', endpoint: null,
  support: { supported: state !== 'unsupported', reason, ios: false, standalone: false }, ...extra,
});

describe('reminderView', () => {
  it('maps every push state to what the switch shows', () => {
    expect(reminderView(null, false)).toBe('loading');
    expect(reminderView(st('unsupported', 'no_push_manager'), false)).toBe('unsupported');
    expect(reminderView(st('unsupported', 'ios_needs_install'), false)).toBe('install');
    expect(reminderView(st('denied'), true)).toBe('denied');
    expect(reminderView(st('prompt'), false)).toBe('off');
    expect(reminderView(st('unsubscribed'), true)).toBe('off');
    // Subscribed for HR messages but routine reminders switched off.
    expect(reminderView(st('subscribed'), false)).toBe('off');
    expect(reminderView(st('subscribed'), true)).toBe('on');
  });
});

describe('copy', () => {
  it('one plain line when the browser can’t, in both languages', () => {
    expect(unsupportedText('no_push_manager', 'en')).toMatch(/This browser can’t show reminders/);
    expect(unsupportedText('native_app', 'en')).toMatch(/coming to this app soon/);
    expect(unsupportedText('no_push_manager', 'ar')).toMatch(/المتصفح ده/);
  });
  it('how to allow again: iPhone settings path vs the site settings', () => {
    expect(deniedHelp(true, 'en')).toMatch(/Settings → Notifications → Wellness\+/);
    expect(deniedHelp(false, 'en')).toMatch(/lock or settings icon/);
    // Arabic keeps "Wellness+" inside left-to-right isolates.
    expect(deniedHelp(true, 'ar')).toContain('⁦Wellness+⁩');
  });
  it('error codes from push.ts', () => {
    expect(pushErrorText({ code: 'push_denied' }, 'en')).toMatch(/blocked/);
    expect(pushErrorText({ code: 'push_dismissed' }, 'en')).toMatch(/choose Allow/);
    expect(pushErrorText({ code: 'push_unsupported', reason: 'ios_needs_install' }, 'en')).toMatch(/Home Screen/);
    expect(pushErrorText({ code: 'push_no_key' }, 'en')).toMatch(/aren’t ready yet/);
    expect(pushErrorText(new Error('Failed to fetch'), 'en')).toMatch(/Check your connection/);
    expect(pushErrorText({ code: 'push_denied' }, 'ar')).toMatch(/الإشعارات مقفولة/);
  });
});

describe('parseOpenLink', () => {
  it('reads the reminder and broadcast links the service worker opens', () => {
    expect(parseOpenLink('/?open=today&item=8f2c-1')).toEqual({ open: 'today', item: '8f2c-1' });
    expect(parseOpenLink('https://app.test/?open=notifs&broadcast=b_9')).toEqual({ open: 'notifs', broadcast: 'b_9' });
    expect(parseOpenLink('?open=today')).toEqual({ open: 'today', item: null });
    expect(parseOpenLink('?open=notifs')).toEqual({ open: 'notifs', broadcast: null });
  });
  it('ignores anything else', () => {
    expect(parseOpenLink('/')).toBeNull();
    expect(parseOpenLink('/?open=admin')).toBeNull();
    expect(parseOpenLink('')).toBeNull();
    expect(parseOpenLink(null)).toBeNull();
    expect(parseOpenLink('/?open=today&item=<script>')).toEqual({ open: 'today', item: null });
  });
});

describe('withoutOpenParams', () => {
  it('drops open / item / broadcast and keeps the rest', () => {
    expect(withoutOpenParams('https://app.test/?open=today&item=i2')).toBe('/');
    expect(withoutOpenParams('https://app.test/?tweaks=1&open=notifs&broadcast=b1#ar')).toBe('/?tweaks=1#ar');
    expect(withoutOpenParams('https://app.test/?tweaks=1')).toBeNull();
  });
});

describe('fmtDuration', () => {
  it('m:ss, h:mm:ss, Arabic digits, unknown', () => {
    expect(fmtDuration(75, 'en')).toBe('1:15');
    expect(fmtDuration(5, 'en')).toBe('0:05');
    expect(fmtDuration(3725, 'en')).toBe('1:02:05');
    expect(fmtDuration(75, 'ar')).toBe('١:١٥');
    expect(fmtDuration(null, 'en')).toBe('–:––');
    expect(fmtDuration(NaN, 'en')).toBe('–:––');
  });
});
