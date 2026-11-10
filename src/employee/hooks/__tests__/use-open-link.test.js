import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOpenLink } from '../use-open-link.js';

// A stand-in for navigator.serviceWorker: just the message events.
let sw;
beforeEach(() => {
  sw = new EventTarget();
  Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
});
afterEach(() => {
  delete navigator.serviceWorker;
  window.history.replaceState(null, '', '/');
});
const post = (data) => act(() => { sw.dispatchEvent(new MessageEvent('message', { data })); });

describe('useOpenLink', () => {
  it('reads a reminder link on load and cleans the address bar', () => {
    window.history.replaceState(null, '', '/?open=today&item=i2&tweaks=1');
    const { result } = renderHook(() => useOpenLink());
    expect(result.current[0]).toMatchObject({ open: 'today', item: 'i2' });
    expect(window.location.search).toBe('?tweaks=1');
    act(() => result.current[1]());
    expect(result.current[0]).toBeNull();
  });

  it('reads a broadcast link on load', () => {
    window.history.replaceState(null, '', '/?open=notifs&broadcast=b7');
    const { result } = renderHook(() => useOpenLink());
    expect(result.current[0]).toMatchObject({ open: 'notifs', broadcast: 'b7' });
    expect(window.location.search).toBe('');
  });

  it('nothing to open on a plain start', () => {
    const { result } = renderHook(() => useOpenLink());
    expect(result.current[0]).toBeNull();
  });

  it('follows OPEN_URL from the service worker while the app is open', () => {
    const { result } = renderHook(() => useOpenLink());
    post({ type: 'OPEN_URL', url: 'https://app.test/?open=notifs&broadcast=b1' });
    expect(result.current[0]).toMatchObject({ open: 'notifs', broadcast: 'b1' });
    const first = result.current[0].n;
    // The same notification tapped again still counts as a new request.
    post({ type: 'OPEN_URL', url: 'https://app.test/?open=notifs&broadcast=b1' });
    expect(result.current[0].n).toBeGreaterThan(first);
    post({ type: 'OPEN_URL', url: '/?open=today&item=i9' });
    expect(result.current[0]).toMatchObject({ open: 'today', item: 'i9' });
    post({ type: 'SOMETHING_ELSE' });
    expect(result.current[0]).toMatchObject({ open: 'today', item: 'i9' });
  });

  it('PUSH_SUBSCRIPTION_CHANGED asks the app to save the subscription again', () => {
    const onSubscriptionChanged = vi.fn();
    renderHook(() => useOpenLink({ onSubscriptionChanged }));
    post({ type: 'PUSH_SUBSCRIPTION_CHANGED' });
    expect(onSubscriptionChanged).toHaveBeenCalledTimes(1);
  });

  it('stops listening when unmounted', () => {
    const onSubscriptionChanged = vi.fn();
    const { unmount } = renderHook(() => useOpenLink({ onSubscriptionChanged }));
    unmount();
    post({ type: 'PUSH_SUBSCRIPTION_CHANGED' });
    expect(onSubscriptionChanged).not.toHaveBeenCalled();
  });
});
