## Goal

Use your newly-pasted `FACEBOOK_SYSTEM_USER_TOKEN` to mint a fresh Page Token for Explorer By SL, save it into `facebook_pages`, and self-heal future "Unknown" Messenger profile lookups.

## Changes

### 1. `supabase/functions/facebook-oauth/index.ts` — add `POST /resync-page-tokens`

- Read `FACEBOOK_SYSTEM_USER_TOKEN` from env.
- Call `GET https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,category,picture{url}&access_token=<systemUserToken>`.
- For each returned page, UPSERT into `facebook_pages` (overwrites `access_token`, `name`, `picture_url`, `category`, sets `is_active = true`, clears `token_expires_at` since System User tokens don't expire).
- Compare against existing `facebook_pages` rows and return:
  ```json
  {
    "refreshed": [{ "page_id", "name", "old_token_len", "new_token_len" }],
    "missing":   [{ "page_id", "name" }]   // in DB but not returned by /me/accounts
  }
  ```
- After upsert, POST `{ action: "invalidate_token_cache" }` to `messenger-webhook` with the service-role key so the in-memory page-token cache resets immediately.
- Requires admin JWT (checks `has_role(auth.uid(), 'admin')`).

### 2. `supabase/functions/messenger-webhook/index.ts` — add cache invalidation + self-heal

- At the top of the POST handler, short-circuit on `{ action: "invalidate_token_cache" }` when the `x-service-role` header matches `SUPABASE_SERVICE_ROLE_KEY` — resets `pageTokensCache = {}` and `pageTokensCacheTime = 0`, returns `{ ok: true }`.
- In `fetchUserProfile`, when Graph returns error code `100` / subcode `2018247`, force-refresh the page-token cache from `facebook_pages` and retry the profile call once before falling back to "Unknown".

### 3. `src/pages/FacebookPages.tsx` — admin button

- Add a **"Re-sync tokens from System User"** button (admin-only) in the header area.
- On click: invoke `facebook-oauth/resync-page-tokens`, show a toast like:
  > Refreshed 1 page. Explorer By SL: token rotated (207 → 213 chars). Missing: none.
- If `missing` is non-empty, surface a warning toast naming the pages — those aren't assigned to the System User in Business Manager.

### 4. Auto-backfill existing "Unknown" customers

- After a successful resync, automatically invoke `backfill-profile-pics` with `{ limit: 100 }` so customers like Saddam and Prince get their names/photos filled in within seconds.

## How you'll use it

1. Approve this plan → I implement the changes.
2. Open **System → Facebook Pages** in the app.
3. Click **Re-sync tokens from System User**.
4. Toast confirms Explorer By SL's token was rotated, and the backfill job updates existing Unknown customers. All new inbound messages will resolve names/photos correctly from then on.

## What this won't fix

If `/me/accounts` doesn't return Explorer By SL, the System User isn't assigned to that page (with the User Profile capability) in Business Manager. The `missing[]` list in the toast will tell you exactly which page is unreachable so you can fix the assignment in Meta Business Suite.

## Out of scope

- No DB migration, no new secrets, no schema changes.
- No changes to existing OAuth or webhook ingestion logic.
