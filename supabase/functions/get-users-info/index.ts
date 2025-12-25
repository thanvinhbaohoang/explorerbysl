import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { user_ids, fetch_all } = await req.json();

    if (!fetch_all && (!user_ids || !Array.isArray(user_ids))) {
      return new Response(
        JSON.stringify({ error: "user_ids array is required or set fetch_all: true" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
      throw error;
    }

    const usersMap: Record<string, { email: string; name: string | null; avatar_url: string | null }> = {};
    
    for (const user of users) {
      // If fetch_all is true, include all users; otherwise filter by user_ids
      if (fetch_all || user_ids.includes(user.id)) {
        usersMap[user.id] = {
          email: user.email || "",
          name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        };
      }
    }

    return new Response(
      JSON.stringify({ users: usersMap }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error fetching users:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
