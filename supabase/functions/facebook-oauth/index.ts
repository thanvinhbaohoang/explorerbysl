import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getConfigFromDb(supabaseAdmin: any) {
  const { data } = await supabaseAdmin
    .from("bot_settings")
    .select("key, value")
    .in("key", ["facebook_app_id", "facebook_app_secret"]);

  const config: Record<string, string> = {};
  for (const row of data || []) {
    config[row.key] = row.value;
  }
  return {
    appId: config.facebook_app_id || Deno.env.get("FACEBOOK_APP_ID") || "",
    appSecret: config.facebook_app_secret || Deno.env.get("FACEBOOK_APP_SECRET") || "",
  };
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

    // GET /auth-url — return the Facebook OAuth URL
    if (path === "/auth-url" || path === "/auth-url/") {
      const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/facebook-oauth/callback`;
      const scopes = "pages_messaging,pages_read_engagement,pages_manage_metadata";
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

    // GET /callback — Facebook redirects here after user authorizes
    if (path === "/callback" || path === "/callback/") {
      const code = url.searchParams.get("code");
      const errorParam = url.searchParams.get("error");

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

      const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/facebook-oauth/callback`;

      // Step 1: Exchange code for short-lived token
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
      const expiresIn = longLivedData.expires_in; // seconds

      // Step 3: Fetch pages via /me/accounts
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
      let upsertedCount = 0;

      // Calculate token expiry
      const tokenExpiresAt = expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null;

      // Step 4: Upsert each page into facebook_pages
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
        } else {
          upsertedCount++;
        }
      }

      console.log(`Facebook OAuth: Upserted ${upsertedCount}/${pages.length} pages`);

      return new Response(
        `<html><body><script>window.opener?.postMessage({type:'fb-oauth-success',pages:${pages.length}},'*');window.close();</script><p>Successfully connected ${pages.length} page(s). This window will close automatically.</p></body></html>`,
        { headers: { "Content-Type": "text/html" } }
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
