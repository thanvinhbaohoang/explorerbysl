

# Telegram Read Receipts - Investigation & Solution

## Understanding Telegram's Behavior

Telegram bots work differently from Messenger when it comes to read receipts:

| Status | Meaning | Bot Control? |
|--------|---------|--------------|
| Single tick (✓) | Sent to server | No |
| Double tick (✓✓) | Delivered to bot | No - automatic |
| Blue ticks / Eyes | Read | Not available for bots |

**Key Point**: In Telegram, when a user sends a message to a bot, the double tick (✓✓) appears immediately when your webhook returns `200 OK`. This is Telegram's design - it indicates "message delivered to the bot" not "message read by a human."

Unlike Messenger, Telegram bots **cannot** control when read receipts appear. The double tick simply means the webhook received the message successfully.

---

## What Your Customers See

When a customer sends a message to your Telegram bot:
1. They see **single tick** briefly (sent to Telegram servers)
2. They see **double tick** immediately after (delivered to your bot's webhook)
3. There is **no "read" status** for bot conversations - Telegram doesn't show this

The double tick is **not** a "seen" indicator for bots - it just means "delivered."

---

## Possible Causes of Customer Frustration

If customers are interpreting double ticks as "seen," this is a **perception issue** rather than a technical one. However, there are things we can do:

### Option A: Send "Typing" Indicator When Staff Opens Chat (Recommended)

When a staff member opens a conversation, we can send a "typing" action to let the customer know someone is looking at their message. This creates a clear visual signal that their message is being attended to.

```typescript
// Add to telegram-bot edge function
async function sendChatAction(chatId: number, action: 'typing' | 'upload_photo' | 'record_voice') {
  await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      action: action  // 'typing' shows "typing..." in chat
    }),
  });
}
```

**Effect**: When staff opens the chat, customer sees "typing..." for 5 seconds, indicating human attention.

### Option B: Send Acknowledgment Message

Optionally send a brief auto-message when staff views the chat, like "Your message has been received. Our team is reviewing it."

---

## Implementation Plan (Option A - Typing Indicator)

### Step 1: Add `sendChatAction` to Telegram Bot Edge Function

Add a new action handler to the edge function:

**File: `supabase/functions/telegram-bot/index.ts`**

```typescript
// Send chat action (typing indicator)
async function sendChatAction(chatId: number, action: string) {
  const response = await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      action: action,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Telegram API error (sendChatAction):", error);
  }
}
```

Add new action handler:

```typescript
// Handle mark_seen action (send typing indicator to show staff attention)
if (body.action === "mark_seen") {
  const { telegram_id } = body;
  
  if (!telegram_id) {
    return new Response(
      JSON.stringify({ error: "Missing telegram_id" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Send "typing" action to show customer that staff is viewing
    await sendChatAction(telegram_id, 'typing');
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
```

### Step 2: Call from Frontend When Staff Opens Chat

**File: `src/components/ChatConversationList.tsx`**

Modify `handleSelect` to trigger typing indicator for Telegram customers:

```typescript
const handleSelect = async (customer: Customer) => {
  const linkedIds = allLinkedPlatformsMap[customer.id]?.linkedIds || [];
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
  
  // Send typing indicator for Telegram customers
  if (customer.telegram_id) {
    try {
      await supabase.functions.invoke('telegram-bot', {
        body: {
          action: 'mark_seen',
          telegram_id: customer.telegram_id
        }
      });
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
    }
  }
  
  onSelect(customer);
};
```

### Step 3: Apply Same Logic to Other Entry Points

Update the same typing indicator logic in:
- `src/pages/Dashboard.tsx` - When opening chat dialog
- `src/pages/Customers.tsx` - When opening chat dialog

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/telegram-bot/index.ts` | Add `sendChatAction` function and `mark_seen` action handler |
| `src/components/ChatConversationList.tsx` | Call `mark_seen` when staff opens Telegram chat |
| `src/pages/Dashboard.tsx` | Call `mark_seen` when opening Telegram customer dialog |
| `src/pages/Customers.tsx` | Call `mark_seen` when opening Telegram chat dialog |

---

## Expected Outcome

After implementation:
- When staff opens a Telegram conversation, the customer sees "typing..." for 5 seconds
- This provides clear visual feedback that their message is being attended to
- The double tick behavior remains unchanged (Telegram limitation) but customers get meaningful "attention" signals

---

## Alternative: Education Approach

If you prefer not to add the typing indicator, the alternative is to educate customers that:
- Double ticks in bot chats mean "delivered to our system"
- A human response will follow when available

This could be added to the welcome message or an FAQ.

