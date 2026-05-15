import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Auth gate: must be admin.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });
    if (roleErr || !isAdmin) {
      return jsonResponse({ error: 'Forbidden — admin only' }, 403);
    }

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    if (action === 'preview' || (req.method === 'GET' && action !== 'execute')) {
      const { data, error } = await admin.rpc('preview_unknown_messenger_cleanup');
      if (error) throw error;
      return jsonResponse(data);
    }

    if (action === 'execute' && req.method === 'POST') {
      const { data, error } = await admin.rpc('execute_unknown_messenger_cleanup');
      if (error) throw error;
      console.log(`Cleanup by ${userId}:`, data);
      return jsonResponse({ deleted: data });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('cleanup-unknown-customers error:', err);
    return jsonResponse({ error: String((err as any)?.message ?? err) }, 500);
  }
});
