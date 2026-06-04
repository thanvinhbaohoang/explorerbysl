
## Goal

Make the **Refresh from Facebook** button on `/customers/[id]` do exactly one thing: call

```
GET https://graph.facebook.com/v19.0/{PSID}?fields=name,first_name,profile_pic&access_token={FACEBOOK_SYSTEM_USER_TOKEN}
```

and return what Facebook responds. No page-token fallback, no extra fields, no multi-step retry logic.

## Why

The current handler tries the system user token first and then falls back through every page token, which is why the toast surfaces confusing per-page errors like "Application does not have the capability…" and "user must be administrator…". You confirmed the plain System User Token call works in the browser, so the button should mirror that call 1:1 — anything else just muddies the error you see.

The runtime error from the last click also shows the stored `FACEBOOK_SYSTEM_USER_TOKEN` is currently rejected by Graph (`code 190, subcode 465: application does not belong to system user's business`). That's a token/secret problem, not a code problem — but with the simplified handler the toast will say exactly that, so it's obvious what to fix next (rotate the secret to the working token you tested in the browser).

## Changes

### 1. `supabase/functions/backfill-profile-pics/index.ts` — `refreshSingleCustomer`

Replace the multi-source attempt logic with a single call:

- Load `customer.messenger_id` (and existing `messenger_name` / `page_id`) from DB.
- If `FACEBOOK_SYSTEM_USER_TOKEN` is missing → return `{ success: false, error: 'FACEBOOK_SYSTEM_USER_TOKEN not configured' }`.
- Fetch `https://graph.facebook.com/v19.0/{messenger_id}?fields=name,first_name,profile_pic&access_token={SYSTEM_USER_TOKEN}`.
- Parse the response body once and return it verbatim in the JSON result under `graph` so the UI can show exactly what Facebook said.
- On Graph error (`response.error` present or HTTP non-2xx) → return `{ success: false, customer_id, error: graph.error.message, graph }`. **No fallback to page tokens.**
- On success:
  - Derive `first_name` / `last_name` (split `name` if `first_name` missing — keep this small normalization so the stored row matches the rest of the app).
  - If `profile_pic` present, download via existing `downloadAndStorePhoto` and store in `chat-attachments`.
  - Update `customer` row: `messenger_name`, `messenger_profile_pic` (if downloaded), `updated_at`. Do **not** touch `page_id`, `locale`, or `timezone_offset` (those fields aren't requested anymore).
  - Return `{ success: true, customer_id, updated: true, name, profile_pic, graph }`.

Bulk mode (when no `customer_id` in body) and the Telegram branch stay untouched.

### 2. `src/pages/CustomerDetail.tsx` — `refreshMessengerProfile`

- Keep the existing button; simplify the toast handling:
  - Success → `Updated: {result.name}` (description: "Profile refreshed from Facebook").
  - Failure → show `result.error` directly as the toast description (this will now surface the real Graph message, e.g. the current token-validation error, instead of a wall of per-page failures).
- Still reload the customer on success.

## Out of scope

- No DB / schema changes.
- No webhook changes.
- No secret rotation done in code — if the toast reports the token is invalid, you'll update `FACEBOOK_SYSTEM_USER_TOKEN` via the secret tool separately.
