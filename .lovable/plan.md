

# Facebook Login for Business — Page Authorization Flow

## Overview
Replace the current System User Token approach with **Facebook Login for Business**, allowing Page admins to log in via Facebook OAuth directly in your app and grant access to their Pages. This eliminates the need for App Review, System User Tokens, and manual token management.

## How It Works

```text
Page Admin clicks "Connect Facebook Page" on /system
  → Facebook OAuth popup opens (Login for Business)
  → Admin grants pages_messaging + pages_read_engagement
  → App receives short-lived User Access Token
  → Exchange for long-lived token (60 days)
  → Fetch /me/accounts to get Page Access Tokens
  → Store Page Access Tokens in facebook_pages table
  → Webhook immediately works for those pages
```

## Changes

### 1. Edge Function: `facebook-oauth` (new)

A new edge function to handle the OAuth token exchange flow:
- **`GET /callback`** — Receives the OAuth redirect from Facebook, exchanges the authorization code for a user access token, then exchanges for a long-lived token, fetches the user's pages via `/me/accounts`, and upserts page tokens into `facebook_pages`.
- **`GET /auth-url`** — Returns the Facebook OAuth URL with the correct scopes (`pages_messaging`, `pages_read_engagement`, `pages_manage_metadata`) and redirect URI.
- Uses `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` from `bot_settings` (already stored).

### 2. `src/pages/FacebookPages.tsx` — Add "Connect Facebook Page" button

- Add a prominent "Connect Facebook Page" button that calls the `/auth-url` endpoint and opens the Facebook OAuth flow in a popup window.
- Listen for the popup to close, then refresh the pages list.
- Keep the existing manual System User Token config as a fallback/advanced option.
- Remove or demote the "Sync Pages" button (no longer primary flow).

### 3. `supabase/functions/messenger-webhook/index.ts` — No changes needed

The webhook already reads page tokens from the `facebook_pages` table. As long as the OAuth flow stores tokens there, everything works.

### 4. Database — No schema changes needed

The `facebook_pages` table already has `access_token`, `page_id`, `name`, `is_active`, etc. The OAuth flow will upsert into the same table.

### 5. Secrets required

- `FACEBOOK_APP_ID` — already stored in `bot_settings`
- `FACEBOOK_APP_SECRET` — already stored in `bot_settings`
- No new secrets needed

### 6. Facebook App Configuration

You'll need to:
- Add **Facebook Login for Business** product to your app in the Facebook Developer portal
- Set the Valid OAuth Redirect URI to your edge function callback URL
- No App Review required — the Page admin authorizes directly

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/facebook-oauth/index.ts` | New edge function for OAuth code exchange and page token storage |
| `src/pages/FacebookPages.tsx` | Add "Connect Facebook Page" button with OAuth popup flow |

## What This Enables

- Any Page admin can authorize your app to access their Page in seconds
- Page Access Tokens are obtained directly (no System User needed)
- Webhook receives messages immediately after authorization
- Profile info (name, picture) works without App Review
- 24-hour messaging window replies work
- Token refresh can be automated (long-lived tokens last 60 days)

## Limitations to Note

- Long-lived Page Access Tokens last ~60 days and need periodic re-authorization
- Only pages where the authorizing user is an admin will appear
- The System User Token flow can remain as a fallback for advanced users

