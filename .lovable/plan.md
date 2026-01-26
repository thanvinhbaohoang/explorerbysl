

## Fix: Traffic Not Recording for Telegram `?p=[tag]` Visits

### Problem
The `/telegram` page uses the client-side Supabase SDK (anon key) to insert into `telegram_leads`, but the RLS policy only allows **service role** to insert. This causes all inserts to fail silently with:
```
"new row violates row-level security policy for table 'telegram_leads'"
```

### Solution
Create a backend function to handle the traffic capture, since edge functions can use the service role key.

---

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/capture-traffic/index.ts` | Create | New edge function to insert traffic data |
| `src/pages/Telegram.tsx` | Modify | Call edge function instead of direct insert |
| `src/pages/Redirect.tsx` | Modify | Call edge function instead of direct insert |

---

### 1. Create Edge Function: `capture-traffic`

```typescript
// supabase/functions/capture-traffic/index.ts
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

    if (error) throw error;

    return new Response(JSON.stringify({ id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

---

### 2. Update `Telegram.tsx`

Replace the direct Supabase insert with a call to the edge function:

```typescript
// Before (fails due to RLS):
const { data: insertedData, error: insertError } = await supabase
  .from("telegram_leads")
  .insert({...})
  .select('id')
  .single();

// After (uses service role via edge function):
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capture-traffic`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      facebook_click_id: fbclid,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      utm_adset_id: utmAdsetId,
      utm_ad_id: utmAdId,
      utm_campaign_id: utmCampaignId,
      referrer: referrer || null,
      messenger_ref: productRef,
      platform: 'telegram',
    }),
  }
);
const insertedData = await response.json();
```

---

### 3. Update `Redirect.tsx`

Same change - replace direct insert with edge function call.

---

### 4. Config Update

Add to `supabase/config.toml`:
```toml
[functions.capture-traffic]
verify_jwt = false
```

This allows unauthenticated requests (ad clicks from anonymous visitors).

---

### Why This Fix Works

1. **Edge functions use service role key** - bypasses RLS restrictions
2. **No authentication required** - visitors clicking ads aren't logged in
3. **Same data captured** - all UTM params, fbclid, and messenger_ref preserved
4. **Bot linking still works** - the returned `id` is passed to Telegram as start parameter

---

### Security Note

The edge function only allows INSERT operations with a fixed set of fields - no arbitrary data access. This is safe for public traffic tracking.

