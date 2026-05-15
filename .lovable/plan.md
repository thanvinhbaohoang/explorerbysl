## Goal
Add Facebook Login for Business (FLB) as a second connect option alongside the existing classic OAuth flow, so any business owner with admin access on a Page can connect their Pages without requiring a System User token.

## Why FLB
- FLB uses a pre-configured Configuration ID set up in the Meta dashboard, so the permission set and asset-selection UX are locked in by us.
- Page tokens come back as **business-scoped Page tokens** that work for `pages_messaging` even when the Page belongs to a Business Portfolio (current client situation).
- No System User setup required from the client.

## Coexistence
- Keep the existing **Connect Facebook Page** button (classic OAuth) untouched.
- Add a new **Connect via Business Login** button next to it.
- Keep the System User Token flow as a fallback for `messenger-webhook` page-token cache misses (no changes to that fallback).

## Backend changes
Edit `supabase/functions/facebook-oauth/index.ts`:
1. Add a new endpoint `GET /business-auth-url` that builds the FLB authorization URL using `config_id` instead of `scope`:
   - `https://www.facebook.com/v21.0/dialog/oauth?client_id=...&redirect_uri=...&config_id=<FB_LOGIN_CONFIG_ID>&response_type=code&state=...`
   - Use a shared callback URL but include a marker in `state` (e.g. prefix `flb:`) so the callback can branch.
2. Update the existing `/callback` to:
   - Parse the `state` value and detect the FLB marker.
   - Use the same code-for-token exchange (FLB returns the same shape).
   - Call `/me/accounts` (FLB-issued user token still supports this) to enumerate Pages and upsert into `facebook_pages`.
   - On the FLB branch, allow 0 pages without showing the "0 pages" hard error if the user only granted business assets but no Pages, but still show a clear toast.
3. Read the config ID from `bot_settings.facebook_login_config_id` (with env fallback `FACEBOOK_LOGIN_CONFIG_ID`) using the same DB-first cache pattern already in use.

## Database changes
Insert a new `bot_settings` row with `key='facebook_login_config_id'` and an empty default value, so the admin can manage it from the UI.

## Frontend changes
Edit `src/pages/FacebookPages.tsx`:
1. Add a second button **Connect via Business Login** next to the existing **Connect Facebook Page** button. Same popup pattern, but it hits `/facebook-oauth/business-auth-url` instead of `/auth-url`.
2. Reuse the same `postMessage` success/error handler — no changes needed there.
3. In the **Facebook App Configuration** dialog (admin-only), add a new field `Facebook Login Config ID` that writes to `bot_settings.facebook_login_config_id`.
4. Add a small contextual help blurb next to the new button explaining when to use it (Business Manager pages).

## Validation
- From `/system`, click **Connect via Business Login** → popup completes → toast shows N pages connected → `facebook_pages` table populated.
- Webhook subscription via existing per-page `subscribed_apps` call works with the FLB-issued Page token.
- Original **Connect Facebook Page** button still works unchanged.

## Out of scope
- No changes to `messenger-webhook` page-token logic.
- No removal of the System User token flow.
- No FLB-specific scope inspection UI (the configuration's permission set is managed in Meta's dashboard).