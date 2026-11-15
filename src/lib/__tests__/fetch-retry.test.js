import { describe, it, expect, vi } from 'vitest';
import { createFetchWithRetry, isRetryableRequest } from '../fetch-retry.ts';

const BASE = 'https://proj.supabase.co';
const ok = () => new Response('{}', { status: 200 });
const lost = () => new TypeError('Load failed');
const noSleep = () => Promise.resolve();

function flaky(failures) {
  let n = 0;
  return vi.fn(async () => {
    if (n++ < failures) throw lost();
    return ok();
  });
}

describe('isRetryableRequest', () => {
  it('retries reads', () => {
    expect(isRetryableRequest(`${BASE}/rest/v1/content?select=*`, 'GET')).toBe(true);
    expect(isRetryableRequest(`${BASE}/rest/v1/content`, 'HEAD')).toBe(true);
  });

  it('retries sign-in and token refresh', () => {
    expect(isRetryableRequest(`${BASE}/auth/v1/token?grant_type=password`, 'POST')).toBe(true);
    expect(isRetryableRequest(`${BASE}/auth/v1/token?grant_type=refresh_token`, 'POST')).toBe(true);
  });

  it('retries read-only RPCs only', () => {
    for (const fn of ['my_today', 'my_scorecard', 'get_my_checkin_history', 'library_list', 'hr_list_broadcasts', 'hr_routine_report']) {
      expect(isRetryableRequest(`${BASE}/rest/v1/rpc/${fn}`, 'POST')).toBe(true);
    }
    for (const fn of ['set_my_prefs', 'log_habit', 'claim_my_reward', 'check_routine_item', 'save_routine', 'hr_save_broadcast']) {
      expect(isRetryableRequest(`${BASE}/rest/v1/rpc/${fn}`, 'POST')).toBe(false);
    }
  });

  it('never retries writes or sign-up', () => {
    expect(isRetryableRequest(`${BASE}/rest/v1/checkins`, 'POST')).toBe(false);
    expect(isRetryableRequest(`${BASE}/rest/v1/checkins?id=eq.1`, 'PATCH')).toBe(false);
    expect(isRetryableRequest(`${BASE}/rest/v1/checkins?id=eq.1`, 'DELETE')).toBe(false);
    expect(isRetryableRequest(`${BASE}/auth/v1/signup`, 'POST')).toBe(false);
  });
});

describe('createFetchWithRetry', () => {
  it('gets through after the network drops a sign-in twice', async () => {
    const base = flaky(2);
    const f = createFetchWithRetry(base, [1, 1, 1], noSleep);
    const res = await f(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', body: '{}' });
    expect(res.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last delay and rethrows the network error', async () => {
    const base = flaky(10);
    const f = createFetchWithRetry(base, [1, 1], noSleep);
    await expect(f(`${BASE}/rest/v1/content`)).rejects.toThrow('Load failed');
    expect(base).toHaveBeenCalledTimes(3);
  });

  it('does not resend a write that may have reached the server', async () => {
    const base = flaky(1);
    const f = createFetchWithRetry(base, [1, 1], noSleep);
    await expect(f(`${BASE}/rest/v1/rpc/log_habit`, { method: 'POST', body: '{}' })).rejects.toThrow('Load failed');
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('passes HTTP errors straight through', async () => {
    const base = vi.fn(async () => new Response('{}', { status: 400 }));
    const f = createFetchWithRetry(base, [1, 1], noSleep);
    const res = await f(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST' });
    expect(res.status).toBe(400);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('stops when the caller aborts', async () => {
    const ctrl = new AbortController();
    const base = vi.fn(async () => {
      ctrl.abort();
      throw lost();
    });
    const f = createFetchWithRetry(base, [1, 1], noSleep);
    await expect(f(`${BASE}/rest/v1/content`, { signal: ctrl.signal })).rejects.toThrow('Load failed');
    expect(base).toHaveBeenCalledTimes(1);
  });
});
