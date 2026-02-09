

# Fix: Chat Preview Missing Messages and Stale Timestamps

## Problems Found

1. **"No messages yet" for some conversations**: The `fetchLastMessages` query fetches messages across ALL customers with no limit control. Supabase returns max 1,000 rows by default. Since messages are ordered by timestamp globally, customers whose last message falls outside the top 1,000 get nothing -- so they show "No messages yet" even though they have messages.

2. **Stale timestamp (e.g., "26/12" for Harold Than)**: The fallback timestamp comes from `customer.last_message_at`, which may only be updated when the customer sends a message, not when staff replies. If a customer's last activity was Dec 26 but staff replied recently, the preview still shows "26/12".

## Solution

### 1. Fix the fetchLastMessages query

Replace the current approach (fetch all messages, deduplicate in JS) with a database function that efficiently gets the latest message per customer using `DISTINCT ON`. This avoids the 1,000-row limit entirely.

**Create a database function:**
```sql
CREATE OR REPLACE FUNCTION get_latest_messages(p_customer_ids uuid[])
RETURNS TABLE(customer_id uuid, message_text text, message_type text, timestamp timestamptz)
AS $$
  SELECT DISTINCT ON (m.customer_id) 
    m.customer_id, m.message_text, m.message_type, m.timestamp
  FROM messages m
  WHERE m.customer_id = ANY(p_customer_ids)
  ORDER BY m.customer_id, m.timestamp DESC;
$$ LANGUAGE sql STABLE;
```

**Update `fetchLastMessages`** to call this RPC instead of the raw query.

### 2. Use the real latest timestamp (not just customer messages)

The timestamp displayed next to the preview will come from the `lastMessages` state (which includes employee messages) rather than `customer.last_message_at`. The `customer.last_message_at` field will only be used as a last resort fallback.

### 3. Update `customer.last_message_at` on employee messages too

This is a broader data issue. For now, relying on the RPC result (which includes all message types) solves the display problem without needing a schema change.

## Files Changed

| File | Change |
|------|--------|
| New migration | Create `get_latest_messages` database function |
| `src/components/ChatConversationList.tsx` | Replace `fetchLastMessages` to call the new RPC; update timestamp display to prefer RPC timestamp over `customer.last_message_at` |

## Technical Details

- The `DISTINCT ON (customer_id)` pattern returns exactly one row per customer -- the latest message -- regardless of how many total messages exist. No row limit issues.
- The RPC accepts a `uuid[]` parameter so it handles all customers in a single call.
- The timestamp priority becomes: real-time `lastMessages` state (updated via subscription) then RPC result then `customer.last_message_at` as final fallback.
- Message preview text truncation (30 chars) and formatting remain unchanged.

