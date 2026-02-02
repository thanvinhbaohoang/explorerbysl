

# Fix Real-Time Message Sync for All Staff

## The Problem
When one employee sends a message, other employees viewing the same chat don't see it appear in real-time.

## The Simple Fix
Add one check before adding any message: **if the message ID already exists, skip it**. This prevents duplicates and ensures all new messages from other staff appear correctly.

## What Changes

### File 1: `src/hooks/useChatMessages.ts`
Update the real-time message handler (around line 875):

**Current logic:**
- Checks if there's a "pending" message
- If yes and it's from employee, replace the pending one
- Otherwise add the new message

**New logic:**
- First check: if message ID already exists in the list, skip (prevents duplicates)
- Then add the message normally
- The pending message replacement stays but only helps the sender's own UI

### File 2: `src/pages/Customers.tsx`
Apply the same simple fix to the real-time handler (around line 1475).

---

## Technical Summary

Both files get the same small change in their real-time handlers:

```typescript
setMessages(prev => {
  // Simple duplicate check - if already exists, skip
  if (prev.some(msg => msg.id === newMessage.id)) {
    return prev;
  }
  
  // Keep existing pending replacement logic for sender's UI
  if (newMessage.sender_type === "employee") {
    const pendingIndex = prev.findIndex(msg => msg.isPending);
    if (pendingIndex !== -1) {
      const updated = [...prev];
      updated[pendingIndex] = newMessage;
      return updated;
    }
  }
  
  // Add new message
  return [...prev, newMessage];
});
```

## Result
- All employees see messages from other staff in real-time
- No duplicate messages
- Sender still sees their message appear instantly (optimistic update)

