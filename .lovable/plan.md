# Enrich Messenger ad clicks with adset_id & campaign_id

## Background
Facebook's Messenger referral webhook (click-to-Messenger ads, `m.me/?ref=`, ad postbacks) only sends:
- `referral.ad_id`
- `referral.ads_context_data` (post_id, ad_title, photo_url, video_url, product_id)
- `referral.ref`, `referral.source`

It does **not** send `adset_id` or `campaign_id`. Those must be fetched from the Marketing API using the `ad_id`:
```
GET /v21.0/{ad_id}?fields=adset_id,campaign_id,campaign{name},adset{name}
&access_token={FACEBOOK_SYSTEM_USER_TOKEN}
```
The existing system user token already has `ads_read`, so no new secrets are needed.

## Plan

### 1. Enrich on capture (`supabase/functions/messenger-webhook/index.ts`)
In `handleReferral`, after we resolve `adId` and before the `telegram_leads` insert:
- If `adId` is present, call Graph API `/{ad_id}?fields=adset_id,campaign_id,campaign{name},adset{name}` using `FACEBOOK_SYSTEM_USER_TOKEN`.
- Wrap in try/catch — failure must never block lead insert; log and continue.
- Map response into the insert payload:
  - `utm_ad_id` ← `ad_id` (mirror, so Messenger and UTM-tagged Telegram leads share a column)
  - `utm_adset_id` ← `adset_id`
  - `utm_campaign_id` ← `campaign_id`
  - Optionally fill `utm_campaign` with `campaign.name` if currently null.
- Add a small in-memory cache (Map keyed by `ad_id`) inside the function module so repeat clicks on the same ad in one warm instance don't re-hit Graph API.

### 2. New edge function: `backfill-messenger-ad-ids`
One-off enrichment for the rows already captured.
- Query `telegram_leads` where `platform = 'messenger'` AND `ad_id IS NOT NULL` AND (`utm_adset_id IS NULL` OR `utm_campaign_id IS NULL`).
- Page in 500-row batches, dedupe by `ad_id`, fetch each unique `ad_id` once from Graph API (small concurrency, ~5 in parallel), then `UPDATE telegram_leads` for all rows with that ad_id.
- Return JSON: `{ scanned, unique_ads, updated, failed }`.
- Admin-only: verify caller is `admin` via `has_role`.

### 3. UI: trigger button + display
- **System Settings page (Facebook tab)**: add a "Backfill ad attribution" button that invokes the new edge function and shows a toast with the result.
- **Traffic page**: already shows `utm_adset_id` / `utm_campaign_id` via the columns set up earlier — no change needed; they will start populating.
- **CustomerDetail page**: already added these fields in the previous turn — no change needed.

### 4. No schema change
`telegram_leads` already has `utm_adset_id`, `utm_campaign_id`, `utm_ad_id` columns.

## Caveats to flag to the user
- Lookup only works while the ad still exists in the ad account the system user can access. Deleted/archived ads may 404 — we'll leave those rows unenriched and log them.
- Click-to-WhatsApp / organic m.me links without an `ad_id` cannot be enriched — there's nothing to look up.
- The `FACEBOOK_SYSTEM_USER_TOKEN` must have access to the ad account that owns the ad; otherwise Graph returns the "application does not belong to system user's business" error already visible in your runtime logs. That token issue is separate and will also need fixing, otherwise both live enrichment and backfill will fail.

## Verification
- Trigger a fresh click-to-Messenger ad click → new `telegram_leads` row has `utm_adset_id` and `utm_campaign_id` populated.
- Run backfill once → counts in toast match a spot-check SQL `SELECT count(*) WHERE platform='messenger' AND ad_id IS NOT NULL AND utm_campaign_id IS NULL`.
- CustomerDetail and Traffic pages show the new IDs.
