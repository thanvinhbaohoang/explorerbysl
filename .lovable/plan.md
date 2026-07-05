## What's happening

Telegram has stopped delivering messages to the bot. Evidence:

- Last saved Telegram message was ~6 hours ago (2026-07-05 06:12 UTC).
- Recent `telegram-bot` edge function logs show only cold-start "booted" events — **zero incoming POST requests from Telegram**.
- Meanwhile `messenger-webhook` is receiving traffic normally, so it's not a project-wide outage.
- The `telegram_webhook_failures` table has no new rows since June 17 — so it's not a parsing/insert error, Telegram simply isn't hitting our endpoint.
- The 401 "Unauthorized" runtime error surfaced in the client is from the WebhookDebug page calling `action: "get_status"` without an auth token — unrelated to inbound messages, but I'll fix it as part of this pass.

Most likely cause: Telegram's webhook registration was cleared or is failing (expired secret, wrong URL, or `getWebhookInfo` shows a `last_error_message`). Telegram silently backs off after enough consecutive failures.

## Plan

1. **Add an unauthenticated diagnostic action** to `telegram-bot`:
   - `action: "webhook_info"` → calls Telegram `getWebhookInfo` and returns the full result (URL, pending_update_count, last_error_date, last_error_message, ip_address).
   - No auth required so we can call it from a plain `curl` to diagnose. It only reads status, never mutates.

2. **Call it from the sandbox** to see exactly what Telegram reports:
   - If `url` is empty → webhook was unregistered.
   - If `last_error_message` is set → Telegram was getting errors from our endpoint (likely a deploy/cold-start window).
   - If `pending_update_count > 0` → queued messages waiting.

3. **Re-register the webhook** via the existing `set_webhook` action (or a new authenticated `reset_webhook` that also calls `deleteWebhook` first with `drop_pending_updates=false`, so queued messages are re-delivered).

4. **Fix the WebhookDebug 401** — the page is calling `telegram-bot` with `action: "get_status"` but not attaching the user's Supabase session token. Update the client call to include `Authorization: Bearer <access_token>` from the current session (same pattern the other admin actions use).

5. **Verify recovery**:
   - Send a test Telegram message.
   - Confirm a new row appears in `messages` and the `telegram-bot` edge logs show an incoming POST.

## Technical details

- `supabase/functions/telegram-bot/index.ts`: add a new branch `if (body.action === "webhook_info")` **before** the auth gate at line 976 (add it to the same "no-auth allow-list" the webhook payloads already use, by checking the action name before the auth block, or by making the auth block skip known-safe read-only actions).
- Optionally add `reset_webhook` (authenticated) that does `deleteWebhook` then `setWebhook`, returning the final `getWebhookInfo`.
- `src/pages/WebhookDebug.tsx` (or wherever the `get_status` call lives): grab `supabase.auth.getSession()` and attach `Authorization: Bearer ${session.access_token}` to the fetch/`functions.invoke` call.

No schema changes, no new secrets. All existing message-handling logic is untouched.
