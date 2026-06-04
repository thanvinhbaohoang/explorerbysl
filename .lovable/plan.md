## Goal

The same Graph API call works in your browser but fails from the edge function with error code 190/465. That means the `FACEBOOK_SYSTEM_USER_TOKEN` secret the function reads at runtime is **not the same string** you tested with — most likely truncated, has a trailing newline/space, or wasn't actually overwritten when you updated it.

We'll add a diagnostic + accept-token-override so you can both verify and unblock yourself in one click.

## Changes

### 1. `supabase/functions/backfill-profile-pics/index.ts`

Add a new action `mode: "diagnose"` (POST body) that:

1. Reads the stored `FACEBOOK_SYSTEM_USER_TOKEN` from env.
2. Returns: `length`, `first8`, `last8`, and whether it contains whitespace / newlines (so you can spot a bad paste without leaking the token).
3. Calls `GET /debug_token?input_token={stored}&access_token={stored}` and returns: `app_id`, `application` (app name), `user_id`, `expires_at`, `is_valid`, `scopes`, `granular_scopes` — this reveals which App/Business the token actually belongs to.
4. Calls `GET /me/accounts?fields=id,name` and returns the page list visible to the token.
5. Optionally re-runs the failing PSID lookup so you see the exact response with the stored token.

Also extend the existing single-customer refresh to accept an optional `override_token` in the body. If supplied, it uses that token instead of `FACEBOOK_SYSTEM_USER_TOKEN`. This lets you paste the token you know works directly from the customer detail page and prove the rest of the pipeline (DB write, photo download) works — independent of the secret-storage problem.

### 2. `src/pages/FacebookPages.tsx`

In the System User Token card (admin-only), add a **"Diagnose System User Token"** button that calls the new `mode: "diagnose"` action and shows the result in a dialog:

- Stored token: `length=X · first=EAAB… · last=…XYZ · contains whitespace: yes/no`
- Token belongs to: App `123456789 (My App Name)` · User `987…` · Business `456…` · expires `…`
- Scopes: `pages_messaging, pages_show_list, …`
- Pages visible: `Explorer by SL (109469038735899)`, …
- Test PSID lookup: success / error body

This makes the mismatch obvious — if length differs from your real token, or app_id doesn't match `FACEBOOK_APP_ID`, that's the bug.

### 3. `src/pages/CustomerDetail.tsx`

Tiny addition next to the **Refresh from Facebook** button: a small dropdown / second button **"Refresh with custom token"** that opens an `<input type="password">` prompt, then calls the same endpoint with `override_token`. Used once to repopulate the customer immediately while you sort out the stored secret.

## Why this is the right next step

- Code can't fix a wrong secret value, but **comparing what's stored vs. what you tested** identifies the root cause in one click.
- The `override_token` path gives you a working Refresh today, so you can clear Unknowns without waiting on the System User config in Business Manager.
- No DB migration, no new secrets, no change to the webhook.

## Out of scope

- No changes to the webhook profile-fetch path (it's already correct — it'll start working as soon as the stored token is valid).
- No Business Manager / Facebook App config changes — those still need to happen on your side if `debug_token` confirms the token's `app_id` doesn't match this project's `FACEBOOK_APP_ID`.
