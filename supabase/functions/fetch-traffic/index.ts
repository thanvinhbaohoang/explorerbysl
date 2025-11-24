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
    const filterSource = url.searchParams.get('filter_source') || '';
    const filterCampaign = url.searchParams.get('filter_campaign') || '';
    const dateFrom = url.searchParams.get('date_from') || '';
    const dateTo = url.searchParams.get('date_to') || '';
    const sort = url.searchParams.get('sort') || 'created_at_desc';

    console.log('Fetch traffic:', { page, pageSize, search, filterSource, filterCampaign, dateFrom, dateTo, sort });

    // Build query
    let query = supabaseClient
      .from('telegram_leads')
      .select('*, customer:user_id(id, telegram_id, username, first_name, last_name)', { count: 'exact' });

    // Search filter (fbclid, utm source, campaign, etc.)
    if (search) {
      query = query.or(`facebook_click_id.ilike.%${search}%,utm_source.ilike.%${search}%,utm_campaign.ilike.%${search}%`);
    }

    // Source filter
    if (filterSource) {
      query = query.eq('utm_source', filterSource);
    }

    // Campaign filter
    if (filterCampaign) {
      query = query.eq('utm_campaign', filterCampaign);
    }

    // Date range filter
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
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
      console.error('Error fetching traffic:', error);
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
