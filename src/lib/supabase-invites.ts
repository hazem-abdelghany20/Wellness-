import { supabase, signInOrUpWithPassword, verifyCompanyCode, signOut } from './supabase';

// Invites, people import and joining a company. SQL lives in
// supabase/migrations/20261109000001_onboarding_invites_import.sql.

export type InviteRole = 'employee' | 'manager' | 'hr_admin';

export interface ImportRow {
  row?: number;
  name?: string;
  email: string;
  team?: string;
  role?: InviteRole | string;
}

export interface ImportSummary {
  invited: number;
  new_invites: number;
  already_invited: number;
  updated: number;
  // members listed as hr_admin: promoted when they open their link
  hr_admin_links: number;
  teams_created: number;
  new_teams: string[];
  skipped: Array<{ row: number; email: string | null; reason: string }>;
}

export interface PeopleInvite {
  name: string | null;
  email: string;
  team: string | null;
  role: InviteRole;
  token: string;
  status: 'joined' | 'pending' | 'expired';
  source: 'import' | 'admin_invite';
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export interface Placement {
  placed: boolean | null;
  via?: 'existing' | 'invite_token' | 'invite_email' | 'company_code';
  company_id?: string;
  role?: string;
  // true when the database doesn't have join_company_for_me yet (migration
  // not applied): callers fall back to the old behaviour.
  unavailable?: boolean;
}

export async function importPeople(companyId: string, rows: ImportRow[]): Promise<ImportSummary> {
  if (!companyId) throw new Error('no_company');
  const payload = rows.map((r) => ({
    row: r.row ?? null,
    name: r.name ?? '',
    email: r.email,
    team: r.team ?? '',
    role: r.role || 'employee',
  }));
  const { data, error } = await supabase.rpc('import_people', {
    p_company_id: companyId,
    p_rows: payload,
  });
  if (error) throw error;
  return data as ImportSummary;
}

export async function listPeopleInvites(companyId: string): Promise<PeopleInvite[]> {
  if (!companyId) throw new Error('no_company');
  const { data, error } = await supabase.rpc('list_people_invites', { p_company_id: companyId });
  if (error) throw error;
  return (data ?? []) as PeopleInvite[];
}

function isMissingFunction(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883'
    || /could not find the function/i.test(error.message || '');
}

export async function joinCompanyForMe(
  opts: { code?: string | null; inviteToken?: string | null } = {},
): Promise<Placement> {
  const { data, error } = await supabase.rpc('join_company_for_me', {
    p_company_code: opts.code ? String(opts.code).trim().toUpperCase() : null,
    p_invite_token: opts.inviteToken ? String(opts.inviteToken).trim() : null,
  });
  if (error) {
    if (isMissingFunction(error)) return { placed: null, unavailable: true };
    throw error;
  }
  return (data ?? { placed: false }) as Placement;
}

export class NotInvitedError extends Error {
  code = 'no_invite';
  constructor(public email: string) {
    super('no_invite');
  }
}

// Employee sign-in / sign-up.
// - Invite link (?invite=TOKEN): no code needed; the token rides along in the
//   sign-up metadata so handle_new_user() places the person.
// - Code typed: checked first (verify-company-code), as before.
// - Neither: works when HR imported this email.
// Afterwards join_company_for_me() places an account that exists but has no
// profile yet. If nothing places it, sign out again and say so.
export async function employeeJoin(input: {
  email: string;
  password: string;
  code?: string;
  inviteToken?: string;
}) {
  const email = input.email.trim();
  const code = (input.code || '').trim().toUpperCase();
  const inviteToken = (input.inviteToken || '').trim();

  let company: { id: string; name: string; slug: string } | null = null;
  if (code && !inviteToken) {
    const v = await verifyCompanyCode(code, email);
    if (!v.valid) throw new Error(v.error || 'Invalid company code');
    company = v.company ?? null;
  }

  const meta: Record<string, string> = {};
  if (code) meta.company_code = code;
  if (inviteToken) meta.invite_token = inviteToken;
  await signInOrUpWithPassword(email, input.password, meta);

  const placement = await safeJoin({ code, inviteToken });
  if (placement.placed === false) {
    await signOut();
    throw new NotInvitedError(email.toLowerCase());
  }
  return { company, placement };
}

// HR portal sign-in. /hr.html?invite=TOKEN carries the HR-admin invite.
export async function hrJoin(input: { email: string; password: string; inviteToken?: string }) {
  const inviteToken = (input.inviteToken || '').trim();
  await signInOrUpWithPassword(
    input.email,
    input.password,
    inviteToken ? { invite_token: inviteToken } : undefined,
  );
  return safeJoin({ inviteToken });
}

// The session already exists at this point; a failed placement call must not
// look like a failed sign-in. handle_new_user() covers the usual case anyway.
async function safeJoin(opts: { code?: string; inviteToken?: string }): Promise<Placement> {
  try {
    return await joinCompanyForMe(opts);
  } catch (e) {
    console.warn('[invites] join_company_for_me failed', e);
    return { placed: null };
  }
}
