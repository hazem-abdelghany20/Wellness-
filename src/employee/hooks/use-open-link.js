import { useState, useEffect, useCallback, useRef } from 'react';
import { parseOpenLink, withoutOpenParams } from '../lib/push-ui.js';

// "Open from a notification". A tap on a push opens the app at
// /?open=today&item=<id> or /?open=notifs&broadcast=<id> (public/sw.js), or
// — when the app is already open — posts { type: 'OPEN_URL', url } to it.
// Returns [link, clear]: link = { open, item | broadcast, n } until cleared.
// The open / item / broadcast params are taken off the address bar at once.
//
// onSubscriptionChanged: the worker saw the push subscription rotate
// ({ type: 'PUSH_SUBSCRIPTION_CHANGED' }); the app should re-save it.
let seq = 0;

function cleanAddressBar() {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const next = withoutOpenParams(window.location.href);
  if (next != null) {
    try { window.history.replaceState(window.history.state, '', next); } catch { /* sandboxed */ }
  }
}

function fromLocation() {
  if (typeof window === 'undefined') return null;
  const l = parseOpenLink(window.location.search);
  return l ? { ...l, n: ++seq } : null;
}

export function useOpenLink({ onSubscriptionChanged } = {}) {
  const [link, setLink] = useState(fromLocation);
  const onSub = useRef(onSubscriptionChanged);
  onSub.current = onSubscriptionChanged;

  useEffect(() => { cleanAddressBar(); }, []);

  useEffect(() => {
    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null;
    if (!sw?.addEventListener) return undefined;
    const onMessage = (e) => {
      const d = e?.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'OPEN_URL') {
        const l = parseOpenLink(String(d.url || ''));
        if (l) setLink({ ...l, n: ++seq });
        cleanAddressBar();
      } else if (d.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        onSub.current?.();
      }
    };
    sw.addEventListener('message', onMessage);
    return () => sw.removeEventListener('message', onMessage);
  }, []);

  const clear = useCallback(() => setLink(null), []);
  return [link, clear];
}
