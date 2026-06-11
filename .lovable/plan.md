# Surface Campaign/Ad Set/Ad IDs on Traffic Page

The IDs are already captured into `telegram_leads` (`utm_campaign_id`, `utm_adset_id`, `utm_ad_id`) by `Redirect.tsx` + `capture-traffic` edge function. They just aren't exposed in the Traffic page UI. This plan surfaces them.

## Changes

### 1. `src/hooks/useTrafficData.ts`
- Add `utm_campaign_id`, `utm_adset_id`, `utm_ad_id` to the `select(...)` string for the main traffic query so the values reach the page.
- (If filter-options query exists for these — only add if client wants dropdowns; for now just data fetch.)

### 2. `src/pages/Traffic.tsx`
- Extend the `TrafficData` interface with the three new fields (`utm_campaign_id`, `utm_adset_id`, `utm_ad_id`).
- **Tooltip (tracking info popover)**: add three new rows under the UTM section showing Campaign ID, Ad Set ID, and Ad ID when present (mono font, like the existing Ad ID row).
- **Table column**: add a new "Campaign / Ad Set / Ad" column (between Traffic Source and Created At) that renders the three IDs stacked compactly, each with a small label (e.g. `C: …  AS: …  A: …`) and truncated to keep the row tight. Empty values render as `-`.
- **CSV export**: add three new column definitions (`UTM Campaign ID`, `UTM Ad Set ID`, `UTM Ad ID`) to the `exportToCSV` columns array, alongside the existing UTM fields.

### 3. No backend / DB changes
- Schema already has the columns.
- `capture-traffic` already inserts them.
- `Redirect.tsx` already reads them from the URL.

## Out of scope
- No new filter dropdowns for these IDs (can add later if client wants).
- No Facebook API lookups — UTM-only as confirmed.
- No changes to Customer detail / Chat views.

## Verification
- Open `/redirect?utm_campaign_id=123&utm_adset_id=456&utm_ad_id=789&...` then complete the Telegram flow.
- Confirm new row appears on `/traffic` with the three IDs in the new column and tooltip.
- Export CSV and confirm the three new columns are populated.
