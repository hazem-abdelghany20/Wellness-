import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { code, email } = await req.json() as { code: string; email: string };

    if (!code || !email) {
      return new Response(
        JSON.stringify({ error: 'code and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createServiceClient();

    // Look up company by code (normalized to uppercase)
    const { data: company, error } = await supabase
      .from('companies')
      .select('id, name, slug, plan')
      .eq('code', code.toUpperCase().trim())
      .maybeSingle();

    if (error || !company) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid company code' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert pending association so handle_new_user() can find the company
    await supabase.from('pending_company_associations').upsert({
      email: email.toLowerCase().trim(),
      company_id: company.id,
      verified: false,
    }, { onConflict: 'email' });

    return new Response(
      JSON.stringify({
        valid: true,
        company: { id: company.id, name: company.name, slug: company.slug },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
