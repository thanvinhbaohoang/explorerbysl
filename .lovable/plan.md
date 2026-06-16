# Fix duplicate inbound Telegram voice/document messages — minimal version

## Root cause (recap)

Telegram POSTs an update for an inbound voice/document. The webhook awaits `downloadAndStoreFile` / `downloadAndStoreDocument` (file fetch from Telegram CDN + upload to Supabase Storage) before responding 200. On slow links this exceeds Telegram's tolerance, Telegram retries the same update, and each retry runs the full pipeline again → multiple `messages` rows for one real Telegram message. The earlier bubbles point at incomplete/overwritten storage objects, so they show no play button / "File Unavailable".

## Plan (single change)

Edit only `supabase/functions/telegram-bot/index.ts`:

1. At the very top of the `POST` handler, after parsing JSON, return `new Response('ok', { status: 200 })` immediately and run all existing message-processing logic in the background via `EdgeRuntime.waitUntil(...)` (fallback: fire-and-forget promise with `.catch` logger if `EdgeRuntime` is undefined).
2. Wrap the existing processing in an `async` IIFE so its `await`s still work but no longer block the response.
3. Keep all other behavior unchanged: same inserts, same downloads, same storage keys, same customer auto-create, same profile photo backfill, same command handling (`/start`, etc.).

No schema migration, no idempotency columns, no changes to client code, no changes to other edge functions.

## Why this is enough

Telegram retries are triggered by slow/failed responses. Returning 200 within ~50 ms eliminates the retry trigger, which eliminates the duplicate inserts for the only two cases the user reported (voice and document — the slowest pipelines). The remaining theoretical risk (Telegram retrying despite a 200, or two webhook instances racing) is rare enough that we accept it for now and can revisit with idempotency later if duplicates ever reappear.

## Out of scope

- Idempotency columns / unique index on `messages`.
- Deterministic storage keys.
- Cleanup SQL for existing duplicate rows in Rotha's and Ju Ju's chats (can be done manually on request).

## Success criteria

- Webhook responds 200 within milliseconds regardless of attachment size.
- A single inbound voice or PDF from a Telegram user produces exactly one `messages` row and one working bubble.
- Edge function logs still show the existing "Voice message saved successfully" / "Document message saved successfully" lines, just after the response has already been sent.
