
# Chat Improvements: Media Grouping and Text Formatting

## Summary of Issues

The user has identified three main problems with the chat behavior:

1. **Customer-sent images appear as separate messages** instead of grouped albums
2. **Staff-sent images are not rendering as a single grouped post** - they appear as individual messages
3. **Text formatting (line breaks, bullet points)** is not preserved in messages

---

## Root Cause Analysis

### Issue 1: Customer Images Not Grouped

**Problem**: When Telegram sends a media group (album), each photo/video comes as a separate webhook call with a shared `media_group_id`. The current `saveMessage` function in the Telegram edge function does not capture this `media_group_id` from the incoming message.

**Code Location**: `supabase/functions/telegram-bot/index.ts` lines 362-565

**Current behavior**:
- Photo messages are saved without `media_group_id`
- Video messages are saved without `media_group_id`  
- The frontend `MediaGroupBubble` component can already group messages with the same `media_group_id`, but this field is never set for incoming customer messages

**Same issue in Messenger**: The messenger webhook only captures the first attachment (`message.attachments[0]`) and ignores additional attachments sent together.

### Issue 2: Staff-Sent Images Appearing Separately

**Problem**: Looking at the code, the backend correctly:
- Uses Telegram's `sendMediaGroup` API
- Saves each item with a shared `media_group_id`

However, the frontend grouping logic in `ChatPanel.tsx` may have issues with how it processes the grouped messages. The current implementation builds groups correctly but there may be timing issues with real-time updates where individual messages arrive before they're all saved with the same `media_group_id`.

### Issue 3: Line Breaks Not Preserved

**Problem**: The chat input uses a single-line `<Input>` component instead of a `<Textarea>`. Single-line inputs:
- Only allow single line of text
- Submit on Enter key (no shift+enter for new lines)
- Cannot preserve multi-line formatting

The message display (`whitespace-pre-wrap`) is correct and would show line breaks if they were present in the data.

---

## Implementation Plan

### Step 1: Capture Customer Media Groups (Telegram)

**File**: `supabase/functions/telegram-bot/index.ts`

Update the `saveMessage` function to include `media_group_id`:

```text
// Add at the start of saveMessage:
const mediaGroupId = message.media_group_id || null;

// Include in all insert calls:
{
  ...existing fields,
  media_group_id: mediaGroupId,
}
```

This applies to:
- Photo message insert (line 540-554)
- Video message insert (line 439-452)
- Video note insert (line 474-487)

### Step 2: Capture Multiple Attachments (Messenger)

**File**: `supabase/functions/messenger-webhook/index.ts`

Update the `handleMessage` function to:
1. Loop through all attachments instead of just the first
2. Generate a `media_group_id` if multiple attachments exist
3. Save each attachment as a separate message with the shared group ID

### Step 3: Replace Input with Textarea

**Files**: 
- `src/components/ChatPanel.tsx`
- `src/pages/Customers.tsx`

Replace the single-line `<Input>` with `<Textarea>`:

```text
Before:
<Input
  placeholder={...}
  value={replyText}
  onChange={(e) => setReplyText(e.target.value)}
  onKeyPress={handleKeyPress}
  ...
/>

After:
<Textarea
  placeholder={...}
  value={replyText}
  onChange={(e) => setReplyText(e.target.value)}
  onKeyDown={handleKeyDown}  // Change to support Shift+Enter
  className="min-h-[40px] max-h-[120px] resize-none flex-1"
  rows={1}
  ...
/>
```

Also update key handler:
- `Enter` alone: Send message
- `Shift+Enter`: Insert new line

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/telegram-bot/index.ts` | Add `media_group_id` capture from incoming messages |
| `supabase/functions/messenger-webhook/index.ts` | Handle multiple attachments with shared group ID |
| `src/components/ChatPanel.tsx` | Replace Input with Textarea, update key handler |
| `src/pages/Customers.tsx` | Replace Input with Textarea, update key handler |

---

## Technical Details

### Telegram Media Group ID

When a user sends multiple photos as an album in Telegram, each message object contains:
- `media_group_id`: A unique string (e.g., "13462567890123456")
- This ID is the same for all photos in the album

### Messenger Multiple Attachments

Messenger sends multiple attachments in a single webhook as:
```text
message.attachments = [
  { type: 'image', payload: { url: '...' } },
  { type: 'image', payload: { url: '...' } },
  ...
]
```

### Textarea Key Handling

```text
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
  // Shift+Enter will naturally create a new line
};
```

---

## Expected Results After Changes

1. **Customer albums grouped**: Photos/videos sent by customers as albums will appear as a single grouped message with grid layout
2. **Staff albums grouped**: Multiple photos sent by staff will render as a single carousel/grid
3. **Text formatting preserved**: Staff can type multi-line messages with bullet points and sections that display correctly

---

## Edge Cases Handled

- **Single photo**: Still displays normally (no grouping needed)
- **Mixed media + documents**: Documents sent separately (already working)
- **Empty text with media**: Caption field remains optional
- **Long messages**: Textarea has max-height with scroll
