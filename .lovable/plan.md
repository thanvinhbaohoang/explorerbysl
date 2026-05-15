# Per-page enable/disable toggle on /system

The `facebook_pages` table already has an `is_active` column, and the messenger webhook already filters incoming events with `.eq('is_active', true)`. So this is purely a UI + small backend tweak.

## Changes

**1. UI toggle (`src/pages/FacebookPages.tsx`)**
- Add a `Switch` in each connected-page row (admin-only, next to the existing token controls) bound to `page.is_active`.
- On change: `update facebook_pages set is_active = <value> where id = page.id`, then refetch + toast (`"Vessels Of Soul enabled"` / `"<page> paused — incoming messages ignored"`).
- Show a muted "Paused" badge on disabled pages so it's obvious at a glance.
- Add a short helper line at the top: *"Disabled pages stop receiving new chats and messages immediately. Existing conversations stay visible."*

**2. Stop OAuth/system-user sync from re-enabling paused pages (`supabase/functions/messenger-webhook/index.ts`, lines ~157-173)**
- Currently every Page sync upsert hard-codes `is_active: true`, which would silently re-enable a page the admin paused.
- Fix: on upsert, omit `is_active` from the update path so it only defaults to `true` on **first insert**. Use a two-step: try `select` by `page_id`; if exists, update without `is_active`; if not, insert with `is_active: true`. (Or use `upsert` with `ignoreDuplicates`-style handling for that one column.)

**3. RLS**
- `facebook_pages` UPDATE policy is currently `{public}` true/true — already permissive enough for the toggle. No migration needed.

## Out of scope

- No deletion of past messages from disabled pages (they remain in chat history).
- No bulk "disable all except X" button (one-click toggles are enough for ~handful of pages; can add later if needed).
- No change to webhook subscription on Meta's side — Meta keeps delivering events, we just drop them server-side. This is intentional so re-enabling is instant.

## Validation

1. Toggle every client page off, leave Vessels Of Soul on.
2. Send a test message to a disabled page → no new customer/message row appears.
3. Send a test message to Vessels Of Soul → appears in chat.
4. Re-run "Sync Pages" from the UI → previously disabled pages stay disabled.
