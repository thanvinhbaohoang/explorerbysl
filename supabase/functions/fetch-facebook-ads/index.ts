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
    const { startDate, endDate, level, adId } = await req.json();
    
    const accountId = Deno.env.get('FACEBOOK_AD_ACCOUNT_ID');
    // Use unified System User Token for all Facebook API operations
    const accessToken = Deno.env.get('FACEBOOK_SYSTEM_USER_TOKEN') || Deno.env.get('FACEBOOK_ACCESS_TOKEN');

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
    const baseUrl = `https://graph.facebook.com/v21.0`;
    const dateRange = startDate && endDate ? `&time_range={'since':'${startDate}','until':'${endDate}'}` : '';
    
    let endpoint = '';
    let fields = '';

    // If fetching account info
    if (level === 'account-info') {
      fields = 'id,name,account_status,currency,timezone_name';
      endpoint = `${baseUrl}/${formattedAccountId}?fields=${fields}&access_token=${accessToken}`;
    }
    // If fetching specific ad details
    else if (adId) {
      fields = 'id,name,status,adset_id,creative{id,name,title,body,image_url,video_id,thumbnail_url,object_story_spec},targeting{age_min,age_max,genders,geo_locations,interests},insights{impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type}';
      endpoint = `${baseUrl}/${adId}?fields=${fields}&access_token=${accessToken}`;
    } else {
      switch (level) {
        case 'campaigns':
          fields = 'id,name,status,insights.time_range({"since":"' + (startDate || '2024-01-01') + '","until":"' + (endDate || '2024-12-31') + '"}){impressions,clicks,spend,ctr,cpc,cpm,date_start,date_stop}';
          endpoint = `${baseUrl}/${formattedAccountId}/campaigns?fields=${fields}&access_token=${accessToken}`;
          break;
        
        case 'adsets':
          fields = 'id,name,campaign_id,status,insights.time_range({"since":"' + (startDate || '2024-01-01') + '","until":"' + (endDate || '2024-12-31') + '"}){impressions,clicks,spend,ctr,cpc,cpm,date_start,date_stop}';
          endpoint = `${baseUrl}/${formattedAccountId}/adsets?fields=${fields}&access_token=${accessToken}`;
          break;
        
        case 'ads':
          fields = 'id,name,adset_id,status,insights.time_range({"since":"' + (startDate || '2024-01-01') + '","until":"' + (endDate || '2024-12-31') + '"}){impressions,clicks,spend,ctr,cpc,cpm,date_start,date_stop}';
          endpoint = `${baseUrl}/${formattedAccountId}/ads?fields=${fields}&access_token=${accessToken}`;
          break;
        
        default:
          // Account-level insights
          fields = 'impressions,clicks,spend,ctr,cpc,cpm,date_start,date_stop';
          endpoint = `${baseUrl}/${formattedAccountId}/insights?fields=${fields}&access_token=${accessToken}${dateRange}`;
      }
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