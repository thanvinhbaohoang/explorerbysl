import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Selection criterion (single source of truth):
// Pure-Messenger ghost customers from the failed integration with no human data.
const UNKNOWN_FILTER = `
  messenger_id IS NOT NULL
  AND (messenger_name IS NULL OR messenger_name = '' OR messenger_name ILIKE 'unknown%')
  AND telegram_id IS NULL
  AND legal_first_name IS NULL
  AND legal_last_name IS NULL
  AND legal_middle_name IS NULL
  AND national_id IS NULL
  AND passport_number IS NULL
`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

async function getUnknownIds(admin: ReturnType<typeof createClient>): Promise<string[]> {
  const ids: string[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from('customer')
      .select('id')
      .not('messenger_id', 'is', null)
      .or('messenger_name.is.null,messenger_name.eq.,messenger_name.ilike.unknown%')
      .is('telegram_id', null)
      .is('legal_first_name', null)
      .is('legal_last_name', null)
      .is('legal_middle_name', null)
      .is('national_id', null)
      .is('passport_number', null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    ids.push(...data.map((r: any) => r.id));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return ids;
}

async function chunkedDelete(
  admin: ReturnType<typeof createClient>,
  table: string,
  column: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  let total = 0;
  const chunkSize = 500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { error, count } = await admin
      .from(table)
      .delete({ count: 'exact' })
      .in(column, chunk);
    if (error) throw error;
    total += count || 0;
  }
  return total;
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

    // ---- PREVIEW ----
    if (action === 'preview' || (req.method === 'GET' && action !== 'execute')) {
      const ids = await getUnknownIds(admin);
      if (ids.length === 0) {
        return jsonResponse({
          customers: 0, messages: 0, leads: 0, summaries: 0, notes: 0, actions: 0,
        });
      }
      // Count related rows in chunks to avoid URL limit
      const countIn = async (table: string, col: string) => {
        let total = 0;
        const chunkSize = 500;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { count, error } = await admin
            .from(table)
            .select('*', { count: 'exact', head: true })
            .in(col, chunk);
          if (error) throw error;
          total += count || 0;
        }
        return total;
      };
      const [messages, leads, summaries, notes, actions] = await Promise.all([
        countIn('messages', 'customer_id'),
        countIn('telegram_leads', 'user_id'),
        countIn('customer_summaries', 'customer_id'),
        countIn('customer_notes', 'customer_id'),
        countIn('customer_action_items', 'customer_id'),
      ]);
      return jsonResponse({
        customers: ids.length,
        messages,
        leads,
        summaries,
        notes,
        actions,
      });
    }

    // ---- EXECUTE ----
    if (action === 'execute' && req.method === 'POST') {
      const ids = await getUnknownIds(admin);
      if (ids.length === 0) {
        return jsonResponse({
          deleted: { customers: 0, messages: 0, leads: 0, summaries: 0 },
          message: 'Nothing to clean up.',
        });
      }

      // Sanity guard: never delete more than 10k customers in one shot
      if (ids.length > 10000) {
        return jsonResponse({ error: `Refusing to delete ${ids.length} customers in one batch.` }, 400);
      }

      // FK-safe order
      const summaries = await chunkedDelete(admin, 'customer_summaries', 'customer_id', ids);
      const leads = await chunkedDelete(admin, 'telegram_leads', 'user_id', ids);
      const messages = await chunkedDelete(admin, 'messages', 'customer_id', ids);
      const customers = await chunkedDelete(admin, 'customer', 'id', ids);

      console.log(`Cleanup by ${userId}:`, { customers, messages, leads, summaries });

      return jsonResponse({
        deleted: { customers, messages, leads, summaries },
      });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('cleanup-unknown-customers error:', err);
    return jsonResponse({ error: String(err?.message ?? err) }, 500);
  }
});
