## Goal
Make the **"Refresh from Facebook"** button on the customer detail page use the **page's own access token** (looked up from `customer.page_id`) — same fix we just applied to the webhook. Right now it only tries the System User Token, which is exactly why you're seeing `(#3) Application does not have the capability to make this API call` for the Cambodia-page PSID `8269901109776991`.

## Do we need a new "source page" column?
**No.** `customer.page_id` already exists and is populated:
- The webhook sets `page_id: entry.id` whenever it creates a customer (lines 618, 702, 849, 1609 in `messenger-webhook/index.ts`).
- The same webhook auto-heals `page_id` for any existing customer whose row was missing it (line 596-599).
- Our previous diagnosis confirmed all 25 Cambodia customers + 104 ExplorerBySL customers already have the correct `page_id` set.

So we just need to **use** that column when refreshing.

## Fix — single edge function change
File: `supabase/functions/backfill-profile-pics/index.ts`, function `refreshSingleCustomer` (the path hit when the UI passes `customer_id`).

Rewrite the token-selection logic to mirror the webhook order:

1. Load the customer row (already done) — keep the existing `select` and also rely on `page_id`.
2. **Primary attempt:** if `customer.page_id` is set, look up the matching row in `facebook_pages` and call Graph with **that page's access_token**. Log `via=page_token page=<id>`. If it returns a profile, use it.
3. **Fallback:** only if step 2 fails (no page_id, no matching active page row, revoked token, or Graph error), fall back to the **System User Token** via the existing `getSystemUserToken()` helper. Log `via=system_user_token` and the same `request`/`token` debug block we already return.
4. **Last-resort sweep:** if both fail and the customer has no `page_id`, try each active page's token in turn (cheap — usually 2–3 pages) so a mis-tagged customer can still self-heal. First success wins and we also update `customer.page_id` to the page that resolved it (mirrors the bulk-backfill auto-heal already present on line ~200).
5. Keep the same response shape (success/error/graph/request) so the existing CustomerDetail console logs and toast still work — just include a new field `token_used: 'page_token' | 'system_user_token' | 'page_sweep'` for clarity in the dev console.

No UI changes, no schema migration, no new secrets, no changes to the bulk backfill code path.

## Why this resolves the current error
The error `(#3) Application does not have the capability` is Graph's response when the SUT's app cannot read PSIDs for the page that PSID belongs to. The page's own token (which you've curl-tested successfully) does have that capability. By trying it first, the refresh button will succeed for the Cambodia customers without any token reconfiguration.

## Verification
1. After deploy, open the failing customer `cfc2fe04-1b43-423c-82cb-d021bbfadd7d`, click **Refresh from Facebook**.
2. Toast shows "Profile refreshed from Facebook"; the avatar and name update.
3. Edge-function logs show `[refreshSingleCustomer] via=page_token page=103275792431920 psid=8269901109776991 success`.
4. Repeat for an ExplorerBySL customer to confirm no regression.
5. (Optional) Trigger the bulk backfill button — the 25 stuck Cambodia rows should fill in via the same logic since the function will deploy together; bulk path will also benefit because it already tries page tokens after SUT.

## Out of scope
- Schema changes (none needed — `customer.page_id` already exists).
- Touching the webhook (already fixed in the previous turn).
- Changing the bulk backfill loop's primary order; only `refreshSingleCustomer` flips, since that's what the UI button hits.

## File touched
- `supabase/functions/backfill-profile-pics/index.ts` — rewrite `refreshSingleCustomer` per the four-step ordering above.
