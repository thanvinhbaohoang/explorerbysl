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

  try {
    // GET — Meta webhook verification
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      // Read verify token from bot_settings or env
      const { data: settings } = await supabaseAdmin
        .from("bot_settings")
        .select("key, value")
        .eq("key", "facebook_verify_token")
        .maybeSingle();

      const verifyToken = settings?.value || Deno.env.get("FACEBOOK_VERIFY_TOKEN") || "";

      if (mode === "subscribe" && token === verifyToken) {
        console.log("fb-webhook: Verification successful");
        return new Response(challenge, { status: 200 });
      }

      return new Response("Forbidden", { status: 403 });
    }

    // POST — Inbound webhook events
    if (req.method === "POST") {
      const body = await req.json();

      if (body.object !== "page") {
        return new Response("Not a page event", { status: 200 });
      }

      for (const entry of body.entry || []) {
        const pageId = entry.id;

        for (const event of entry.messaging || []) {
          const senderId = event.sender?.id;
          if (!senderId || !event.message) continue;

          const messageText = event.message?.text || null;

          // Look up page token from connected_pages
          const { data: pageRow } = await supabaseAdmin
            .from("connected_pages")
            .select("page_access_token")
            .eq("page_id", pageId)
            .maybeSingle();

          const pageToken = pageRow?.page_access_token;

          // Fetch sender profile
          let firstName = null;
          let lastName = null;
          let profilePic = null;

          if (pageToken) {
            try {
              const profileRes = await fetch(
                `https://graph.facebook.com/v21.0/${senderId}?fields=first_name,last_name,profile_pic&access_token=${pageToken}`
              );
              if (profileRes.ok) {
                const profile = await profileRes.json();
                firstName = profile.first_name || null;
                lastName = profile.last_name || null;
                profilePic = profile.profile_pic || null;
              }
            } catch (e) {
              console.error("Profile fetch error:", e);
            }
          }

          // Upsert contact
          await supabaseAdmin
            .from("fb_contacts")
            .upsert(
              {
                psid: senderId,
                page_id: pageId,
                first_name: firstName,
                last_name: lastName,
                profile_pic: profilePic,
              },
              { onConflict: "psid,page_id" }
            );

          // Insert message
          await supabaseAdmin
            .from("fb_messages")
            .insert({
              psid: senderId,
              page_id: pageId,
              message_text: messageText,
              direction: "inbound",
              created_time: new Date((event.timestamp || Date.now())).toISOString(),
            });

          console.log(`fb-webhook: Message from ${senderId} on page ${pageId}`);
        }
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    console.error("fb-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
