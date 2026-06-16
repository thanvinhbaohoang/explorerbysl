# Durable Telegram webhook fix

Two problems to solve together:
1. **Duplicates** when Telegram retries (current minimal fix reduces but doesn't eliminate this).
2. **Silent failures** after we return 200 — today, if a download/upload/insert fails in the background, the message vanishes with no UI signal.

## Part A — Idempotency (eliminates duplicates)

### Schema change (single migration)
- Add to `public.messages`:
  - `telegram_update_id BIGINT NULL` — Telegram's per-bot monotonic update id.
  - `telegram_message_id BIGINT NULL` — Telegram's per-chat message id (useful for debugging/edits).
- Partial unique index: `CREATE UNIQUE INDEX messages_telegram_update_id_key ON public.messages (telegram_update_id) WHERE telegram_update_id IS NOT NULL;`
- No RLS change. No GRANT change. Existing rows stay NULL and are unaffected.

### Code change in `supabase/functions/telegram-bot/index.ts`
- For every inbound branch (text, photo, voice, video, document, video_note), replace `.insert({...})` with `.upsert({..., telegram_update_id, telegram_message_id }, { onConflict: 'telegram_update_id', ignoreDuplicates: true })`.
- Keep `EdgeRuntime.waitUntil` from the previous fix — fast 200 is still desirable, idempotency is the safety net.
- Result: even if Telegram retries, two webhook instances race, or the function restarts mid-flight, only one row per Telegram update can exist.

### Storage key stability (bonus)
- Change `downloadAndStoreDocument` / `downloadAndStoreFile` keys from time-based random to deterministic: `telegram-{type}/{file_unique_id}.{ext}` (Telegram exposes `file_unique_id` on every file object, stable across retries).
- Use `upsert: true` on the storage upload so retries overwrite instead of creating orphan ghost files.

## Part B — Failure visibility (so you know when something breaks)

Goal: any failure in the background pipeline shows up somewhere staff can see, not just edge logs.

### New table `public.telegram_webhook_failures`
Columns: `update_id BIGINT`, `chat_id BIGINT`, `customer_id UUID NULL`, `stage TEXT` (`download` | `storage` | `insert` | `customer_lookup`), `message_type TEXT`, `error TEXT`, `raw_update JSONB`, `created_at`.

Standard GRANTs (`authenticated` read, `service_role` all), RLS enabled, policy: admins can read.

### Wrap each background step in try/catch
In the webhook handler's `processUpdate`:
- Wrap `downloadAndStoreFile` / `downloadAndStoreDocument` / customer auto-create / `.upsert` in try/catch.
- On any failure, insert a row into `telegram_webhook_failures` with the stage, error message, and the raw Telegram update payload (so it can be replayed manually later if needed).
- Still log to console so edge logs work too.

### Surface in UI
- Reuse the existing `WebhookDebug` page — add a "Recent inbound failures" card at the top showing last 20 rows from `telegram_webhook_failures` with stage, error, chat id, and timestamp.
- That's it for surfacing — no toast/notification system needed unless you want one later. Staff can check the page after any reported "missing message."

### Out of scope (intentionally)
- No automatic replay/retry of failed updates. Manual retry from the raw payload can be added later if failures actually occur.
- No Messenger webhook changes — same patterns can be applied there in a future pass if needed.
- No cleanup of existing duplicate rows from Rotha/Ju Ju chats. Can be done by hand with a one-off SQL script on request.

## Technical detail (for reference)

```text
inbound update
   │
   ├─► return 200 immediately
   │
   └─► waitUntil(processUpdate):
         ├─ customer lookup / auto-create
         ├─ download from Telegram CDN  ──fail──┐
         ├─ upload to Storage           ──fail──┤
         ├─ upsert into messages        ──fail──┤
         │     onConflict: telegram_update_id    │
         │     ignoreDuplicates: true            │
         └─ done                                  ▼
                              insert into telegram_webhook_failures
                                          │
                                          ▼
                              shows on WebhookDebug page
```

Upsert with `ignoreDuplicates` means a retry is a no-op at the DB level — no error, no second row, no failure log. Only genuine errors hit the failures table.

## Success criteria

- Sending the same voice/PDF from a Telegram user, even with simulated retries, results in exactly one row in `public.messages` and one working bubble.
- If the Telegram CDN or Supabase Storage fails mid-pipeline, a row appears in `telegram_webhook_failures` and on the WebhookDebug page within seconds. No more silent message loss.
- Existing successful flows (text, photo, voice, video, document, profile photo backfill, `/start`) behave identically to today.

## Files to be changed

- `supabase/functions/telegram-bot/index.ts` — add upserts, deterministic storage keys, try/catch per stage with failure logging.
- New migration — add columns + partial unique index to `messages`, create `telegram_webhook_failures` table with GRANTs + RLS.
- `src/pages/WebhookDebug.tsx` — new "Recent inbound failures" card.
- `.lovable/plan.md` — replace with this plan.
