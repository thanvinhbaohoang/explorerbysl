## Goal

Replay the 187 failed Telegram webhook events stored in `public.telegram_webhook_failures` so the corresponding messages, customers, and leads appear in the app as if the outage never happened.

## What we have

- 186 rows with `stage = 'insert'` — each has the full Telegram `raw_update` JSON. These can be replayed end-to-end through the existing `telegram-bot` edge function.
- 1 row with `stage = 'download'` — a file (photo/document/voice) that failed to download from Telegram at the time. Telegram keeps file blobs ~1 hour, so the original `file_id` is almost certainly expired. We'll save the message metadata but mark the media as unavailable.

## Plan

1. **Add a one-shot admin edge function `replay-telegram-failures`** (`verify_jwt = true`, admin-only via `has_role`). It will:
   - Read rows from `telegram_webhook_failures` ordered by `created_at` ascending (preserves original message order).
   - For each row, POST `raw_update` back to the existing `telegram-bot` function (internal `supabase.functions.invoke`), exactly as Telegram would have. The current code path handles customer upsert, message insert, media download, leads, and triggers — no logic duplication.
   - Idempotency safety net: rely on the new `messages_telegram_update_id_key` unique index. Replays that already landed (or that Telegram retried successfully later) will no-op instead of duplicating.
   - On success, delete the row from `telegram_webhook_failures` (or mark `replayed_at` if we want an audit trail — see step 4).
   - On failure, leave the row in place and record the new error so we can iterate.
   - Return a JSON summary `{ replayed, skipped_duplicate, failed, sample_errors }`.

2. **Add a small admin UI trigger** on the existing `WebhookDebug` page: a "Replay failed Telegram updates" button (admin-only) that calls the function and shows the summary. Disabled while running. No new page needed.

3. **Handle the `stage = 'download'` row** specifically:
   - Attempt the download once. If Telegram returns "file is too old" / 404, insert the message row with `message_text = '[media unavailable — recovered after outage]'`, the correct `customer_id`, `timestamp`, and `message_type`, but null media URL. This keeps the conversation timeline intact even though the binary is gone.

4. **Audit trail (optional, recommended)**:
   - Migration: add `replayed_at timestamptz` and `replay_error text` columns to `telegram_webhook_failures` instead of deleting rows. Lets the client see exactly what was recovered.

5. **Verification after replay**:
   - Spot-check 5-10 customers whose chats went dark during the window: confirm new messages exist with the original `timestamp` (not `now()`), correct sender, and proper media.
   - Confirm `messages_telegram_update_id_key` prevented any duplicates by counting `SELECT count(*), count(DISTINCT telegram_update_id) FROM messages WHERE telegram_update_id IS NOT NULL`.

## Notes / caveats

- Messages will appear with their **original Telegram timestamps**, so they slot into the conversation history at the right place rather than as "new" messages.
- We will **not** re-trigger customer-facing side effects (auto-replies, notifications) during replay. The `telegram-bot` function currently sends replies for `/start` and similar; for replay we'll pass an `x-replay: true` header and have the function skip outbound `sendMessage` calls when that header is present. This avoids spamming customers a day later.
- Messenger is out of scope for this recovery — those failures (if any) aren't logged in this table. The outage was Telegram-specific.

## Success criteria

- `telegram_webhook_failures` either empties out or every remaining row has a `replay_error` explaining why.
- The 186 missing Telegram messages appear in their respective customer threads at their original timestamps.
- No duplicate rows in `messages` for any `telegram_update_id`.
- No outbound Telegram messages sent to customers as a side effect of the replay.
