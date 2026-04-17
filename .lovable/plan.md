

## Diagnosis

Telegram unread badges persist across refresh, but Messenger ones reset. That points to something Messenger-specific writing `is_read = true` to the DB without a click.

The most likely culprit is the **messenger-webhook edge function**. When Facebook delivers a `message_reads` event (the user read our reply on their end) or when we process echoes / delivery receipts, the webhook may be flipping `is_read` on inbound customer messages. It could also happen inside `handleMessage` if the insert defaults or post-insert logic touches `is_read` for prior messages from the same PSID.

Telegram has no equivalent read-receipt webhook event, which explains why only Messenger is affected.

A second possibility: the realtime subscription in `ChatConversationList` listens for `UPDATE` events on `messages` and, if a webhook flips `is_read` server-side, the badge silently drops to 0 on the next refresh because the DB itself no longer has unread rows for that customer.

## Plan

1. **Inspect** `supabase/functions/messenger-webhook/index.ts` end-to-end, looking for:
   - Any `update({ is_read: true })` on the `messages` table
   - Handling of `message_reads`, `delivery`, or `read` webhook event types
   - Echo/self-message handling that might mark prior inbound messages read
   - Default values on insert that could overwrite existing rows via upsert

2. **Verify with DB query**: check if Messenger customer Harold's inbound messages currently have `is_read = true` in the DB (vs Telegram Harold's which stay false). This confirms whether the reset is server-side (webhook) or client-side (frontend bug specific to Messenger rows).

3. **Fix the webhook**: remove any code path that auto-marks customer messages as read. The webhook should only ever INSERT new inbound messages with `is_read = false` (the column default). Read state must be owned exclusively by the explicit click handler in `ChatConversationList`.

4. **Optionally**: ignore Facebook `message_reads` events entirely — those represent the *customer* having read *our* reply, which is unrelated to the staff-side unread badge.

## Files to change (expected)

- `supabase/functions/messenger-webhook/index.ts` — strip out any `is_read` mutations; ignore `read`/`delivery` webhook events for the staff-unread purpose.

No frontend or DB schema changes needed. RPC and click-gated logic stay as-is.

