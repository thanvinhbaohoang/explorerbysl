

# Filter Out "Unknown" Messenger Customers

## What We'll Do
Add a database-level filter to exclude broken Messenger customers (those with `messenger_name = 'Unknown'`) from all views: `/customers`, `/chat`, and `/traffic`. The records stay in the database untouched — they just won't appear in the UI until fixed.

## Changes

### 1. `src/hooks/useCustomersData.ts` — Filter Unknown from /customers
Add `.not("messenger_name", "eq", "Unknown")` to both the count query and data query. This ensures Unknown Messenger customers don't appear in the table or affect pagination counts.

### 2. `src/components/ChatConversationList.tsx` — Filter Unknown from /chat
Add the same `.not("messenger_name", "eq", "Unknown")` filter to:
- The main customer data fetch (via the `useCustomersData` hook call)
- The database search query in the search dropdown

### 3. `src/hooks/useTrafficData.ts` — Filter Unknown from /traffic
Add the filter to the traffic data query's customer join/lookup so Unknown customers don't appear in traffic tables.

### 4. `src/pages/Dashboard.tsx` — Filter Unknown from dashboard
Add the filter to the customer fetch query on the dashboard.

## What This Does NOT Do
- Does not delete any data
- Does not stop the webhook from creating new Unknown records (you can re-enable visibility once the integration is fixed)
- Telegram-only customers are unaffected (they don't have `messenger_name`)

| File | Change |
|------|--------|
| `src/hooks/useCustomersData.ts` | Add `.not("messenger_name", "eq", "Unknown")` to queries |
| `src/components/ChatConversationList.tsx` | Add Unknown filter to data fetch and search |
| `src/hooks/useTrafficData.ts` | Add Unknown filter to traffic queries |
| `src/pages/Dashboard.tsx` | Add Unknown filter to customer fetch |

