import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FB_APP_ID = Deno.env.get("FACEBOOK_APP_ID") || "";
const FB_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET") || "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function getSystemUserToken(): Promise<string | null> {
  try {
    const { data } = await admin
      .from("bot_settings")
      .select("value")
      .eq("key", "facebook_system_user_token")
      .maybeSingle();
    const v = (data?.value || "").trim();
    if (v) return v;
  } catch {}
  return (Deno.env.get("FACEBOOK_SYSTEM_USER_TOKEN") || "").trim() || null;
}

async function graphGet(url: string) {
  try {
    const r = await fetch(url);
    const text = await r.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { status: r.status, ok: r.ok && !json?.error, json };
  } catch (e) {
    return { status: 0, ok: false, json: { error: { message: String(e) } } };
  }
}

async function diagnosePage(
  page: { id: string; page_id: string; name: string; access_token: string },
  systemToken: string | null,
) {
  const result: any = {
    page_id: page.page_id,
    name: page.name,
    system_user_token: { configured: !!systemToken, can_read_page: false, error: null },
    page_token: { valid: false, expires_at: null, scopes: [] as string[], target_page_id: null, error: null },
    psid_lookup_with_page_token: null,
    psid_lookup_with_system_token: null,
  };

  // 1. SUT can read this page?
  if (systemToken) {
    const r = await graphGet(
      `https://graph.facebook.com/v19.0/${page.page_id}?fields=id,name&access_token=${systemToken}`,
    );
    result.system_user_token.can_read_page = r.ok;
    if (!r.ok) result.system_user_token.error = r.json?.error?.message || `HTTP ${r.status}`;
  } else {
    result.system_user_token.error = "FACEBOOK_SYSTEM_USER_TOKEN not configured";
  }

  // 2. Debug the page token
  if (page.access_token && FB_APP_ID && FB_APP_SECRET) {
    const appAccess = `${FB_APP_ID}|${FB_APP_SECRET}`;
    const r = await graphGet(
      `https://graph.facebook.com/v19.0/debug_token?input_token=${page.access_token}&access_token=${appAccess}`,
    );
    const d = r.json?.data;
    if (d) {
      result.page_token.valid = !!d.is_valid;
      result.page_token.expires_at = d.expires_at
        ? new Date(d.expires_at * 1000).toISOString()
        : (d.data_access_expires_at ? new Date(d.data_access_expires_at * 1000).toISOString() : null);
      result.page_token.scopes = d.scopes || [];
      result.page_token.target_page_id = d.profile_id || null;
      if (d.error) result.page_token.error = d.error.message;
    } else {
      result.page_token.error = r.json?.error?.message || `HTTP ${r.status}`;
    }
  } else if (!page.access_token) {
    result.page_token.error = "No page access_token stored";
  } else {
    result.page_token.error = "FACEBOOK_APP_ID/SECRET not configured";
  }

  // 3. Sample PSID lookup
  const { data: sample } = await admin
    .from("customer")
    .select("messenger_id, messenger_name")
    .eq("page_id", page.page_id)
    .not("messenger_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (sample?.messenger_id) {
    result.sample_psid = sample.messenger_id;

    if (page.access_token) {
      const r = await graphGet(
        `https://graph.facebook.com/v19.0/${sample.messenger_id}?fields=first_name,last_name,profile_pic&access_token=${page.access_token}`,
      );
      result.psid_lookup_with_page_token = {
        ok: r.ok,
        status: r.status,
        error_code: r.json?.error?.code || null,
        error_subcode: r.json?.error?.error_subcode || null,
        error_message: r.json?.error?.message || null,
        name: r.ok ? `${r.json.first_name || ""} ${r.json.last_name || ""}`.trim() : null,
      };
    }
    if (systemToken) {
      const r = await graphGet(
        `https://graph.facebook.com/v19.0/${sample.messenger_id}?fields=first_name,last_name,profile_pic&access_token=${systemToken}`,
      );
      result.psid_lookup_with_system_token = {
        ok: r.ok,
        status: r.status,
        error_code: r.json?.error?.code || null,
        error_subcode: r.json?.error?.error_subcode || null,
        error_message: r.json?.error?.message || null,
        name: r.ok ? `${r.json.first_name || ""} ${r.json.last_name || ""}`.trim() : null,
      };
    }
  } else {
    result.sample_psid = null;
    result.note = "No customer with messenger_id on this page to test against";
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Admin check
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemToken = await getSystemUserToken();
    const { data: pages, error } = await admin
      .from("facebook_pages")
      .select("id, page_id, name, access_token, is_active")
      .eq("is_active", true);
    if (error) throw error;

    const results = [];
    for (const p of pages || []) {
      results.push(await diagnosePage(p as any, systemToken));
    }

    return new Response(
      JSON.stringify({
        system_user_token_configured: !!systemToken,
        system_user_token_length: systemToken?.length || 0,
        app_credentials_configured: !!(FB_APP_ID && FB_APP_SECRET),
        pages: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
