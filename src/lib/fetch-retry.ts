// Retry requests that die on the network before any response arrives.
//
// Why: WebKit (the iOS app's web view, and Safari) talks to Supabase over
// HTTP/3 once Cloudflare advertises it. Some networks break HTTP/3 after the
// handshake, so the request is lost and fetch rejects with
// TypeError("Load failed") — iOS NSURLError -1005. Seen 2026-11-15 on a Cairo
// Wi-Fi: every HTTP/3 request failed, HTTP/2 worked, and WebKit only fell back
// to HTTP/2 after a few failures. Without a retry, sign-in just says
// "Load failed" and screens never load.
//
// Only requests that are safe to send twice are retried, because a request
// lost this way may still have reached the server:
//   - reads: GET / HEAD, and the read-only RPCs below
//   - sign-in and token refresh (POST /auth/v1/token)
// Writes (inserts, updates, write RPCs, sign-up) are never retried.

const DEFAULT_DELAYS_MS = [300, 800, 1600];

// Read-only RPCs (PostgREST calls every RPC with POST).
const READ_ONLY_RPC =
  /^(my_[a-z_]+|get_[a-z_]+|hr_list_[a-z_]+|hr_routine_(report|people|assignments)|library_list|routine_detail|recognition_board|broadcast_media)$/;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input === 'object' && 'method' in input && input.method) return input.method.toUpperCase();
  return 'GET';
}

export function isRetryableRequest(url: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD') return true;
  if (m !== 'POST') return false;
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return false;
  }
  if (path.endsWith('/auth/v1/token')) return true;
  const rpc = path.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)$/i);
  return !!rpc && READ_ONLY_RPC.test(rpc[1]);
}

// fetch() rejects with a TypeError only when no HTTP response came back
// ("Load failed" in WebKit, "Failed to fetch" in Chrome). HTTP errors resolve.
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createFetchWithRetry(
  baseFetch: FetchLike = (input, init) => fetch(input, init),
  delaysMs: number[] = DEFAULT_DELAYS_MS,
  sleep: (ms: number) => Promise<void> = wait,
): FetchLike {
  return async function fetchWithRetry(input, init) {
    const retryable =
      isRetryableRequest(urlOf(input), methodOf(input, init)) &&
      // A Request object's body can only be read once.
      !(typeof Request !== 'undefined' && input instanceof Request && input.body);

    for (let attempt = 0; ; attempt++) {
      try {
        return await baseFetch(input, init);
      } catch (err) {
        const aborted = init?.signal?.aborted;
        if (!retryable || aborted || !isNetworkError(err) || attempt >= delaysMs.length) throw err;
        await sleep(delaysMs[attempt]);
      }
    }
  };
}
