

# Fix: Conversation List Not Updating on New Messages

## Root Cause Analysis

After reading `ChatConversationList.tsx` and `useCustomersData.ts`, I found two issues causing conversations not to pop to the top on new messages:

1. **Stale closure / frequent re-subscription**: The realtime subscription (line 163) includes `allCustomers` in its dependency array (line 249). Every time `allCustomers` changes (page loads, refetches), the subscription is torn down and recreated. During that gap, events can be missed entirely.

2. **`refetch()` doesn't reliably update the list**: When `refetch()` is called on new message, it refetches whatever page the user has scrolled to (not page 1). Even if it does refetch page 1, the customer's `last_message_at` in the database might not have been updated yet by the time the refetch query runs.

3. **No local `last_message_at` update**: While `lastMessages` state is updated (for preview text), the actual `customer.last_message_at` field in `allCustomers` is never updated locally. The sorting does use `lastMessages` timestamps as primary, but any stale closure or missed subscription event means the list stays frozen.

## Planned Changes

### `src/components/ChatConversationList.tsx`

| Change | Why |
|--------|-----|
| Use `useRef` for `allCustomers` inside subscription callbacks instead of the state directly in the dependency array | Prevents subscription from being recreated on every customer list change, eliminating the event-missing gap |
| Remove `allCustomers` from the realtime message subscription dependency array | Keeps a single stable subscription that doesn't reconnect |
| Add a polling fallback: refetch page 1 every 30 seconds | Catches any events missed by Realtime, ensuring the list eventually updates even if WebSocket drops silently |
| On new message, also update `allCustomers` locally to set `last_message_at` | Ensures sorting works even without relying on refetch |

### Technical Detail

```text
Current flow (broken):
  New message → subscription fires → updates lastMessages → calls refetch()
  BUT: subscription recreates on allCustomers change → misses events in gap
  AND: refetch() may fetch wrong page or race with DB update

Fixed flow:
  New message → stable subscription fires → updates lastMessages + allCustomers locally
  Polling fallback every 30s → refetches page 1 → catches anything missed
```

The key fix is using a ref (`allCustomersRef`) so the subscription callback can access the latest customers without needing `allCustomers` as a dependency, keeping the channel stable and persistent.

