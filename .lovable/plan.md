## Goal

Make sure new Messenger customers (created by `messenger-webhook` on first inbound event) populate `messenger_name` / `messenger_profile_pic` using the same Graph call and same token source as the now-working "Refetch from Facebook" button on `/customers/[id]`.

## Current state

- `messenger-webhook/index.ts` already calls Graph `v19.0/<psid>?fields=first_name,last_name,name,profile_pic,locale,timezone` for new senders (`getUserProfile` → `tryFetchProfile`) and prefers the system user token before falling back to the page token. Good.
- BUT the system user token is read from a 5-minute config cache (`getConfigValue` in `messenger-webhook`). When you update the token in `/system`, new inbound messages can use the **stale cached token** for up to 5 minutes — which mimics the original bug the Refresh button had.
- `backfill-profile-pics` (the Refresh path) now reads the token **DB-first, no cache** via `getSystemUserToken()`. We want the webhook's new-customer path to match.

## Change

**`supabase/functions/messenger-webhook/index.ts`** — single file, no schema or frontend changes.

1. Add a helper mirroring backfill:
   ```ts
   async function getSystemUserTokenFresh(): Promise<{ token: string | null; source: 'db' | 'env' | null }>
   ```
   - `SELECT value FROM bot_settings WHERE key='facebook_system_user_token'` (no cache).
   - Falls back to `Deno.env.get('FACEBOOK_SYSTEM_USER_TOKEN')`.
   - Returns `{ token, source }`.

2. Update `getUserProfile(psid, pageId)`:
   - Call `getSystemUserTokenFresh()` at the top instead of reading the module-level `systemUserToken`.
   - Use that token for the first `tryFetchProfile(...)` attempt (`source` label becomes `system_user_token:db` / `system_user_token:env` for log visibility).
   - Keep the existing page-token fallback unchanged.
   - Also refresh the in-memory `systemUserToken` + `configCache` entry whenever the DB value differs, so other call sites (Send API page-token lookups, etc.) pick up the change immediately.

3. Logging: in the new-customer creation block (around line 574 and the duplicate path around line 806), log `token_source` + length/prefix/suffix once per fetch — same shape as `refreshSingleCustomer` — so we can confirm in edge logs which token created each new customer.

4. No behavior change for already-existing customers beyond the "Unknown name refresh" branch (line 525), which already calls `getUserProfile` and will inherit the fix automatically.

## Out of scope

- No changes to `backfill-profile-pics`, no DB migrations, no frontend, no changes to the page-token cache (only the system-user-token path needs to bypass cache).
- Not changing the Graph field list — the current field set is a superset of the Refresh button's fields, which is fine.

## How to verify

1. Update the System User token in `/system`.
2. Send a brand-new Messenger message from a never-seen-before user.
3. Check `messenger-webhook` logs: should show `token_source=db length=…` and `[profile-fetch] success via=system_user_token:db …` within the same request, and the new customer row should have a real `messenger_name` + stored `messenger_profile_pic` immediately (no "Unknown").
