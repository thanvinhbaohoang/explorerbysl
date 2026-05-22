## Goal

Remove the 9 always-empty columns from `telegram_leads` and clean up every UI / code reference so the Traffic table only shows columns that actually carry data.

## Confirmed dead columns (0 of 2,336 rows populated)

`campaign_id`, `campaign_name`, `adset_id`, `adset_name`, `ad_id`, `ad_name`, `utm_campaign_id`, `utm_adset_id`, `utm_ad_id`.

Kept (populated): `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `facebook_click_id`, `messenger_ref`, `post_id`, `ad_title`, `messenger_ad_context`, `referrer`.

## Steps

### 1. Migration

```sql
ALTER TABLE public.telegram_leads
  DROP COLUMN campaign_id,
  DROP COLUMN campaign_name,
  DROP COLUMN adset_id,
  DROP COLUMN adset_name,
  DROP COLUMN ad_id,
  DROP COLUMN ad_name,
  DROP COLUMN utm_campaign_id,
  DROP COLUMN utm_adset_id,
  DROP COLUMN utm_ad_id;
```

### 2. Code cleanup

- `supabase/functions/capture-traffic/index.ts` — remove `utm_adset_id`, `utm_ad_id`, `utm_campaign_id` from the insert payload.
- `src/pages/Telegram.tsx` — remove the `searchParams.get("utm_adset_id" | "utm_ad_id" | "utm_campaign_id")` reads and the fields they're passed into.
- `src/hooks/useTrafficData.ts` — remove the three `utm_*_id` fields from `TrafficData` and from the `select(...)` column list.
- `src/pages/Traffic.tsx` —
  - Remove the 9 entries from the CSV export config (`UTM Campaign ID`, `UTM Adset ID`, `UTM Ad ID`, `Campaign ID`, `Campaign Name`, `Adset ID`, `Adset Name`, `Ad ID`, `Ad Name`).
  - Remove the three `utm_*_id` blocks in the row-detail panel.
  - Drop the three fields from the local `TrafficData` interface.
- `src/pages/Dashboard.tsx` — drop the three `utm_*_id` fields from the interface, the `select(...)` list, the two mapping spots, and the three detail-panel blocks.
- `src/hooks/useCustomersData.ts` — drop `campaign_name`, `ad_name`, `adset_name` from the `lead_source` type and from the `select(...)`.
- `src/pages/Customers.tsx` — drop those three fields from the local interface and remove the two render blocks (`campaign_name`, `ad_name`) that always render nothing today.

### 3. Verify

After build, re-open Traffic: the table and CSV export should no longer show the 9 columns; row detail panel should no longer show empty UTM ID rows.

## Out of scope

- No new Marketing API enrichment (would be the only way to populate real campaign/adset/ad names — separate feature).
- No change to UTM landing-page redirect logic.
- No change to `messenger_ad_context`, `ad_title`, `post_id`, or `messenger_ref` capture.
