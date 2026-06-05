import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getConfigFromDb(supabaseAdmin: any) {
  const { data } = await supabaseAdmin
    .from("bot_settings")
    .select("key, value")
    .in("key", ["facebook_app_id", "facebook_app_secret", "facebook_login_config_id"]);

  const config: Record<string, string> = {};
  for (const row of data || []) {
    config[row.key] = row.value;
  }
  return {
    appId: config.facebook_app_id || Deno.env.get("FACEBOOK_APP_ID") || "",
    appSecret: config.facebook_app_secret || Deno.env.get("FACEBOOK_APP_SECRET") || "",
    loginConfigId:
      config.facebook_login_config_id || Deno.env.get("FACEBOOK_LOGIN_CONFIG_ID") || "",
  };
}

const FLB_STATE_PREFIX = "flb:";

const SUBSCRIBED_FIELDS =
  "messages,messaging_postbacks,messaging_referrals,message_reads,messaging_handovers,message_echoes";
const REQUIRED_FIELDS = SUBSCRIBED_FIELDS.split(",");

async function subscribePageToWebhook(pageId: string, pageAccessToken: string) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?subscribed_fields=${SUBSCRIBED_FIELDS}&access_token=${pageAccessToken}`,
      { method: "POST" }
    );
    const data = await res.json();
    if (!res.ok || data.error) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      console.error(`subscribed_apps failed for page ${pageId}:`, msg);
      return { ok: false, error: msg };
    }
    console.log(`subscribed_apps OK for page ${pageId}:`, JSON.stringify(data));
    return { ok: true, data };
  } catch (e) {
    console.error(`subscribed_apps threw for page ${pageId}:`, e);
    return { ok: false, error: String(e) };
  }
}

async function getPageSubscriptionStatus(pageId: string, pageAccessToken: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?access_token=${pageAccessToken}`
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    return {
      ok: false,
      error: data?.error?.message || `HTTP ${res.status}`,
      apps: [] as any[],
    };
  }
  return { ok: true, apps: (data.data || []) as any[] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/facebook-oauth\/?/, "/").replace(/\/+/g, "/");

  try {
    const config = await getConfigFromDb(supabaseAdmin);

    if (!config.appId || !config.appSecret) {
      return new Response(
        JSON.stringify({ error: "Facebook App ID or Secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/facebook-oauth/callback`;

    // GET /auth-url — classic Facebook Login (existing flow)
    if (path === "/auth-url" || path === "/auth-url/") {
      const scopes =
        "pages_show_list,pages_messaging,pages_read_engagement,pages_manage_metadata,business_management";
      const state = crypto.randomUUID();

      const authUrl =
        `https://www.facebook.com/v21.0/dialog/oauth?` +
        `client_id=${config.appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${scopes}` +
        `&state=${state}` +
        `&response_type=code`;

      return new Response(
        JSON.stringify({ authUrl, redirectUri }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /business-auth-url — Facebook Login for Business (new flow)
    if (path === "/business-auth-url" || path === "/business-auth-url/") {
      if (!config.loginConfigId) {
        return new Response(
          JSON.stringify({
            error:
              "Facebook Login Config ID not configured. Set facebook_login_config_id in App Configuration.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const state = `${FLB_STATE_PREFIX}${crypto.randomUUID()}`;
      const authUrl =
        `https://www.facebook.com/v21.0/dialog/oauth?` +
        `client_id=${config.appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&config_id=${encodeURIComponent(config.loginConfigId)}` +
        `&state=${encodeURIComponent(state)}` +
        `&response_type=code`;

      return new Response(
        JSON.stringify({ authUrl, redirectUri }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /callback — shared callback for both classic and FLB flows
    if (path === "/callback" || path === "/callback/") {
      const code = url.searchParams.get("code");
      const errorParam = url.searchParams.get("error");
      const stateParam = url.searchParams.get("state") || "";
      const isFlb = stateParam.startsWith(FLB_STATE_PREFIX);

      if (errorParam) {
        const errorDesc = url.searchParams.get("error_description") || "Authorization denied";
        return new Response(
          `<html><body><script>window.opener?.postMessage({type:'fb-oauth-error',error:'${errorDesc.replace(/'/g, "\\'")}'},'*');window.close();</script><p>Authorization failed: ${errorDesc}. You can close this window.</p></body></html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      if (!code) {
        return new Response(
          `<html><body><script>window.opener?.postMessage({type:'fb-oauth-error',error:'No authorization code received'},'*');window.close();</script><p>No authorization code received. You can close this window.</p></body></html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      // Step 1: Exchange code for short-lived token (same for classic + FLB)
      const tokenRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `client_id=${config.appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${config.appSecret}` +
        `&code=${code}`
      );
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        const errMsg = tokenData.error.message || "Token exchange failed";
        return new Response(
          `<html><body><script>window.opener?.postMessage({type:'fb-oauth-error',error:'${errMsg.replace(/'/g, "\\'")}'},'*');window.close();</script><p>Error: ${errMsg}</p></body></html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      const shortLivedToken = tokenData.access_token;

      // Step 2: Exchange for long-lived token (60 days)
      const longLivedRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${config.appId}` +
        `&client_secret=${config.appSecret}` +
        `&fb_exchange_token=${shortLivedToken}`
      );
      const longLivedData = await longLivedRes.json();
      const longLivedToken = longLivedData.access_token || shortLivedToken;
      const expiresIn = longLivedData.expires_in;

      // Step 3: Fetch pages via /me/accounts (works for both classic + FLB-issued tokens)
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedToken}&fields=id,name,access_token,category,picture{url}`
      );
      const pagesData = await pagesRes.json();

      if (pagesData.error) {
        const errMsg = pagesData.error.message || "Failed to fetch pages";
        return new Response(
          `<html><body><script>window.opener?.postMessage({type:'fb-oauth-error',error:'${errMsg.replace(/'/g, "\\'")}'},'*');window.close();</script><p>Error: ${errMsg}</p></body></html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      const pages = pagesData.data || [];
      console.log(
        `Facebook OAuth (${isFlb ? "FLB" : "classic"}): /me/accounts returned ${pages.length} pages`
      );

      if (pages.length === 0) {
        const errMsg = isFlb
          ? "Business Login completed, but no Pages were returned. In the Configuration, make sure Pages assets are enabled and that the user granted access to at least one Page."
          : "Facebook returned 0 pages for this account. Make sure you selected at least one Page in the consent dialog and that your account has an admin/editor role on a Page.";
        return new Response(
          `<html><body><script>window.opener?.postMessage({type:'fb-oauth-error',error:'${errMsg.replace(/'/g, "\\'")}'},'*');window.close();</script><p>${errMsg}</p></body></html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      let upsertedCount = 0;
      let subscribedCount = 0;
      const tokenExpiresAt = expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null;

      for (const page of pages) {
        const pictureUrl = page.picture?.data?.url || null;

        const { error: upsertError } = await supabaseAdmin
          .from("facebook_pages")
          .upsert(
            {
              page_id: page.id,
              name: page.name,
              access_token: page.access_token,
              category: page.category || null,
              picture_url: pictureUrl,
              is_active: true,
              token_expires_at: tokenExpiresAt,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "page_id" }
          );

        if (upsertError) {
          console.error(`Failed to upsert page ${page.id}:`, upsertError);
          continue;
        }
        upsertedCount++;

        // Auto-subscribe to webhook so messages start flowing immediately
        if (page.access_token) {
          const sub = await subscribePageToWebhook(page.id, page.access_token);
          if (sub.ok) subscribedCount++;
        }
      }

      console.log(
        `Facebook OAuth (${isFlb ? "FLB" : "classic"}): Upserted ${upsertedCount}/${pages.length} pages, subscribed ${subscribedCount}`
      );

      return new Response(
        `<html><body><script>window.opener?.postMessage({type:'fb-oauth-success',pages:${upsertedCount},subscribed:${subscribedCount}},'*');window.close();</script><p>Successfully connected ${upsertedCount} page(s) (${subscribedCount} subscribed to webhook). This window will close automatically.</p></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // POST /subscribe-page  body: { page_id }
    if ((path === "/subscribe-page" || path === "/subscribe-page/") && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const pageId = body?.page_id;
      if (!pageId) {
        return new Response(JSON.stringify({ error: "page_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: row, error } = await supabaseAdmin
        .from("facebook_pages")
        .select("access_token")
        .eq("page_id", pageId)
        .maybeSingle();
      if (error || !row?.access_token) {
        return new Response(
          JSON.stringify({ error: "Page not found or has no access token" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const result = await subscribePageToWebhook(pageId, row.access_token);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /subscription-status?page_id=...
    if (path === "/subscription-status" || path === "/subscription-status/") {
      const pageId = url.searchParams.get("page_id");
      if (!pageId) {
        return new Response(JSON.stringify({ error: "page_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: row, error } = await supabaseAdmin
        .from("facebook_pages")
        .select("access_token")
        .eq("page_id", pageId)
        .maybeSingle();
      if (error || !row?.access_token) {
        return new Response(
          JSON.stringify({ error: "Page not found or has no access token" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const status = await getPageSubscriptionStatus(pageId, row.access_token);
      const subscribed = status.ok && status.apps.length > 0;
      return new Response(
        JSON.stringify({ subscribed, ...status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /token-debug?page_id=...
    if (path === "/token-debug" || path === "/token-debug/") {
      const pageId = url.searchParams.get("page_id");
      if (!pageId) {
        return new Response(JSON.stringify({ error: "page_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: row, error } = await supabaseAdmin
        .from("facebook_pages")
        .select("access_token, name")
        .eq("page_id", pageId)
        .maybeSingle();
      if (error || !row?.access_token) {
        return new Response(
          JSON.stringify({ error: "Page not found or has no access token" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const token = row.access_token;
      const appAccessToken = `${config.appId}|${config.appSecret}`;
      const dbgRes = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${token}&access_token=${appAccessToken}`
      );
      const dbgJson = await dbgRes.json();
      if (!dbgRes.ok || dbgJson.error) {
        return new Response(
          JSON.stringify({ error: dbgJson?.error?.message || `HTTP ${dbgRes.status}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const d = dbgJson.data || {};
      const scopes: string[] = d.scopes || [];
      return new Response(
        JSON.stringify({
          page_name: row.name,
          is_valid: d.is_valid,
          scopes,
          granular_scopes: d.granular_scopes || [],
          has_pages_messaging: scopes.includes("pages_messaging"),
          app_id: d.app_id,
          application: d.application,
          profile_id: d.profile_id,
          type: d.type,
          expires_at: d.expires_at,
          data_access_expires_at: d.data_access_expires_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /profile-debug?page_id=...&psid=...
    if (path === "/profile-debug" || path === "/profile-debug/") {
      const pageId = url.searchParams.get("page_id");
      const psid = url.searchParams.get("psid");
      if (!pageId || !psid) {
        return new Response(JSON.stringify({ error: "page_id and psid required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: row, error } = await supabaseAdmin
        .from("facebook_pages")
        .select("access_token, name")
        .eq("page_id", pageId)
        .maybeSingle();
      if (error || !row?.access_token) {
        return new Response(
          JSON.stringify({ error: "Page not found or has no access token" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const profileUrl = `https://graph.facebook.com/v21.0/${psid}?fields=first_name,last_name,profile_pic,locale,timezone&access_token=${row.access_token}`;
      const res = await fetch(profileUrl);
      const bodyText = await res.text();
      let parsed: any = null;
      try { parsed = JSON.parse(bodyText); } catch { /* */ }
      const success = !!(res.ok && parsed && !parsed.error && (parsed.first_name || parsed.last_name));
      return new Response(
        JSON.stringify({
          success,
          page_name: row.name,
          page_id: pageId,
          psid,
          http_status: res.status,
          profile: success ? {
            first_name: parsed.first_name,
            last_name: parsed.last_name,
            locale: parsed.locale,
            timezone: parsed.timezone,
            has_profile_pic: !!parsed.profile_pic,
          } : null,
          graph_error: parsed?.error || null,
          raw_body: bodyText.slice(0, 1000),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /refresh-customer-profile  body: { customer_id }
    if ((path === "/refresh-customer-profile" || path === "/refresh-customer-profile/") && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const customerId = body?.customer_id;
      if (!customerId) {
        return new Response(JSON.stringify({ error: "customer_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: customer, error: cErr } = await supabaseAdmin
        .from("customer")
        .select("id, messenger_id, page_id, messenger_name")
        .eq("id", customerId)
        .maybeSingle();
      if (cErr || !customer) {
        return new Response(JSON.stringify({ error: "Customer not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!customer.messenger_id) {
        return new Response(JSON.stringify({ error: "Customer has no messenger_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: pages } = await supabaseAdmin
        .from("facebook_pages")
        .select("page_id, access_token")
        .eq("is_active", true);
      const ordered = (pages || []).slice().sort((a: any, b: any) => {
        if (a.page_id === customer.page_id) return -1;
        if (b.page_id === customer.page_id) return 1;
        return 0;
      });

      const attempts: any[] = [];
      let updated: any = null;

      for (const p of ordered) {
        if (!p.access_token) continue;
        const profileUrl = `https://graph.facebook.com/v21.0/${customer.messenger_id}?fields=first_name,last_name,profile_pic,locale,timezone&access_token=${p.access_token}`;
        const res = await fetch(profileUrl);
        const bodyText = await res.text();
        let parsed: any = null;
        try { parsed = JSON.parse(bodyText); } catch { /* */ }
        const ok = !!(res.ok && parsed && !parsed.error && (parsed.first_name || parsed.last_name));
        attempts.push({
          page_id: p.page_id,
          http_status: res.status,
          ok,
          graph_error: parsed?.error || null,
        });
        if (ok) {
          const updateData: any = {
            messenger_name: `${parsed.first_name || ''} ${parsed.last_name || ''}`.trim(),
            updated_at: new Date().toISOString(),
          };
          if (parsed.locale) updateData.locale = parsed.locale;
          if (parsed.timezone) updateData.timezone_offset = parsed.timezone;
          if (!customer.page_id) updateData.page_id = p.page_id;
          await supabaseAdmin.from("customer").update(updateData).eq("id", customer.id);
          updated = { ...updateData, page_id_used: p.page_id };
          break;
        }
      }

      return new Response(
        JSON.stringify({
          success: !!updated,
          customer_id: customerId,
          updated,
          attempts,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("facebook-oauth error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
