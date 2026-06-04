## Goal

Add a per-customer **"Refresh from Facebook"** button on `/customers/[id]` that re-fetches the Messenger name + profile picture from Facebook for that one customer and updates the row immediately.

This bypasses the bulk backfill (which appears to be silently failing on certain rows) and gives you direct visibility per customer.

## Changes

### 1. `supabase/functions/backfill-profile-pics/index.ts`

Extend the existing function to accept an optional `customer_id` in the request body. When provided:
- Skip the bulk query and process only that single customer's row.
- Use the same logic already in place: try `FACEBOOK_SYSTEM_USER_TOKEN` first (the call you confirmed works), then fall back to per-page tokens.
- Return a clear per-customer result: `{ customer_id, updated: true/false, name, profile_pic, source: 'system_user_token' | 'page_token' | null, error?: '<graph error body>' }` so the UI can show exactly what happened (and surface the Graph error if Facebook rejects the PSID).

### 2. `src/pages/CustomerDetail.tsx` — Messenger Account card

Add a small **"Refresh from Facebook"** button (with `RefreshCw` icon) in the Messenger Account card header, next to the card title — only shown for accounts that have a `messenger_id`.

On click:
1. Call `supabase.functions.invoke('backfill-profile-pics', { body: { customer_id: account.id } })`.
2. Show a toast with the outcome:
   - Success → "Updated to {new name}" (or "Profile picture refreshed" if name was already set).
   - Failure → "Facebook returned: {error message}" so you can see *why* it failed (token issue, PSID not visible to the system user, etc.).
3. Reload the customer data (re-run the existing fetch) so the new name + photo appear right away without a page refresh.

## What this won't change

- No DB schema changes, no new secrets.
- No change to the bulk button on `/facebook-pages` — it stays for batch use.
- The webhook's auto-resolution on new incoming messages is unchanged.

## Why this should expose the real problem

Right now the bulk backfill silently logs failures to edge function logs. Per-customer mode surfaces the exact Graph API error in a toast, so if the System User token still can't see a particular PSID, you'll see the specific reason (e.g. "user has blocked the page", "PSID does not belong to a page assigned to this system user") and we can address it.
