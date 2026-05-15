## Root cause

Two stacked problems:

1. **Stale stored page token.** The token you ran `debug_token` on has `pages_messaging`, but the token currently saved in `facebook_pages.access_token` for `Explorer by SL` (`page_id 109469038735899`) was issued *before* `pages_messaging` was enabled in the Login Configuration. Live webhook logs confirm: `getUserProfile()` for the latest sender is still rejected by Facebook with code 100 / subcode 33 — the classic "this token can't read this PSID" error. Reconnecting the page is required for the new token to take effect.

2. **App mode / Advanced Access.** Even with a fresh `pages_messaging` token, Facebook only returns first/last/profile_pic for a PSID when:
   - the App is in **Live Mode** AND `pages_messaging` has **Advanced Access** approved, OR
   - the sender is a person with a **role on the App** (Admin / Developer / Tester) while the App is in Development Mode.
   
   The sender you tested with is a personal profile that almost certainly does not have an App role, which is why it would still come back as Unknown even after reconnecting.

## Steps

### Step 1 — User actions on Facebook (no code)

1. In **System → Facebook Pages**, click **Reconnect** on Explorer by SL via the Business Login flow. This overwrites `facebook_pages.access_token` with a fresh token that carries `pages_messaging`.
2. In **Meta App Dashboard → App Roles → Roles**, add the personal Facebook account you’re testing with as **Tester** (and accept the invite from that account). This unblocks PSID resolution while the App is still in Development Mode.
3. Long-term, to support real public users: in **App Review → Permissions and Features**, request **Advanced Access** for `pages_messaging`, then switch the App to **Live Mode**.

### Step 2 — Code: add a "Diagnose token" button per page (small UI + 1 endpoint)

So we never have to guess again whether the *stored* token has the right scopes.

- **`supabase/functions/facebook-oauth/index.ts`** — add `GET /token-debug?page_id=...`:
  - look up `access_token` from `facebook_pages` for that `page_id`
  - call `https://graph.facebook.com/v21.0/debug_token?input_token={pageToken}&access_token={pageToken}`
  - return `{ scopes, granular_scopes, app_id, profile_id, expires_at, is_valid }`

- **`src/pages/FacebookPages.tsx`** — next to each page row (admin only), add a **Diagnose** button. On click, call the new endpoint and show a small popover/dialog with:
  - `is_valid`
  - whether `pages_messaging` is present in `scopes`
  - `expires_at`
  - link/hint: "If `pages_messaging` is missing, click Reconnect."

This makes the "is the stored token actually OK" question a one-click check instead of copy-pasting tokens.

### Step 3 — Code: backfill names after the fix

Once Step 1 is done and the diagnose button confirms `pages_messaging` is present on the stored Explorer by SL token:

- Run the existing `backfill-profile-pics` edge function from the Facebook Pages page. It already retries `getUserProfile()` for every customer where `messenger_name = 'Unknown'` using each active page's stored token, and updates `messenger_name` / `messenger_profile_pic` / `locale` / `timezone_offset` when Facebook now returns a profile.

No DB schema changes needed.

### Files touched

- `supabase/functions/facebook-oauth/index.ts` — add `GET /token-debug` endpoint.
- `src/pages/FacebookPages.tsx` — add per-page "Diagnose" button + result dialog (admin only).

### Out of scope

- No webhook ingestion changes (the webhook code already handles refresh on Unknown).
- No changes to `messenger-webhook` token logic.
- No changes to OAuth scopes or Login Configuration (user already has `pages_messaging` enabled there).
- Nothing here can bypass Facebook's App Mode / Advanced Access rules — Step 1.2 or 1.3 is mandatory for non-tester senders to resolve.

### Expected outcome

After Step 1: send a new test message → log shows `Profile fetch result: Success: <First> <Last>` and the new customer row has the real name. Old "Unknown" customers get fixed when you click the existing **Backfill Messenger names / profile pics** button.
