#!/usr/bin/env node
// Prints a new VAPID key pair for Web Push (no dependencies).
//   node scripts/generate-vapid-keys.mjs
// Public key  → VITE_VAPID_PUBLIC_KEY (frontend build) and the
//               send-reminders function secret VAPID_PUBLIC_KEY.
// Private key → function secret VAPID_PRIVATE_KEY only. Never commit it.
// Changing the pair later means every browser has to subscribe again.
import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = privateKey.export({ format: 'jwk' });
const b64 = (s) => Buffer.from(s, 'base64url');
const publicRaw = Buffer.concat([Buffer.from([4]), b64(jwk.x), b64(jwk.y)]).toString('base64url');
const privateRaw = b64(jwk.d).toString('base64url');

console.log(`VITE_VAPID_PUBLIC_KEY=${publicRaw}`);
console.log(`VAPID_PUBLIC_KEY=${publicRaw}`);
console.log(`VAPID_PRIVATE_KEY=${privateRaw}`);
