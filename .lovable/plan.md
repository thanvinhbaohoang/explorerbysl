## Problem

Pausing a page in System settings flips `facebook_pages.is_active = false`, but the Messenger webhook in `supabase/functions/messenger-webhook/index.ts` never checks that flag when handling incoming events. So messages from paused pages still create customers and messages.

## Fix

In the page-event loop (around line 1502, `if (data.object === 'page')`), before processing any `entry.messaging` events, look up `facebook_pages.is_active` for `currentPageId` and skip the entry when the page is paused or unknown.

### Implementation details

- Build a small lookup once per webhook POST: query `facebook_pages` for all `page_id`s present in `data.entry`, select `page_id, is_active`, and put them in a `Map`.
- For each `entry`:
  - If the page is missing from `facebook_pages` → log and skip (don't auto-create here; pages are only added through the connect/refresh flow).
  - If `is_active === false` → log `Page <id> is paused, skipping N events` and `continue` to the next entry.
  - Otherwise process as today.
- Keep echo handling consistent: if a page is paused, skip echoes too (no DB writes for paused pages at all).
- Outbound send endpoints (`send`, `send_media`, `send_media_batch`, `tokens`, `pages`) already filter `is_active = true`, so no change needed there.

### Files touched

- `supabase/functions/messenger-webhook/index.ts` — add the active-page guard inside the `data.object === 'page'` branch.

### Out of scope

- No UI changes (System page already shows the pause toggle).
- No DB schema changes.
- No changes to outbound send paths.
- Existing customers/messages from already-received traffic are not deleted (separate cleanup tool exists).
