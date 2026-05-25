## Goal
Hide traffic rows that never linked to a customer ("Not Linked" — `user_id IS NULL` on `telegram_leads`) from both the Traffic table and the CSV export.

## Why
These rows have no associated customer and are noise — the client doesn't want them in the table or in exports.

## Changes

### 1. `src/hooks/useTrafficData.ts`
In `useTrafficData` queryFn, add a `.not("user_id", "is", null)` filter to both `countQuery` and `dataQuery` so unlinked leads are excluded from the table and the total count.

### 2. `src/pages/Traffic.tsx` — Export CSV handler (~line 350)
Add `.not('user_id', 'is', null)` to the `allTraffic` query so the CSV only includes linked rows. Update the success toast to reflect the filtered count.

### 3. (Optional) `useTrafficFilterOptions` in `useTrafficData.ts`
Leave as-is — filter dropdowns can still show all historical values; this avoids extra query complexity. Skip unless you want stricter filtering.

## Out of scope
- No DB schema or RLS changes
- No deletion of unlinked leads (they remain in DB for webhook recovery / debugging)
- No changes to the capture-traffic edge function
- No UI changes beyond the row count naturally shrinking

## Verification
- Open `/traffic` → confirm no "Not Linked" badges appear
- Total count badge matches new filtered total
- Export CSV → row count matches table total, no rows with empty Customer ID