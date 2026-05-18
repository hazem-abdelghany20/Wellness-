// Global-login allowlist. Emails listed here bypass per-portal role checks
// and the employee company-code step — letting one identity hop between
// the Admin, HR, and Employee portals without provisioning separate roles.
export const SUPERADMIN_EMAILS: ReadonlyArray<string> = [
  'hazemabdelghany43@gmail.com',
];

const normalized = new Set(SUPERADMIN_EMAILS.map((e) => e.toLowerCase().trim()));

export function isSuperadminEmail(email?: string | null): boolean {
  if (!email) return false;
  return normalized.has(email.toLowerCase().trim());
}
