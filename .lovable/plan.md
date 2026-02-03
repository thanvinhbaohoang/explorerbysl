
# Fix Double Tick / Read Receipt Behavior

## Problem

Currently, customer messages are marked as "seen" (double tick) even when staff haven't actually opened the conversation. This happens because:

1. Messages are marked `is_read: true` immediately when loading messages (even for cached/background loads)
2. Real-time messages are auto-marked as read when they arrive, regardless of whether the chat is actually visible
3. Multiple pages (Dashboard, Customers, Chat) all trigger read status updates

This creates customer frustration when they see the double tick but don't receive a response.

---

## Solution

Only mark messages as read when a staff member **explicitly selects and views** a conversation. This requires:

1. **Remove automatic read marking from message loading** - Don't mark as read during `loadMessages` or `fetchMessages`
2. **Create explicit "mark as read" action** - Only triggered when staff actually opens a conversation
3. **Move read marking to conversation selection** - When a customer is selected in the chat list, mark their messages as read
4. **Remove auto-read from real-time handlers** - New messages should stay unread until the conversation is opened

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useChatMessages.ts` | Remove auto-read on load and real-time, add explicit `markMessagesAsRead` function |
| `src/pages/Customers.tsx` | Remove auto-read on load and real-time, call mark-read only when dialog opens |
| `src/pages/Dashboard.tsx` | Remove auto-read on load, mark read only when dialog is opened |
| `src/components/ChatConversationList.tsx` | Add database update when selecting a customer |
| `src/pages/Chat.tsx` | Ensure mark-as-read is called when customer is selected |

---

## Implementation Details

### 1. Update `useChatMessages.ts`

**Remove auto-read on load (lines 242-250):**
```typescript
// REMOVE this block - don't auto-mark as read on load
// if (offset === 0) {
//   await supabase
//     .from("messages")
//     .update({ is_read: true })
//     ...
// }
```

**Remove auto-read on real-time (lines 894-899):**
```typescript
// REMOVE this block - don't auto-mark incoming messages
// if (newMessage.sender_type === "customer") {
//   supabase.from("messages").update({ is_read: true })...
// }
```

**Add explicit mark-as-read function:**
```typescript
// New function to mark messages as read
const markMessagesAsRead = async () => {
  if (linkedCustomerIds.length === 0) return;
  
  await supabase
    .from("messages")
    .update({ is_read: true })
    .in("customer_id", linkedCustomerIds)
    .eq("sender_type", "customer")
    .eq("is_read", false);
};
```

**Return the new function from the hook:**
```typescript
return {
  // ... existing returns
  markMessagesAsRead,
};
```

### 2. Update `ChatConversationList.tsx`

**Add database update when selecting a customer:**
```typescript
const handleSelect = async (customer: Customer) => {
  const linkedIds = linkedPlatformsMap[customer.id]?.linkedIds || [];
  const allIds = [customer.id, ...linkedIds];
  
  // Update local state immediately
  setUnreadCounts(prev => {
    const updated = { ...prev };
    allIds.forEach(id => { updated[id] = 0; });
    return updated;
  });
  
  // Mark messages as read in database
  await supabase
    .from("messages")
    .update({ is_read: true })
    .in("customer_id", allIds)
    .eq("sender_type", "customer")
    .eq("is_read", false);
  
  onSelect(customer);
};
```

### 3. Update `Customers.tsx`

**Remove auto-read on load (lines 1246-1253):**
```typescript
// REMOVE this entire block from fetchMessages
```

**Remove auto-read on real-time (lines 1580-1586):**
```typescript
// REMOVE the supabase update call
```

**Mark as read only when dialog opens:**
```typescript
// In the function that opens the chat dialog
const openChatDialog = (customer: Customer) => {
  setSelectedCustomer(customer);
  setDialogOpen(true);
  
  // Mark messages as read when dialog opens
  markMessagesAsReadForCustomer(customer);
};
```

### 4. Update `Dashboard.tsx`

**Remove auto-read on load (lines 320-325):**
```typescript
// REMOVE from loadMessages function
```

**Mark as read only when dialog opens:**
```typescript
// Move the mark-as-read to openCustomerDialog function
const openCustomerDialog = (customer: Customer) => {
  setSelectedCustomer(customer);
  markMessagesAsReadForCustomer(customer);
};
```

---

## Flow After Fix

```text
Customer sends message
       ↓
Message saved with is_read = false
       ↓
Staff sees unread badge in conversation list
       ↓
Staff clicks on conversation
       ↓
handleSelect() called
       ↓
Messages marked is_read = true in database
       ↓
Customer sees double tick (read receipt)
```

---

## Benefits

1. **Accurate read receipts** - Customers only see "seen" when staff actually opened the chat
2. **Better customer experience** - No more frustration from perceived ignored messages
3. **Accurate unread counts** - Badges reflect true unread status
4. **Consistent behavior** - Same logic across Chat, Customers, and Dashboard pages

---

## Edge Cases Handled

1. **Linked customers** - All linked customer IDs are marked as read together
2. **Real-time messages** - New messages stay unread until conversation is opened
3. **Cached messages** - Loading from cache doesn't mark as read
4. **Multiple tabs** - Each tab independently marks read when conversation is opened
