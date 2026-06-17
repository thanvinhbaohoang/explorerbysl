import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TELEGRAM_BOT_URL = `${SUPABASE_URL}/functions/v1/telegram-bot`;

interface FailureRow {
  id: string;
  update_id: number | null;
  chat_id: number | null;
  customer_id: string | null;
  stage: string;
  message_type: string | null;
  raw_update: any;
  created_at: string;
}

// Returns true if a customer message with this telegram user + timestamp
// already exists. Used as an idempotency guard since saveMessage doesn't
// currently set telegram_update_id on inserts.
async function alreadyImported(rawUpdate: any): Promise<boolean> {
  const message = rawUpdate?.message ?? rawUpdate?.edited_message;
  if (!message?.from?.id || !message?.date) return false;

  const tsIso = new Date(message.date * 1000).toISOString();
  const { data, error } = await supabase
    .from("messages")
    .select("id")
    .eq("telegram_id", message.from.id)
    .eq("sender_type", "customer")
    .eq("timestamp", tsIso)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("alreadyImported check failed:", error);
    return false;
  }
  return !!data;
}

async function replayOne(row: FailureRow) {
  if (!row.raw_update) {
    return { status: "failed" as const, error: "no raw_update payload" };
  }

  if (await alreadyImported(row.raw_update)) {
    return { status: "skipped_duplicate" as const };
  }

  const res = await fetch(TELEGRAM_BOT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-replay": "true",
      // telegram-bot deploys with verify_jwt = false, but we send the
      // service-role key as a Bearer to keep the gateway happy.
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(row.raw_update),
  });

  const text = await res.text();
  if (!res.ok) {
    return { status: "failed" as const, error: `telegram-bot ${res.status}: ${text.slice(0, 300)}` };
  }
  return { status: "replayed" as const };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Admin-only
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: userData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { limit?: number; dry_run?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const limit = Math.min(Math.max(body.limit ?? 500, 1), 1000);
  const dryRun = body.dry_run === true;

  const { data: rows, error: fetchErr } = await supabase
    .from("telegram_webhook_failures")
    .select("id, update_id, chat_id, customer_id, stage, message_type, raw_update, created_at")
    .is("replayed_at", null)
    .eq("stage", "insert")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = {
    total: rows?.length ?? 0,
    replayed: 0,
    skipped_duplicate: 0,
    failed: 0,
    dry_run: dryRun,
    sample_errors: [] as Array<{ id: string; update_id: number | null; error: string }>,
  };

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (dryRun) {
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const row of rows as FailureRow[]) {
    try {
      const result = await replayOne(row);
      if (result.status === "replayed") {
        summary.replayed++;
        await supabase
          .from("telegram_webhook_failures")
          .update({ replayed_at: new Date().toISOString(), replay_error: null })
          .eq("id", row.id);
      } else if (result.status === "skipped_duplicate") {
        summary.skipped_duplicate++;
        await supabase
          .from("telegram_webhook_failures")
          .update({
            replayed_at: new Date().toISOString(),
            replay_error: "skipped: message already present",
          })
          .eq("id", row.id);
      } else {
        summary.failed++;
        if (summary.sample_errors.length < 5) {
          summary.sample_errors.push({
            id: row.id,
            update_id: row.update_id,
            error: result.error,
          });
        }
        await supabase
          .from("telegram_webhook_failures")
          .update({ replay_error: result.error })
          .eq("id", row.id);
      }
    } catch (e: any) {
      summary.failed++;
      const msg = e?.message ?? String(e);
      if (summary.sample_errors.length < 5) {
        summary.sample_errors.push({ id: row.id, update_id: row.update_id, error: msg });
      }
      await supabase
        .from("telegram_webhook_failures")
        .update({ replay_error: msg })
        .eq("id", row.id);
    }
  }

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
