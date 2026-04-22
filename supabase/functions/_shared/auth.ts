import { createUserClient } from './supabase-client.ts';

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

  const companyId = user.app_metadata?.company_id as string | undefined;
  const role = (user.app_metadata?.role ?? 'employee') as string;

  return { user, supabase, companyId, role, authHeader };
}
