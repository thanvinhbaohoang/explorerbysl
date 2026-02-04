
# Improve Chat Notifications with Name, Message, and Correct Navigation

## Problem Summary

The current chat notification system has several issues:
1. **Toast shows generic message** - Only shows "New message" with "{customerName} sent a message" instead of showing the actual message content
2. **View button doesn't always work** - The customer might not be found in `allCustomers` if:
   - The customer is new and hasn't been loaded yet
   - The message comes from a linked customer ID (child account linked to parent)
3. **Linked customers not handled** - If a message comes from a linked customer, we need to find and navigate to the parent customer

## Solution Overview

Update the message notification toast to:
1. Show the customer name and truncated message preview in the toast
2. Handle cases where customer is not yet loaded by fetching them if needed
3. Properly resolve linked customers to their parent customer for navigation

## Implementation Steps

### Step 1: Improve Toast Content

Update the toast to show the message content:

```text
Before:
+-----------------------------------+
|  New message                      |
|  John sent a message       [View] |
+-----------------------------------+

After:
+-----------------------------------+
|  John                             |
|  Hello, I need help with...  [View] |
+-----------------------------------+
```

### Step 2: Handle Linked Customers

When a message arrives, check if it's from a linked customer and find the parent customer for navigation:

```text
Message from customer_id = linked_child_id
  -> Look up in allLinkedPlatformsMap to find parent
  -> Navigate to parent customer
```

### Step 3: Handle Missing Customers

If customer is not in `allCustomers`:
1. First try to find in `allLinkedPlatformsMap` (for linked customers)
2. If still not found, refetch data then navigate using URL parameter as fallback

## Technical Details

### File to Modify

| File | Changes |
|------|---------|
| `src/components/ChatConversationList.tsx` | Update the real-time message subscription to improve toast content and navigation |

### Changes in Detail

```typescript
// In the postgres_changes handler for messages:
(payload) => {
  const newMessage = payload.new as any;
  
  if (newMessage.sender_type === "customer") {
    playMessageNotification();
    
    // Update unread counts...
    
    // Find customer - check direct match or linked customers
    let customer = allCustomers.find(c => c.id === newMessage.customer_id);
    let parentCustomerId = newMessage.customer_id;
    
    // If not found directly, check if it's a linked customer
    if (!customer) {
      // Search through linkedPlatformsMap to find parent
      for (const [parentId, linkedInfo] of Object.entries(allLinkedPlatformsMap)) {
        if (linkedInfo.linkedIds.includes(newMessage.customer_id)) {
          customer = allCustomers.find(c => c.id === parentId);
          parentCustomerId = parentId;
          break;
        }
      }
    }
    
    // Get customer name
    const customerName = customer?.messenger_name || 
      `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 
      'New Customer';
    
    // Format message preview (truncate if too long)
    let messagePreview = newMessage.message_text || '';
    if (newMessage.message_type === 'photo') messagePreview = '📷 Photo';
    else if (newMessage.message_type === 'video') messagePreview = '🎥 Video';
    else if (newMessage.message_type === 'voice') messagePreview = '🎤 Voice message';
    else if (newMessage.message_type === 'document') messagePreview = '📎 Document';
    else if (messagePreview.length > 50) {
      messagePreview = messagePreview.substring(0, 50) + '...';
    }
    
    // Show improved toast
    toast.success(customerName, {
      description: messagePreview,
      icon: <Bell className="h-4 w-4" />,
      action: {
        label: isOnChatPage ? "View" : "Open Chat",
        onClick: () => {
          if (isOnChatPage && customer) {
            // Already on chat page with customer loaded - select directly
            onSelect(customer);
          } else {
            // Navigate with URL parameter - works even if customer not loaded
            navigate(`/chat?customer=${parentCustomerId}`);
          }
        },
      },
    });
  }
  // ... rest of handler
}
```

### Key Improvements

1. **Toast Title**: Shows customer name instead of "New message"
2. **Toast Description**: Shows actual message content (truncated) instead of generic text
3. **Linked Customer Resolution**: Searches `allLinkedPlatformsMap` to find parent customer
4. **Reliable Navigation**: Falls back to URL parameter navigation if customer not in memory, ensuring the Chat page's `useEffect` will handle the selection when data loads

## Expected Behavior

After implementation:

| Scenario | Toast Shows | View Action |
|----------|-------------|-------------|
| Known customer | "John" / "Hello, how are..." | Opens John's conversation |
| Known customer (photo) | "John" / "📷 Photo" | Opens John's conversation |
| Linked customer message | "Parent Name" / "Message..." | Opens parent's conversation |
| New customer (not loaded) | "New Customer" / "Message..." | Navigates via URL, loads when data ready |
