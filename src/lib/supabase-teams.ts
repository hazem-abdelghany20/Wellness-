import { supabase } from './supabase';

// Sprint 3: HR team admin. SQL: supabase/migrations/20261111000001_*.sql §6.
// HR / company admins only (not_authorized otherwise); everything stays
// inside the caller's company.
//
// Errors (error.message; error.details where noted):
//   not_authorized · team_not_found · person_not_found (details = user id) ·
//   name_required · name_too_long (80) · team_name_taken ·
//   team_not_empty (details = member count) — pass { moveMembers: true } ·
//   team_in_use (details = 'routine,challenge,broadcast' — what still runs
//     for the team: end the routine assignment / cancel the challenge or
//     broadcast first) ·
//   protected_role (HR / company / Wellness admins can't be made or unmade
//     leads) · person_has_no_team (a lead needs a team) · too_many_items (500).

export interface TeamLead {
  user_id: string;
  display_name: string;
  initials: string;
}

export interface Team {
  id: string;
  name: string;
  department: string | null;
  created_at: string;
  members: number;      // current (not deleted) people in the team
  leads: TeamLead[];    // people with role 'manager' in the team
}

export interface TeamList {
  teams: Team[];        // by name
  no_team: number;      // people in the company without a team
}

// Every team with member counts and leads, plus the "no team" count.
export async function listTeams(): Promise<TeamList> {
  const { data, error } = await supabase.rpc('hr_list_teams');
  if (error) throw error;
  return (data ?? { teams: [], no_team: 0 }) as TeamList;
}

// New team (name unique in the company, case-insensitive).
export async function createTeam(name: string, department?: string | null): Promise<Team> {
  const { data, error } = await supabase.rpc('hr_create_team', {
    p_name: name, p_department: department ?? null,
  });
  if (error) throw error;
  return data as Team;
}

// Rename a team. name null/undefined keeps it; department undefined keeps
// it, '' clears it.
export async function renameTeam(
  teamId: string, name: string | null | undefined, department?: string | null,
): Promise<Omit<Team, 'members' | 'leads'>> {
  const { data, error } = await supabase.rpc('hr_rename_team', {
    p_team_id: teamId, p_name: name ?? null, p_department: department === undefined ? null : (department ?? ''),
  });
  if (error) throw error;
  return data;
}

export interface DeleteTeamResult {
  deleted: true;
  team_id: string;
  moved: number;        // people moved to "no team"
  leads_unset: number;  // leads who went back to employee
}

// Delete a team. With people in it, pass { moveMembers: true } to move them
// to "no team" first (otherwise team_not_empty).
export async function deleteTeam(teamId: string, opts: { moveMembers?: boolean } = {}): Promise<DeleteTeamResult> {
  const { data, error } = await supabase.rpc('hr_delete_team', {
    p_team_id: teamId, p_move_members: !!opts.moveMembers,
  });
  if (error) throw error;
  return data as DeleteTeamResult;
}

export interface MoveResult {
  team_id: string | null;
  moved: number;        // people whose team actually changed
  user_ids: string[];
}

// Move one person to a team; teamId null = "no team". A lead stays a lead.
export function movePersonToTeam(userId: string, teamId: string | null): Promise<MoveResult> {
  return movePeopleToTeam([userId], teamId);
}

// Move several people at once (up to 500).
export async function movePeopleToTeam(userIds: string[], teamId: string | null): Promise<MoveResult> {
  const { data, error } = await supabase.rpc('hr_move_to_team', {
    p_user_ids: userIds, p_team_id: teamId,
  });
  if (error) throw error;
  return data as MoveResult;
}

export interface LeadResult {
  user_id: string;
  team_id: string | null;
  role: 'manager' | 'employee';
  lead: boolean;
}

// Make someone their team's lead (role manager) or take it back (employee).
// Their app picks the new role up at the next token refresh (≤ 1 hour).
export async function setTeamLead(userId: string, lead = true): Promise<LeadResult> {
  const { data, error } = await supabase.rpc('hr_set_team_lead', { p_user_id: userId, p_lead: lead });
  if (error) throw error;
  return data as LeadResult;
}
