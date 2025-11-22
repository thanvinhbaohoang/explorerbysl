import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FacebookInsight {
  impressions: string;
  clicks: string;
  spend: string;
  ctr: string;
  cpc: string;
  cpm: string;
  date_start: string;
  date_stop: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  insights?: {
    data: FacebookInsight[];
  };
}

interface AdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  insights?: {
    data: FacebookInsight[];
  };
}

interface Ad {
  id: string;
  name: string;
  adset_id: string;
  status: string;
  insights?: {
    data: FacebookInsight[];
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { startDate, endDate, level } = await req.json();
    
    const accountId = Deno.env.get('FACEBOOK_AD_ACCOUNT_ID');
    const accessToken = Deno.env.get('FACEBOOK_ACCESS_TOKEN');

    if (!accountId || !accessToken) {
      console.error('Missing Facebook credentials');
      return new Response(
        JSON.stringify({ 
          error: 'Facebook credentials not configured. Please add FACEBOOK_AD_ACCOUNT_ID and FACEBOOK_ACCESS_TOKEN in settings.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure account ID has 'act_' prefix for Facebook Graph API
    const formattedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    const baseUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}`;
    const dateRange = startDate && endDate ? `&time_range={'since':'${startDate}','until':'${endDate}'}` : '';
    
    let endpoint = '';
    let fields = '';

    switch (level) {
      case 'campaigns':
        fields = 'id,name,status,insights.time_range({"since":"' + (startDate || '2024-01-01') + '","until":"' + (endDate || '2024-12-31') + '"}){impressions,clicks,spend,ctr,cpc,cpm,date_start,date_stop}';
        endpoint = `${baseUrl}/campaigns?fields=${fields}&access_token=${accessToken}`;
        break;
      
      case 'adsets':
        fields = 'id,name,campaign_id,status,insights.time_range({"since":"' + (startDate || '2024-01-01') + '","until":"' + (endDate || '2024-12-31') + '"}){impressions,clicks,spend,ctr,cpc,cpm,date_start,date_stop}';
        endpoint = `${baseUrl}/adsets?fields=${fields}&access_token=${accessToken}`;
        break;
      
      case 'ads':
        fields = 'id,name,adset_id,status,insights.time_range({"since":"' + (startDate || '2024-01-01') + '","until":"' + (endDate || '2024-12-31') + '"}){impressions,clicks,spend,ctr,cpc,cpm,date_start,date_stop}';
        endpoint = `${baseUrl}/ads?fields=${fields}&access_token=${accessToken}`;
        break;
      
      default:
        // Account-level insights
        fields = 'impressions,clicks,spend,ctr,cpc,cpm,date_start,date_stop';
        endpoint = `${baseUrl}/insights?fields=${fields}&access_token=${accessToken}${dateRange}`;
    }

    console.log('Fetching Facebook Ads data:', { level, endpoint: endpoint.replace(accessToken, 'HIDDEN') });

    const response = await fetch(endpoint);
    const data = await response.json();

    if (!response.ok) {
      console.error('Facebook API error:', data);
      return new Response(
        JSON.stringify({ 
          error: data.error?.message || 'Failed to fetch Facebook Ads data',
          details: data.error
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully fetched Facebook Ads data');
    
    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-facebook-ads function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});