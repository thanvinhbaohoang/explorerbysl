## Problem

When a page is connected via "Connect via Business Login" (or even classic OAuth), our `facebook-oauth/callback` saves the page token but never tells Facebook to deliver webhook events to our app for that page. Facebook only sends `messages` events after `POST /{page_id}/subscribed_apps` is called with that page's token. Explorer by SL was subscribed manually at some point; Vessels Of Soul never was — confirmed by `subscribed_apps` returning `{ "data": [] }`.

## Fix

Two changes, both in `supabase/functions/facebook-oauth/index.ts`:

### 1. Auto-subscribe on every connect (permanent fix)

In the `/callback` handler, right after each successful `facebook_pages` upsert, call:

```
POST https://graph.facebook.com/v21.0/{page_id}/subscribed_apps
  ?subscribed_fields=messages,messaging_postbacks,messaging_referrals,message_reads,messaging_handovers
  &access_token={page_access_token}
```

Log success/failure per page but don't fail the whole callback if one subscription fails (still return the upsert count). Include the count of successfully subscribed pages in the success postMessage so the UI can show it.

### 2. New `/subscribe-page` endpoint (one-click repair)

Add `POST /subscribe-page` that takes `{ page_id }`, looks up its `access_token` from `facebook_pages`, calls the same `subscribed_apps` endpoint, and returns the Facebook response. This lets us fix already-connected pages (Vessels Of Soul today) without re-running OAuth.

Also add `GET /subscription-status?page_id=...` that does `GET /{page_id}/subscribed_apps` and returns the parsed JSON, so the UI can show whether a page is currently subscribed.

### 3. UI: per-page "Webhook" status + Subscribe button

In `src/pages/FacebookPages.tsx` page list, for each connected page:
- On mount, call `/subscription-status` and show a small badge: green "Subscribed" if our app appears in the response, red "Not subscribed" otherwise.
- When red, show a "Subscribe to webhook" button that calls `/subscribe-page`, then re-checks status and toasts the result.

### Files touched

- `supabase/functions/facebook-oauth/index.ts` — auto-subscribe in callback; add `/subscribe-page` and `/subscription-status` endpoints.
- `src/pages/FacebookPages.tsx` — per-page subscription badge + Subscribe button.

### Out of scope

- No DB schema changes (no need to store subscription state — Facebook is the source of truth, queried on demand).
- No changes to the webhook itself or message ingestion.
- No changes to the Business Login configuration in the FB App Dashboard (user must still ensure the Login Configuration grants `pages_messaging`; we surface failures but can't fix scope from code).

### After deploy: how to fix Vessels Of Soul

Open System Settings → Facebook Pages, click "Subscribe to webhook" next to Vessels Of Soul. Send a test message — it should arrive in Chat.
