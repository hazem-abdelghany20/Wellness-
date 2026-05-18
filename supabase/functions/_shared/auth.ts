import { createUserClient, createServiceClient } from './supabase-client.ts';
import { isSuperadminEmail } from './superadmin.ts';

export async function requireAuth(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createUserClient(authHeader);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let companyId = user.app_metadata?.company_id as string | undefined;
  let role = (user.app_metadata?.role ?? 'employee') as string;

  // JWT app_metadata only refreshes on token mint, so a freshly-onboarded
  // user (or one whose profile was backfilled out of band) won't have the
  // company_id / role claims yet. Read straight from the profile via service
  // role so writes can still proceed without forcing the user to sign out.
  if (!companyId) {
    const service = createServiceClient();
    const { data: prof } = await service
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single();
    if (prof?.company_id) companyId = prof.company_id as string;
    if (prof?.role) role = prof.role as string;
  }

  // Super-admin allowlist: any email in src/lib/superadmin.ts (mirrored on
  // the edge in _shared/superadmin.ts) is treated as company_admin for the
  // purposes of role gating.
  if (isSuperadminEmail(user.email)) {
    role = 'company_admin';
  }

  return { user, supabase, companyId, role, authHeader };
}
