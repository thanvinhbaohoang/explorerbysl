import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    console.log('Capturing traffic data:', {
      platform: body.platform,
      messenger_ref: body.messenger_ref,
      has_fbclid: !!body.facebook_click_id,
    });

    const { data, error } = await supabase
      .from('telegram_leads')
      .insert({
        facebook_click_id: body.facebook_click_id || null,
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        utm_content: body.utm_content || null,
        utm_term: body.utm_term || null,
        utm_adset_id: body.utm_adset_id || null,
        utm_ad_id: body.utm_ad_id || null,
        utm_campaign_id: body.utm_campaign_id || null,
        referrer: body.referrer || null,
        messenger_ref: body.messenger_ref || null,
        platform: body.platform || 'telegram',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Database insert error:', error);
      throw error;
    }

    console.log('Traffic captured successfully, lead ID:', data.id);

    return new Response(JSON.stringify({ id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Capture traffic error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
