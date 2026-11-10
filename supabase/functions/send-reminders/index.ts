// send-reminders — Web Push for routine reminders and HR broadcasts.
//
// Called every minute by the pg_cron job "wellness-minute-tick" (see
// supabase/migrations/20261111000001_reminders_broadcasts_teams.sql) with
// header x-cron-secret = CRON_SECRET. Deploy with --no-verify-jwt (the
// request carries no Supabase JWT; the secret is the authorisation).
//
// Env (function secrets): CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// (base64url, as scripts/generate-vapid-keys.mjs prints them),
// VAPID_SUBJECT ('mailto:…' or 'https://…'). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// POST body (all optional): { at: ISO time (default now), dry_run: true =
// pick nothing, send nothing, show what is due; window_minutes: 1–15,
// default 3 — how far back a late tick still catches a reminder }.
//
// 1. due_routine_reminders(at) — claims the reminders due at this
//    company-local minute; due_broadcast_pushes(at) — claims the broadcasts
//    the SQL job just delivered in-app.
// 2. Sends one encrypted Web Push per device (fresh ECDH key per message).
// 3. record_push_results() — healthy devices reset, 404/410 deleted, other
//    failures counted (deleted after 5 in a row).
import * as webpush from 'jsr:@negrel/webpush@0.5.0';
import { createServiceClient } from '../_shared/supabase-client.ts';
import {
  buildBroadcastPayload, buildReminderPayload, isGoneStatus, mapPool, pickLang, safeEqual, vapidKeysToJwk,
  type BroadcastRow, type PushPayload, type PushTarget, type ReminderRow,
} from './payload.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Job {
  kind: 'reminder' | 'broadcast';
  target: PushTarget;
  payload: PushPayload;
  ttl: number;
  urgency: webpush.Urgency;
  meta: Record<string, string>;
}

interface Result {
  subscription_id: string;
  ok: boolean;
  status: number | null;
  error: string | null;
  kind: string;
  [k: string]: unknown;
}

let vapidCache: { pub: string; priv: string; keys: CryptoKeyPair } | null = null;

async function vapidKeys(pub: string, priv: string): Promise<CryptoKeyPair> {
  if (vapidCache && vapidCache.pub === pub && vapidCache.priv === priv) return vapidCache.keys;
  const keys = await webpush.importVapidKeys(vapidKeysToJwk(pub, priv), { extractable: false });
  // The pair must match, or every push service answers 401/403.
  const probe = new TextEncoder().encode('wellness-vapid-check');
  const algo = { name: 'ECDSA', hash: 'SHA-256' };
  const sig = await crypto.subtle.sign(algo, keys.privateKey, probe);
  if (!(await crypto.subtle.verify(algo, keys.publicKey, sig, probe))) throw new Error('bad_vapid_keys');
  vapidCache = { pub, priv, keys };
  return keys;
}

async function sendOne(job: Job, subject: string, keys: CryptoKeyPair): Promise<Result> {
  const base = { subscription_id: job.target.id, kind: job.kind, ...job.meta };
  try {
    // A new application server per message = a fresh ECDH key per message.
    const server = await webpush.ApplicationServer.new({ contactInformation: subject, vapidKeys: keys });
    const subscriber = server.subscribe({
      endpoint: job.target.endpoint,
      keys: { p256dh: job.target.p256dh, auth: job.target.auth },
    });
    await Promise.race([
      subscriber.pushTextMessage(JSON.stringify(job.payload), { ttl: job.ttl, urgency: job.urgency }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
    ]);
    return { ...base, ok: true, status: 201, error: null };
  } catch (e) {
    if (e instanceof webpush.PushMessageError) {
      let text = '';
      try { text = (await e.response.text()).slice(0, 200); } catch { /* body already used */ }
      return { ...base, ok: false, status: e.response.status, error: text || e.response.statusText || 'push_failed' };
    }
    return { ...base, ok: false, status: null, error: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  if (!cronSecret) return json({ error: 'not_configured', missing: ['CRON_SECRET'] }, 503);
  if (!safeEqual(req.headers.get('x-cron-secret') ?? '', cronSecret)) return json({ error: 'unauthorized' }, 401);

  const env = {
    VAPID_PUBLIC_KEY: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
    VAPID_PRIVATE_KEY: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    VAPID_SUBJECT: Deno.env.get('VAPID_SUBJECT') ?? '',
  };
  const missing = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) return json({ error: 'not_configured', missing }, 503);
  if (!/^(mailto:|https:\/\/)/.test(env.VAPID_SUBJECT)) return json({ error: 'not_configured', bad: ['VAPID_SUBJECT'] }, 503);

  let body: { at?: string; dry_run?: boolean; window_minutes?: number } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const at = body.at && !Number.isNaN(Date.parse(body.at)) ? new Date(body.at) : new Date();
  const dryRun = body.dry_run === true;
  const windowMinutes = Number.isInteger(body.window_minutes) ? Math.min(15, Math.max(1, body.window_minutes!)) : 3;

  let keys: CryptoKeyPair;
  try {
    keys = await vapidKeys(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  } catch {
    return json({ error: 'not_configured', bad: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] }, 503);
  }

  const db = createServiceClient();
  const [rem, bc] = await Promise.all([
    db.rpc('due_routine_reminders', { p_at: at.toISOString(), p_window_minutes: windowMinutes, p_claim: !dryRun }),
    db.rpc('due_broadcast_pushes', { p_at: at.toISOString(), p_claim: !dryRun }),
  ]);
  if (rem.error || bc.error) {
    console.error('send-reminders: selection failed', rem.error?.message, bc.error?.message);
    return json({ error: 'selection_failed', reminders: rem.error?.message ?? null, broadcasts: bc.error?.message ?? null }, 500);
  }
  const reminders = (rem.data ?? []) as ReminderRow[];
  const broadcasts = (bc.data ?? []) as BroadcastRow[];

  const jobs: Job[] = [];
  for (const r of reminders) {
    for (const t of r.subscriptions ?? []) {
      jobs.push({
        kind: 'reminder', target: t, payload: buildReminderPayload(r, pickLang(t.lang)),
        ttl: 30 * 60, urgency: webpush.Urgency.High,
        meta: { user_id: r.user_id, item_id: r.item_id, day: r.day },
      });
    }
  }
  for (const b of broadcasts) {
    for (const t of b.subscriptions ?? []) {
      jobs.push({
        kind: 'broadcast', target: t, payload: buildBroadcastPayload(b, pickLang(t.lang)),
        ttl: 24 * 60 * 60, urgency: webpush.Urgency.Normal,
        meta: { user_id: b.user_id, broadcast_id: b.broadcast_id },
      });
    }
  }

  if (dryRun) {
    return json({
      ok: true, dry_run: true, at: at.toISOString(),
      reminders: reminders.length, broadcasts: broadcasts.length, devices: jobs.length,
      preview: jobs.slice(0, 20).map((j) => ({ kind: j.kind, ...j.payload })),
    });
  }

  const results = await mapPool(jobs, 8, (j) => sendOne(j, env.VAPID_SUBJECT, keys));
  let recorded: unknown = null;
  if (results.length) {
    const { data, error } = await db.rpc('record_push_results', { p_results: results });
    if (error) console.error('send-reminders: record_push_results failed', error.message);
    recorded = data ?? null;
  }

  const count = (kind: string, pred: (r: Result) => boolean) =>
    results.filter((r) => r.kind === kind && pred(r)).length;
  const summary = {
    ok: true,
    at: at.toISOString(),
    reminders: {
      due: reminders.length,
      sent: count('reminder', (r) => r.ok),
      failed: count('reminder', (r) => !r.ok),
      gone: count('reminder', (r) => isGoneStatus(r.status)),
    },
    broadcasts: {
      due: new Set(broadcasts.map((b) => b.broadcast_id)).size,
      people: broadcasts.length,
      sent: count('broadcast', (r) => r.ok),
      failed: count('broadcast', (r) => !r.ok),
      gone: count('broadcast', (r) => isGoneStatus(r.status)),
    },
    recorded,
  };
  if (jobs.length) console.log('send-reminders', JSON.stringify(summary));
  return json(summary);
});
