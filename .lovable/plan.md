

# Fix: Pagination Count Not Reflecting Applied Filters

## Problem
When filters are applied on /customers and /traffic, the table still shows 267 pages because:
- **Customers**: Platform and search filters are applied **client-side** on already-paginated data (10 rows), but pagination uses the **unfiltered** database count (`totalCustomers`).
- **Traffic**: The `customerStatusFilter` is applied client-side after fetching, so `totalTraffic` doesn't reflect it.

## Solution
Move all filters to the **database query level** so the count and pagination are always accurate.

### 1. `src/hooks/useCustomersData.ts` — Accept filter parameters

- Add `searchTerm` and `platformFilter` parameters to the hook
- Apply them in the Supabase query (both the count query and the data query):
  - **Platform filter**: `telegram` → `.not('telegram_id', 'is', null).is('messenger_id', null)` / `messenger` → `.not('messenger_id', 'is', null)`
  - **Search filter**: `.or('first_name.ilike.%term%,last_name.ilike.%term%,username.ilike.%term%,messenger_name.ilike.%term%')`
- Update the `queryKey` to include the new filter params so React Query caches correctly

### 2. `src/pages/Customers.tsx` — Pass filters to hook, remove client-side filtering

- Pass `debouncedSearchTerm` and `customerPlatformFilter` to `useCustomersData()`
- Remove the `filteredCustomers` useMemo (no longer needed — DB returns pre-filtered data)
- Use `customers` directly in the table render
- Reset page to 1 when filters change (already done for search, add for platform filter)

### 3. `src/hooks/useTrafficData.ts` — Add `customerStatusFilter` to the DB query

- The `customerStatusFilter` ("new" vs "existing") depends on comparing `lead.created_at` with `customer.first_message_at`, which is computed after fetching. This cannot easily be moved to the DB query.
- Instead, when `customerStatusFilter` is active, fetch **all matching rows** (remove `.range()`) and apply the filter, then slice for the current page — OR use the filtered count for pagination.
- Simpler approach: compute `filteredTotal` from `filteredTrafficData.length` when `customerStatusFilter` is active and use that for pagination.

### 4. `src/pages/Traffic.tsx` — Fix pagination to use filtered count

- When `customerStatusFilter` is set, use `filteredTrafficData.length` as the basis for showing "no more pages" — but since this is a client-side filter on one page of data, the real fix is to adjust `totalTrafficPages` to reflect filtering.
- Since customer status can't easily be moved to DB, show a note that pagination may be approximate when status filter is active, OR fetch without pagination when status filter is active (data volume should be manageable).

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useCustomersData.ts` | Add `searchTerm` and `platformFilter` params, apply in DB query |
| `src/pages/Customers.tsx` | Pass filters to hook, remove client-side `filteredCustomers` memo |
| `src/hooks/useTrafficData.ts` | No change needed (filters already DB-side except customerStatus) |
| `src/pages/Traffic.tsx` | Use filtered count for pagination when customerStatusFilter is active |

