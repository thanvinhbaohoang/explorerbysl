# Capture Facebook `ad_id` as a first-class column

## Root cause
Facebook's referral webhook puts `ad_id` at the **top level of `referral`**, not inside `ads_context_data`:

```json
"referral": {
  "type": "OPEN_THREAD",
  "ad_id": "120245457533310078",
  "source": "ADS",
  "ads_context_data": { "post_id": "...", "ad_title": "...", "video_url": "..." }
}
```

`supabase/functions/messenger-webhook/index.ts` (line 910) only persists `ads_context_data`, so `ad_id` is dropped. The client wants `ad_id` as a dedicated column so they can filter/sort/export it in the Traffic CSV.

## Changes

### 1. DB migration — add column
`telegram_leads.ad_id text` (nullable), plus an index for filtering:

```sql
ALTER TABLE public.telegram_leads ADD COLUMN ad_id text;
CREATE INDEX telegram_leads_ad_id_idx ON public.telegram_leads (ad_id) WHERE ad_id IS NOT NULL;
```

### 2. Edge function — `supabase/functions/messenger-webhook/index.ts` (`handleReferral`)
Persist `referral.ad_id` into the new column on insert:

```ts
ad_id: referral.ad_id || null,
```

Also include `ad_id` in the dedupe lookup as the strongest key (preferred over `messenger_ref` when both ad_id and ref are absent/duplicated): if `referral.ad_id` is present, dedupe by `user_id + ad_id` within 10 min in addition to existing `messenger_ref` check.

### 3. Frontend — `src/hooks/useTrafficData.ts`
- Add `ad_id: string | null` to the `TrafficData` interface.
- Add `ad_id` to the `select(...)` projection on `telegram_leads`.
- Add a new filter param `adIdFilter` and an `ad_id` value lookup in `useTrafficFilterOptions` (distinct ad_ids).
- Apply `.eq("ad_id", adIdFilter)` when set, and add `ad_id.ilike.%term%` to the global search OR clause.

### 4. Frontend — `src/pages/Traffic.tsx`
- Add an "Ad ID" filter dropdown next to Ad Title / Post ID, fed by the new filter options.
- In the expanded "Facebook Ad Context" block, read `traffic.ad_id` directly (column) instead of `messenger_ad_context.ad_id`, so historical rows that only have the column will still display.
- CSV export columns: add an "Ad ID" column mapping to `traffic.ad_id`.

### 5. CSV export
Confirm `src/lib/csv-export.ts` is used by Traffic; add `{ key: "ad_id", header: "Ad ID" }` to the column list passed to `exportToCSV` from the Traffic page so clients can filter the file by Ad ID in Excel.

## Verification
1. Apply migration → column appears.
2. After deploy, click a click-to-Messenger ad → send a message → confirm new `telegram_leads` row has `ad_id` populated.
3. `/traffic` shows new "Ad ID" filter; expanded row shows Ad ID.
4. Export CSV → "Ad ID" column present and populated for ad-sourced rows, empty for direct messages.
5. Direct (non-ad) Messenger users are unaffected (ad_id stays null).

## Out of scope
- No backfill of historical rows (cannot recover `ad_id` from `ads_context_data` alone). New leads from deploy onward carry `ad_id`. A follow-up can re-derive `ad_id` from `post_id` via the Marketing API if needed.
- Telegram traffic unchanged.

## Files touched
- migration: add `telegram_leads.ad_id` column + index
- `supabase/functions/messenger-webhook/index.ts`
- `src/hooks/useTrafficData.ts`
- `src/pages/Traffic.tsx`
