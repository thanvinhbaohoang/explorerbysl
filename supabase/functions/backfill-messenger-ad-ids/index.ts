import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getSystemUserToken(): Promise<string | null> {
  try {
    const { data } = await admin
      .from("bot_settings")
      .select("value")
      .eq("key", "facebook_system_user_token")
      .maybeSingle();
    const v = (data?.value || "").trim();
    if (v) return v;
  } catch (_e) { /* ignore */ }
  return (Deno.env.get("FACEBOOK_SYSTEM_USER_TOKEN") || "").trim() || null;
}

async function fetchAdHierarchy(adId: string, token: string) {
  const url = `https://graph.facebook.com/v21.0/${adId}?fields=adset_id,campaign_id,campaign{name}&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data?.error) {
    return { ok: false as const, error: data?.error?.message || `HTTP ${res.status}` };
  }
  return {
    ok: true as const,
    adset_id: data.adset_id || null,
    campaign_id: data.campaign_id || null,
    campaign_name: data.campaign?.name || null,
  };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) return;
        results[idx] = await fn(items[idx]);
      }
    }),
  );
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = await getSystemUserToken();
    if (!token) {
      return new Response(JSON.stringify({ error: "FACEBOOK_SYSTEM_USER_TOKEN is not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch leads needing enrichment
    let scanned = 0;
    const adIdToLeadIds = new Map<string, string[]>();
    const pageSize = 500;
    let from = 0;
    while (true) {
      const { data, error } = await admin
        .from("telegram_leads")
        .select("id, ad_id, utm_adset_id, utm_campaign_id")
        .eq("platform", "messenger")
        .not("ad_id", "is", null)
        .or("utm_adset_id.is.null,utm_campaign_id.is.null")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      scanned += data.length;
      for (const row of data) {
        const aid = (row as any).ad_id as string;
        if (!aid) continue;
        const arr = adIdToLeadIds.get(aid) || [];
        arr.push((row as any).id);
        adIdToLeadIds.set(aid, arr);
      }
      if (data.length < pageSize) break;
      from += pageSize;
      if (from > 200_000) break; // safety
    }

    const uniqueAdIds = Array.from(adIdToLeadIds.keys());

    let updated = 0;
    let failed = 0;
    const errors: Array<{ ad_id: string; error: string }> = [];

    await mapWithConcurrency(uniqueAdIds, 5, async (adId) => {
      const result = await fetchAdHierarchy(adId, token);
      if (!result.ok) {
        failed++;
        if (errors.length < 20) errors.push({ ad_id: adId, error: result.error });
        return;
      }
      const leadIds = adIdToLeadIds.get(adId) || [];
      const patch: Record<string, string | null> = {
        utm_ad_id: adId,
        utm_adset_id: result.adset_id,
        utm_campaign_id: result.campaign_id,
      };
      if (result.campaign_name) patch.utm_campaign = result.campaign_name;
      const { error: upErr } = await admin
        .from("telegram_leads")
        .update(patch)
        .in("id", leadIds);
      if (upErr) {
        failed++;
        if (errors.length < 20) errors.push({ ad_id: adId, error: upErr.message });
      } else {
        updated += leadIds.length;
      }
    });

    return new Response(
      JSON.stringify({ scanned, unique_ads: uniqueAdIds.length, updated, failed, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("backfill-messenger-ad-ids error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
