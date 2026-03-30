

# Filter Out Broken "Unknown" Messenger Customers & Pause Messenger Visibility

## Problem
The broken Facebook integration created hundreds of "Unknown" Messenger customers with no useful data. These clutter /chat, /customers, and /traffic, overwhelming employees.

## Approach
Add a **platform filter** across all three views so Messenger records are hidden by default until the integration is fixed. Also filter out "Unknown" named customers specifically.

## Changes

### 1. `src/hooks/useCustomersData.ts` — Exclude broken Messenger customers at query level
- Add a filter to exclude customers where `messenger_id IS NOT NULL` AND `messenger_name = 'Unknown'` AND `first_name IS NULL` (these are the broken records)
- This cleans up /customers and /chat simultaneously since both use this hook

### 2. `src/components/ChatConversationList.tsx` — Add platform filter toggle
- Add a filter bar with "All", "Telegram", "Messenger" chips (similar to existing "All" / "Awaiting Reply")
- Default to "Telegram" (or "All minus Unknown") so broken Messenger contacts are hidden
- Add the filter logic in `filteredByMode` or a new `filteredByPlatform` memo stage

### 3. `src/pages/Customers.tsx` — Add platform filter dropdown
- Add a platform filter dropdown (All / Telegram / Messenger) to the existing filter bar
- Default to showing all but filtering out broken "Unknown" Messenger records
- Apply filter client-side on the fetched data

### 4. `src/pages/Traffic.tsx` / `src/hooks/useTrafficData.ts` — Default platform filter to Telegram
- The traffic page already has a `platformFilter` dropdown — just change its default from `"all"` to `"telegram"`
- This hides Messenger traffic entries by default until the integration is fixed

### 5. `src/components/ChatConversationList.tsx` — Suppress "New customer" toasts for Unknown Messenger
- In the real-time customer INSERT handler, skip the toast notification if the new customer is a Messenger user with name "Unknown"

## Summary

| File | Change |
|------|--------|
| `src/hooks/useCustomersData.ts` | Filter out broken Messenger customers (Unknown name, no first_name) |
| `src/components/ChatConversationList.tsx` | Add platform filter chips, default hide broken records, suppress Unknown toasts |
| `src/pages/Customers.tsx` | Add platform filter, hide broken Unknown Messenger records |
| `src/pages/Traffic.tsx` | Default platform filter to "telegram" |

This is a **UI-only** change — no data is deleted. Once the Messenger integration is fixed, employees can switch filters back to "All" to see everything.

