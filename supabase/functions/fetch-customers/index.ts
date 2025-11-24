import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
    const search = url.searchParams.get('search') || '';
    const filterStatus = url.searchParams.get('filter_status') || '';
    const filterSource = url.searchParams.get('filter_source') || '';
    const sort = url.searchParams.get('sort') || 'created_at_desc';

    console.log('Fetch customers:', { page, pageSize, search, filterStatus, filterSource, sort });

    // Build query
    let query = supabaseClient
      .from('customer')
      .select('*', { count: 'exact' });

    // Search filter (search across multiple fields)
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,username.ilike.%${search}%,telegram_id.eq.${search}`);
    }

    // Status filter (premium/standard)
    if (filterStatus) {
      if (filterStatus === 'premium') {
        query = query.eq('is_premium', true);
      } else if (filterStatus === 'standard') {
        query = query.eq('is_premium', false);
      }
    }

    // Sorting
    const [sortColumn, sortDirection] = sort.split('_');
    query = query.order(sortColumn, { ascending: sortDirection === 'asc' });

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }

    return new Response(
      JSON.stringify({
        data: data || [],
        total: count || 0,
        page,
        pageSize,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
