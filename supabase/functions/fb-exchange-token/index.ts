import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/fb-exchange-token\/?/, "/").replace(/\/+/g, "/");

  // Read credentials from bot_settings first, fallback to env
  const { data: settings } = await supabaseAdmin
    .from("bot_settings")
    .select("key, value")
    .in("key", ["facebook_app_id", "facebook_app_secret"]);

  const cfg: Record<string, string> = {};
  for (const row of settings || []) cfg[row.key] = row.value;

  const FB_APP_ID = cfg.facebook_app_id || Deno.env.get("FACEBOOK_APP_ID") || "";
  const FB_APP_SECRET = cfg.facebook_app_secret || Deno.env.get("FACEBOOK_APP_SECRET") || "";

  if (!FB_APP_ID || !FB_APP_SECRET) {
    return new Response(
      JSON.stringify({ error: "Facebook App ID or Secret not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // GET /auth-url
    if (path === "/auth-url" || path === "/auth-url/") {
      const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fb-exchange-token/callback`;
      const scopes = "pages_messaging,pages_show_list,pages_manage_metadata";
      
      // Store the app origin in state so callback can redirect back
      const callerOrigin = url.searchParams.get("origin") || "";
      const statePayload = JSON.stringify({ nonce: crypto.randomUUID(), origin: callerOrigin });
      const state = btoa(statePayload);

      const authUrl =
        `https://www.facebook.com/v21.0/dialog/oauth?` +
        `client_id=${FB_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${scopes}` +
        `&state=${encodeURIComponent(state)}` +
        `&response_type=code`;

      return new Response(
        JSON.stringify({ authUrl, redirectUri }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /callback
    if (path === "/callback" || path === "/callback/") {
      const code = url.searchParams.get("code");
      const errorParam = url.searchParams.get("error");
      const stateParam = url.searchParams.get("state");

      // Parse origin from state
      let appOrigin = "";
      try {
        const stateData = JSON.parse(atob(decodeURIComponent(stateParam || "")));
        appOrigin = stateData.origin || "";
      } catch { /* ignore */ }

      const makeRedirect = (params: string) => {
        if (appOrigin) {
          return Response.redirect(`${appOrigin}/facebook-connect?${params}`, 302);
        }
        // Fallback to HTML if no origin
        return new Response(
          `<html><body><p>Done. You can close this window.</p></body></html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      };

      if (errorParam) {
        const errorDesc = url.searchParams.get("error_description") || "Authorization denied";
        console.error("OAuth error:", errorParam, errorDesc);
        return makeRedirect(`fb_status=error&message=${encodeURIComponent(errorDesc)}`);
      }

      if (!code) {
        return makeRedirect(`fb_status=error&message=${encodeURIComponent("No authorization code received")}`);
      }

      const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fb-exchange-token/callback`;

      // Step 1: Exchange code for short-lived token
      const tokenRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `client_id=${FB_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${FB_APP_SECRET}` +
        `&code=${code}`
      );
      const tokenData = await tokenRes.json();
      console.log("Step 1 - Token exchange status:", tokenRes.status, "has access_token:", !!tokenData.access_token, "error:", tokenData.error?.message || "none");

      if (tokenData.error) {
        const errMsg = tokenData.error.message || "Token exchange failed";
        return makeRedirect(`fb_status=error&message=${encodeURIComponent(errMsg)}`);
      }

      // Step 2: Exchange for long-lived token
      const llRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${FB_APP_ID}` +
        `&client_secret=${FB_APP_SECRET}` +
        `&fb_exchange_token=${tokenData.access_token}`
      );
      const llData = await llRes.json();
      const longLivedToken = llData.access_token || tokenData.access_token;
      const expiresIn = llData.expires_in;
      console.log("Step 2 - Long-lived token exchange status:", llRes.status, "has access_token:", !!llData.access_token, "expires_in:", expiresIn, "error:", llData.error?.message || "none");

      // Step 3: Fetch pages
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedToken}&fields=id,name,access_token`
      );
      const pagesData = await pagesRes.json();
      console.log("Step 3 - Pages fetch status:", pagesRes.status, "pages count:", pagesData.data?.length || 0, "error:", pagesData.error?.message || "none");

      if (pagesData.error) {
        const errMsg = pagesData.error.message || "Failed to fetch pages";
        return makeRedirect(`fb_status=error&message=${encodeURIComponent(errMsg)}`);
      }

      const pages = pagesData.data || [];
      const tokenExpiresAt = expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null;

      let upsertedCount = 0;
      for (const page of pages) {
        const { error } = await supabaseAdmin
          .from("connected_pages")
          .upsert(
            {
              page_id: page.id,
              page_name: page.name,
              page_access_token: page.access_token,
              token_expires_at: tokenExpiresAt,
            },
            { onConflict: "page_id" }
          );
        if (!error) upsertedCount++;
        else console.error(`Upsert failed for ${page.id}:`, error);
      }

      console.log(`fb-exchange-token: Upserted ${upsertedCount}/${pages.length} pages`);

      return makeRedirect(`fb_status=success&pages=${pages.length}`);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fb-exchange-token error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
