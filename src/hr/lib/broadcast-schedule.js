// Broadcast scheduling in company time, quiet hours and the lines the
// broadcast list shows. Pure functions (no React, no Supabase).
//
// HR picks a date + time in the company's time zone (Settings → Time zone).
// The backend stores an ISO instant; with quiet hours on (the default) a
// broadcast due between 20:00 and 08:00 company time waits until 08:00 —
// the saved row's deliver_at says when it will really go.

export const DEFAULT_QUIET_WINDOW = { from: '20:00', to: '08:00' };

const pad = (n) => String(n).padStart(2, '0');

// 'HH:MM' → minutes since midnight, or null.
export function minutesOf(hhmm) {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function partsIn(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'UTC', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const out = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year), month: Number(out.month), day: Number(out.day),
    hour: Number(out.hour) % 24, minute: Number(out.minute), second: Number(out.second),
  };
}

// Offset of a time zone at an instant, in minutes (Cairo in winter → 120).
export function tzOffsetMinutes(date, tz) {
  const p = partsIn(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

// A wall-clock date + time in a time zone → ISO instant (UTC).
// zonedToUtcIso('2026-11-10', '09:30', 'Africa/Cairo') → '2026-11-10T07:30:00.000Z'.
export function zonedToUtcIso(dateIso, hhmm, tz) {
  const d = String(dateIso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const mins = minutesOf(hhmm);
  if (!d || mins == null) return null;
  const guess = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Math.floor(mins / 60), mins % 60);
  let ts = guess - tzOffsetMinutes(new Date(guess), tz) * 60000;
  // Daylight-saving edge: the offset at the result may differ from the guess.
  const again = guess - tzOffsetMinutes(new Date(ts), tz) * 60000;
  if (again !== ts) ts = again;
  return new Date(ts).toISOString();
}

// An ISO instant → { date: 'YYYY-MM-DD', time: 'HH:MM' } in a time zone.
export function utcToZoned(iso, tz) {
  const t = iso ? new Date(iso) : null;
  if (!t || Number.isNaN(t.getTime())) return null;
  const p = partsIn(t, tz);
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

const addDay = (dateIso, n) => {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Is a company-time 'HH:MM' inside quiet hours? The window wraps midnight
// ({from: '20:00', to: '08:00'}): 20:00 … 23:59 and 00:00 … 07:59 are quiet.
export function inQuietHours(hhmm, window = DEFAULT_QUIET_WINDOW) {
  const t = minutesOf(hhmm);
  const from = minutesOf(window?.from ?? DEFAULT_QUIET_WINDOW.from);
  const to = minutesOf(window?.to ?? DEFAULT_QUIET_WINDOW.to);
  if (t == null || from == null || to == null || from === to) return false;
  return from > to ? (t >= from || t < to) : (t >= from && t < to);
}

// When a broadcast set for (date, time) company time really arrives.
// → { date, time, moved } — moved = held back by quiet hours.
export function quietShift(dateIso, hhmm, { quiet = true, window = DEFAULT_QUIET_WINDOW } = {}) {
  if (!quiet || !inQuietHours(hhmm, window)) return { date: dateIso, time: hhmm, moved: false };
  const t = minutesOf(hhmm);
  const from = minutesOf(window?.from ?? DEFAULT_QUIET_WINDOW.from);
  const to = window?.to ?? DEFAULT_QUIET_WINDOW.to;
  // After the evening start the message waits for the next morning.
  const nextDay = from > minutesOf(to) && t >= from;
  return { date: nextDay ? addDay(dateIso, 1) : dateIso, time: to, moved: true };
}

// What the composer says before saving.
//   when: { mode: 'now' } | { mode: 'later', date, time }
//   now:  { date, time } company time (from my_company_settings().now)
// → { sendNow, past, date, time, moved, iso }
//   sendNow: goes as soon as it is saved (or at the end of quiet hours);
//   past: a time that has already gone (treated as now by the backend).
export function previewDelivery(when, { now, tz, quiet = true, window = DEFAULT_QUIET_WINDOW } = {}) {
  const nowDate = now?.date;
  const nowTime = now?.time;
  const later = when?.mode === 'later' && when.date && minutesOf(when.time) != null;
  let date = later ? when.date : nowDate;
  let time = later ? String(when.time).slice(0, 5) : nowTime;
  const past = !!(later && nowDate && nowTime && (date < nowDate || (date === nowDate && minutesOf(time) <= minutesOf(nowTime))));
  if (past) { date = nowDate; time = nowTime; }
  const sendNow = !later || past;
  const shifted = date && time ? quietShift(date, time, { quiet, window }) : { date, time, moved: false };
  return {
    sendNow, past, moved: shifted.moved, date: shifted.date, time: shifted.time,
    iso: later && !past && tz ? zonedToUtcIso(when.date, when.time, tz) : null,
  };
}

// '2026-11-10' + '08:00' → 'Tue 10 Nov, 08:00' (en) / 'الثلاثاء ١٠ نوفمبر، ٠٨:٠٠' (ar).
export function fmtCompanyDateTime(dateIso, hhmm, lang) {
  if (!dateIso) return '';
  const d = new Date(`${String(dateIso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(dateIso);
  const day = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(d);
  if (!hhmm) return day;
  const time = lang === 'ar' ? String(hhmm).replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[Number(c)]) : hhmm;
  return lang === 'ar' ? `${day}، ${time}` : `${day}, ${time}`;
}

// An ISO instant shown in company time.
export function fmtInstant(iso, tz, lang) {
  const z = utcToZoned(iso, tz);
  return z ? fmtCompanyDateTime(z.date, z.time, lang) : '';
}

// Seconds → 'm:ss' ('0:45', '2:05'); '' when unknown.
export function fmtDuration(seconds) {
  if (seconds == null || seconds === '') return '';
  const s = Math.round(Number(seconds));
  if (!Number.isFinite(s) || s < 0) return '';
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

// The time line of a broadcast in the list.
// → { text, quiet } (quiet: deliver_at was moved by quiet hours).
export function deliveryLine(b, tz, lang) {
  const ar = lang === 'ar';
  const when = (iso) => fmtInstant(iso, tz, lang);
  if (!b) return { text: '', quiet: false };
  if (b.status === 'sent') {
    const at = b.sent_at || b.deliver_at || b.scheduled_at;
    return { text: ar ? `اتبعتت ${when(at)}` : `Sent ${when(at)}`, quiet: false };
  }
  if (b.status === 'cancelled') {
    return { text: ar ? `اتلغت · كانت لـ ${when(b.scheduled_at)}` : `Cancelled · was set for ${when(b.scheduled_at)}`, quiet: false };
  }
  const deliver = b.deliver_at || b.scheduled_at;
  const quiet = !!(b.deliver_at && b.scheduled_at
    && Math.abs(new Date(b.deliver_at).getTime() - new Date(b.scheduled_at).getTime()) >= 60000);
  const text = ar ? `هتوصل ${when(deliver)}` : `Will arrive ${when(deliver)}`;
  return { text: quiet ? (ar ? `${text} · ساعات الهدوء` : `${text} — quiet hours`) : text, quiet };
}

// Counts line for a sent broadcast: '42 people · push: 38 sent, 2 failed'.
export function reachLine(b, lang) {
  if (!b || b.status !== 'sent') return '';
  const n = (v) => (lang === 'ar' ? new Intl.NumberFormat('ar-EG').format(v ?? 0) : String(v ?? 0));
  const people = b.recipients ?? 0;
  const sent = b.push_sent ?? 0;
  const failed = b.push_failed ?? 0;
  if (lang === 'ar') {
    return `${n(people)} شخص · إشعارات: ${n(sent)} وصلت${failed ? `، ${n(failed)} موصلتش` : ''}`;
  }
  return `${people} ${people === 1 ? 'person' : 'people'} · push: ${sent} sent${failed ? `, ${failed} failed` : ''}`;
}

// Group the list for the page: scheduled (soonest first), sent and cancelled (newest first).
export function groupBroadcasts(list) {
  const rows = Array.isArray(list) ? list : [];
  const t = (b, k) => new Date(b[k] || b.scheduled_at || b.created_at || 0).getTime();
  return {
    scheduled: rows.filter((b) => b.status === 'scheduled').sort((a, b) => t(a, 'deliver_at') - t(b, 'deliver_at')),
    sent: rows.filter((b) => b.status === 'sent').sort((a, b) => t(b, 'sent_at') - t(a, 'sent_at')),
    cancelled: rows.filter((b) => b.status === 'cancelled').sort((a, b) => t(b, 'updated_at') - t(a, 'updated_at')),
  };
}

// Broadcast save / cancel errors (sprint 3 codes) in the UI language.
const BROADCAST_ERRORS = {
  title_required: ['Add the title in English.', 'اكتب العنوان بالإنجليزي.'],
  title_too_long: ['Keep the title under 160 characters.', 'خلي العنوان أقل من ١٦٠ حرف.'],
  body_too_long: ['Keep the message under 2,000 characters.', 'خلي الرسالة أقل من ٢٠٠٠ حرف.'],
  body_required: ['Write the message, or add a voice message.', 'اكتب الرسالة، أو ضيف رسالة صوتية.'],
  bad_scope: ['Pick everyone or one team.', 'اختار الكل أو فريق واحد.'],
  team_not_found: ['That team no longer exists. Pick another.', 'الفريق ده مبقاش موجود. اختار غيره.'],
  bad_scheduled_at: ['Pick a valid date and time.', 'اختار يوم وساعة صح.'],
  bad_media_mime: ['Use an audio file: MP3 or M4A (also WEBM or OGG).', 'استخدم ملف صوت: MP3 أو M4A (أو WEBM أو OGG).'],
  bad_media_duration: ['That audio file can’t be read. Try MP3 or M4A.', 'ملف الصوت ده مش بيتقري. جرّب MP3 أو M4A.'],
  bad_media_bucket: ['Upload the audio again.', 'ارفع الصوت تاني.'],
  media_path_outside_company: ['Upload the audio again.', 'ارفع الصوت تاني.'],
  broadcast_not_found: ['That message no longer exists. Reload the page.', 'الرسالة دي مبقتش موجودة. حدّث الصفحة.'],
  broadcast_not_editable: ['That message has already gone out or was cancelled.', 'الرسالة دي اتبعتت أو اتلغت خلاص.'],
  broadcast_already_sent: ['That message has already gone out.', 'الرسالة دي اتبعتت خلاص.'],
};
export function broadcastErrorCopy(code, lang) {
  const m = BROADCAST_ERRORS[code];
  return m ? (lang === 'ar' ? m[1] : m[0]) : null;
}
