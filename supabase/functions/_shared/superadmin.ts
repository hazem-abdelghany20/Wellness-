// Mirrors src/lib/superadmin.ts on the edge side. Emails listed here are
// treated as company_admin for role checks regardless of what the JWT says.
export const SUPERADMIN_EMAILS: ReadonlyArray<string> = [
  'hazemabdelghany43@gmail.com',
  'hazemabdelghany@gmail.com',
];

const normalized = new Set(SUPERADMIN_EMAILS.map((e) => e.toLowerCase().trim()));

export function isSuperadminEmail(email?: string | null): boolean {
  if (!email) return false;
  return normalized.has(email.toLowerCase().trim());
}
