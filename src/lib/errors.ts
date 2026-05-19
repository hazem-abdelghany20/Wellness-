// Friendly error messages for backend failures the user might see in a toast
// or inline status line. Strips PostgREST internals (table names, policy
// names, SQLSTATE codes) and maps known patterns to human copy.

export interface FriendlyError {
  message: string;
  // The original error string, retained so the dev console / Sentry still
  // carries the full context even though the UI shows the friendly text.
  raw: string;
}

export function friendlyError(err: unknown): FriendlyError {
  const raw = err instanceof Error
    ? (err.message || err.toString())
    : typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message)
        : JSON.stringify(err);

  // RLS denial (raised either by PostgREST policy enforcement or RAISE EXCEPTION ERRCODE=42501).
  if (/row-level security policy/i.test(raw) || /42501/.test(raw) || /not_authorized/i.test(raw)) {
    return { message: "You don't have permission to do that.", raw };
  }

  if (/not_in_company/i.test(raw)) {
    return { message: 'Your account isn’t linked to a workspace yet.', raw };
  }

  if (/Edge Function returned a non-2xx/i.test(raw) || /FunctionsHttpError/i.test(raw)) {
    return { message: 'Something went wrong on the server. Please try again.', raw };
  }

  if (/duplicate key|conflict/i.test(raw)) {
    return { message: 'That already exists — try a different value.', raw };
  }

  if (/foreign key constraint/i.test(raw)) {
    return { message: 'That referenced item doesn’t exist yet — schedule it first, then try again.', raw };
  }

  if (/Failed to fetch|NetworkError|ECONNREFUSED/i.test(raw)) {
    return { message: 'Network problem — check your connection and try again.', raw };
  }

  // Default: trim PostgREST detail prefixes like `column "x" does not exist`.
  const cleaned = raw
    .replace(/^.*?: /, '')
    .replace(/\((?:SQLSTATE )?\d+\)/g, '')
    .trim();

  return { message: cleaned || 'Something went wrong.', raw };
}

// Bilingual variant used by HR/admin views.
export function friendlyErrorI18n(err: unknown, lang: 'en' | 'ar'): string {
  const { message } = friendlyError(err);
  if (lang !== 'ar') return message;
  const map: Record<string, string> = {
    "You don't have permission to do that.": 'ليست لديك صلاحية لتنفيذ هذا.',
    'Your account isn’t linked to a workspace yet.': 'حسابك غير مرتبط بمساحة عمل بعد.',
    'Something went wrong on the server. Please try again.': 'حدث خطأ في الخادم. حاول مرة أخرى.',
    'That already exists — try a different value.': 'موجود مسبقًا — جرّب قيمة مختلفة.',
    'That referenced item doesn’t exist yet — schedule it first, then try again.': 'العنصر المرتبط غير موجود بعد — قم بجدولته أولاً ثم حاول مرة أخرى.',
    'Network problem — check your connection and try again.': 'مشكلة في الشبكة — تحقق من الاتصال.',
    'Something went wrong.': 'حدث خطأ ما.',
  };
  return map[message] || message;
}
