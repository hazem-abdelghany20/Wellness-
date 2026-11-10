// Sprint 3: small pure helpers for the employee app's reminders, the
// "open from a notification" links and the broadcast audio player.
// The device / server work lives in src/lib/push.ts and supabase-broadcasts.ts.

const AR_DIGITS = new Intl.NumberFormat('ar-EG', { useGrouping: false });
const arNum = (s) => String(s).replace(/\d+/g, (d) => AR_DIGITS.format(Number(d)).padStart(d.length, AR_DIGITS.format(0)));

// What the reminders switch should show, from getPushState() and my
// routine_reminders pref:
//   loading · unsupported · install (iPhone Safari tab) · denied · off · on
export function reminderView(push, remindersOn) {
  if (!push) return 'loading';
  if (push.state === 'unsupported') {
    return push.support?.reason === 'ios_needs_install' ? 'install' : 'unsupported';
  }
  if (push.state === 'denied') return 'denied';
  if (push.state === 'subscribed' && remindersOn) return 'on';
  return 'off';
}

// One plain line for a browser that can't get reminders at all.
export function unsupportedText(reason, lang) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  if (reason === 'native_app') return s('Reminders are coming to this app soon.', 'التذكيرات جاية للتطبيق ده قريب.');
  if (reason === 'no_vapid_key') return s('Reminders aren’t ready yet. Check again later.', 'التذكيرات لسه مش جاهزة. شوفها تاني بعدين.');
  return s('This browser can’t show reminders. Try Chrome, or Safari on iPhone.', 'المتصفح ده مش بيعرض تذكيرات. جرّب كروم، أو سفاري على الآيفون.');
}

// How to allow notifications again after "Block" (only settings can undo it).
export function deniedHelp(ios, lang) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  return ios
    ? s('Notifications are off for Wellness+. To allow them: iPhone Settings → Notifications → Wellness+ → Allow Notifications. Then come back here.',
        'الإشعارات مقفولة لـ ⁦Wellness+⁩. علشان تسمح بيها: الإعدادات في الآيفون ← الإشعارات ← ⁦Wellness+⁩ ← السماح بالإشعارات. وبعدين ارجع هنا.')
    : s('Notifications are blocked for this site. To allow them: tap the lock or settings icon next to the address → Notifications → Allow. Then come back here.',
        'الإشعارات مقفولة للموقع ده. علشان تسمح بيها: دوس على القفل أو الإعدادات جنب العنوان ← الإشعارات ← سماح. وبعدين ارجع هنا.');
}

// Friendly text for an error thrown by enable / disableRoutineReminders.
export function pushErrorText(err, lang) {
  const s = (en, ar) => (lang === 'ar' ? ar : en);
  const code = String(err?.code || err?.message || '');
  if (/push_denied/.test(code)) {
    return s('Notifications are blocked. Allow them in your settings, then try again.', 'الإشعارات مقفولة. اسمح بيها من الإعدادات وجرّب تاني.');
  }
  if (/push_dismissed/.test(code)) {
    return s('No answer yet. Tap again and choose Allow.', 'لسه ما اخترتش. دوس تاني واختار سماح.');
  }
  if (/push_unsupported/.test(code)) {
    return err?.reason === 'ios_needs_install'
      ? s('Add Wellness+ to your Home Screen first, then switch reminders on there.', 'حط ⁦Wellness+⁩ على الشاشة الرئيسية الأول، وشغّل التذكيرات من هناك.')
      : unsupportedText(err?.reason, lang);
  }
  if (/push_no_key|push_no_service_worker/.test(code)) {
    return unsupportedText('no_vapid_key', lang);
  }
  return s('Could not change reminders. Check your connection and try again.', 'مقدرناش نغيّر التذكيرات. اتأكد من النت وجرّب تاني.');
}

// ── open from a notification ──────────────────────────────────

const OPEN_KEYS = ['open', 'item', 'broadcast'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// '/?open=today&item=<id>' → { open: 'today', item }
// '/?open=notifs&broadcast=<id>' → { open: 'notifs', broadcast }
// Anything else → null. Accepts a full URL, a path or a bare '?query'.
export function parseOpenLink(url) {
  if (!url || typeof url !== 'string') return null;
  let params;
  try {
    params = new URL(url, 'https://app.invalid').searchParams;
  } catch {
    return null;
  }
  const open = params.get('open');
  const id = (k) => {
    const v = params.get(k);
    return v && ID_RE.test(v) ? v : null;
  };
  if (open === 'today') return { open: 'today', item: id('item') };
  if (open === 'notifs') return { open: 'notifs', broadcast: id('broadcast') };
  return null;
}

// The same URL without the open / item / broadcast params (others and the
// hash stay). Returns null when there was nothing to remove.
export function withoutOpenParams(href) {
  let u;
  try { u = new URL(href); } catch { return null; }
  if (!OPEN_KEYS.some((k) => u.searchParams.has(k))) return null;
  OPEN_KEYS.forEach((k) => u.searchParams.delete(k));
  const q = u.searchParams.toString();
  return `${u.pathname}${q ? `?${q}` : ''}${u.hash}`;
}

// ── audio ─────────────────────────────────────────────────────

// 75 → '1:15' (EN) or '١:١٥' (AR). Unknown → '–:––'.
export function fmtDuration(seconds, lang) {
  const n = seconds == null || seconds === '' ? NaN : Number(seconds);
  if (!Number.isFinite(n) || n < 0) return '–:––';
  const total = Math.floor(n);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  const out = h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  return lang === 'ar' ? arNum(out) : out;
}
