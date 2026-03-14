

# Add "Awaiting Response" Filter + Waiting Time Badges

## What We're Building

Two features to make sure `/start` messages from new clients never get missed:

1. **"Awaiting Response" filter tab** — a toggle at the top of the chat list that filters to only show conversations where no employee has ever replied. This surfaces all unresponded `/start` chats instantly.

2. **Waiting time badge** — a color-coded timer on each conversation showing how long the customer has been waiting since their last message (only when the last message is from the customer). Green < 1h, Yellow < 24h, Red > 24h.

## Technical Plan

### 1. Database: Add RPC function `get_unanswered_customer_ids`

Create a database function that returns customer IDs where no employee message exists. This is more efficient than fetching all messages client-side.

```sql
CREATE OR REPLACE FUNCTION public.get_unanswered_customer_ids()
RETURNS TABLE(customer_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT DISTINCT m.customer_id
  FROM messages m
  WHERE m.customer_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM messages m2
      WHERE m2.customer_id = m.customer_id
        AND m2.sender_type = 'employee'
    );
$$;
```

### 2. UI Changes (`src/components/ChatConversationList.tsx`)

**Filter tabs** — Add a simple toggle row below the search bar with two options: "All" and "Awaiting Reply". When "Awaiting Reply" is active, only show conversations matching the unanswered IDs set.

**Waiting time badge** — For each conversation row, compute waiting time from the last customer message timestamp. Display a small colored badge (e.g., "2h", "1d", "3d") next to the timestamp:
- Green: < 1 hour
- Yellow/Amber: 1h–24h  
- Red: > 24 hours

Only show the badge when the last message `senderType` is `"customer"` (i.e., the ball is in the staff's court).

### Files Changed

| File | Change |
|------|--------|
| **Migration SQL** | Add `get_unanswered_customer_ids` RPC function |
| **`src/components/ChatConversationList.tsx`** | Add filter state + tabs, fetch unanswered IDs, add waiting time badge to each row |

