## Goal

Use the working `FACEBOOK_SYSTEM_USER_TOKEN` to fetch Messenger user profiles (name + profile pic), and repopulate every existing "Unknown" customer.

You confirmed this call returns valid data:
```
GET https://graph.facebook.com/v19.0/{PSID}?fields=name,first_name,profile_pic&access_token={SYSTEM_USER_TOKEN}
```

So we switch profile lookups to prefer the system user token instead of per-page tokens.

## Changes

### 1. `supabase/functions/messenger-webhook/index.ts` — `getUserProfile()`

Rewrite the fetch order so new incoming messages resolve names immediately:

1. **Try system user token first** (the one that works in your test).
   `GET /v19.0/{psid}?fields=first_name,last_name,name,profile_pic,locale,timezone&access_token={SYSTEM_USER_TOKEN}`
2. If that returns an error or empty name, fall back to the page token from `facebook_pages` (current behavior).
3. If both fail, log the Graph error body and store `Unknown` as today.

No change to how the profile is then written into `customer` (name, `messenger_profile_pic` via `downloadAndStoreProfilePic`, locale, timezone). The existing "refresh on next message if name is Unknown" block keeps working — it just calls the new `getUserProfile`, so any old Unknown that messages again will self-heal.

### 2. `supabase/functions/backfill-profile-pics/index.ts` — Messenger branch

Replace the "loop through every active page token" logic with:

1. Read `FACEBOOK_SYSTEM_USER_TOKEN` once at startup.
2. For each customer with `messenger_id` + (missing pic OR `messenger_name = 'Unknown'`):
   - Call Graph with the system user token (same URL as above).
   - On success → update `messenger_name`, download/store `profile_pic` into `chat-attachments/profile-pics/{id}.jpg`, set `locale`, `timezone_offset`, and `page_id` if missing.
   - On failure → fall back to existing per-page-token loop (so we don't regress for any PSID the system user can't see).
3. Keep current rate-limiting (`delay(100)`) and the `limit` parameter (default 50, max 200).

### 3. `src/pages/FacebookPages.tsx` — Backfill trigger

Add a small admin button **"Repopulate Unknown customers"** that calls `supabase.functions.invoke('backfill-profile-pics', { body: { limit: 200 } })` and toasts the result (`processed / updated / failed / remaining`). User can click it repeatedly until `remaining = 0`. No new table, no migration.

## Out of scope

- No DB schema changes, no new secrets (we reuse `FACEBOOK_SYSTEM_USER_TOKEN`).
- No change to the chat UI / conversation switching code from previous turns.
- We are **not** removing the page-token path — it stays as a fallback so existing logic that sends messages (which requires a page token) is untouched. Only profile lookups switch to system-user-first.

## How to verify after build

1. Send a brand-new Messenger message from a test account → webhook log should show `[profile-fetch] success via system_user_token` and the customer row should be created with the real name + photo, not Unknown.
2. Click **Repopulate Unknown customers** on `/facebook-pages` → existing Unknowns (Saddam, Prince, etc.) get filled in within a few seconds per batch.
