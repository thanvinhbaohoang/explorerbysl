

# Fix Chat Conversation List - Newer Messages on Top

## Problem

When clicking on a conversation with unread messages, the customer entry jumps or disappears because:
1. Data is sorted by `created_at` from the database, not `last_message_at`
2. The local sorting uses stale `customer.last_message_at` instead of the real-time `lastMessages` state

## Solution

Two simple changes to ensure newer messages stay on top:

### Change 1: Database Query Order

**File: `src/hooks/useCustomersData.ts` (line 62)**

```typescript
// Before
.order("created_at", { ascending: false })

// After  
.order("last_message_at", { ascending: false, nullsFirst: false })
```

This ensures the initial page load already has the most recently active customers first.

---

### Change 2: Use Real-Time Timestamps for Sorting

**File: `src/components/ChatConversationList.tsx` (lines 302-319)**

Update the `sortedCustomers` memo to use `lastMessages` state (updated in real-time) instead of only `customer.last_message_at`:

```typescript
const sortedCustomers = useMemo(() => {
  return [...filteredBySearch].sort((a, b) => {
    const linkedIdsA = allLinkedPlatformsMap[a.id]?.linkedIds || [];
    const linkedIdsB = allLinkedPlatformsMap[b.id]?.linkedIds || [];
    const aUnread = [a.id, ...linkedIdsA].reduce((sum, id) => sum + (unreadCounts[id] || 0), 0);
    const bUnread = [b.id, ...linkedIdsB].reduce((sum, id) => sum + (unreadCounts[id] || 0), 0);
    
    // Unread first
    if (aUnread > 0 && bUnread === 0) return -1;
    if (bUnread > 0 && aUnread === 0) return 1;
    
    // Get latest timestamp from real-time lastMessages state
    const getLatestTime = (customerId: string, linkedIds: string[]): number => {
      const allIds = [customerId, ...linkedIds];
      let latest = 0;
      allIds.forEach(id => {
        const msg = lastMessages[id];
        if (msg) {
          const time = new Date(msg.timestamp).getTime();
          if (time > latest) latest = time;
        }
      });
      return latest;
    };
    
    // Use real-time timestamps, fall back to database value
    const aTime = getLatestTime(a.id, linkedIdsA) || 
                  (a.last_message_at ? new Date(a.last_message_at).getTime() : 0);
    const bTime = getLatestTime(b.id, linkedIdsB) || 
                  (b.last_message_at ? new Date(b.last_message_at).getTime() : 0);
    
    return bTime - aTime;
  });
}, [filteredBySearch, unreadCounts, allLinkedPlatformsMap, lastMessages]); // Added lastMessages
```

---

## Summary

| File | Change |
|------|--------|
| `src/hooks/useCustomersData.ts` | Line 62: Change order from `created_at` to `last_message_at` |
| `src/components/ChatConversationList.tsx` | Lines 302-319: Use `lastMessages` state for real-time sorting, add to dependencies |

## Result

- **Initial load**: Customers sorted by most recent message
- **New message arrives**: Conversation moves to top immediately (via real-time state)
- **Clicking conversation**: No jumping - position stays stable based on message time
- **Multi-user**: Each user's view updates independently via Supabase real-time

