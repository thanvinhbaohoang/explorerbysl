
# Multi-Media Carousel/Album Send Feature

## Overview
Enable sending multiple images/videos as a single grouped message (album) instead of individual messages. This creates a cleaner chat experience similar to native Telegram/Messenger galleries.

## Current Behavior
- Users can select multiple files in the chat interface
- Files are sent **one by one** as separate messages
- Each file triggers a separate API call to Telegram/Messenger

## Proposed Behavior
- Multiple images/videos are sent as a single **album/media group**
- On Telegram: Uses `sendMediaGroup` API (up to 10 items)
- On Messenger: Falls back to sequential sends (Messenger carousels require buttons/titles which aren't suitable for simple photo sharing)
- Caption appears only on the first item
- All items share a common `media_group_id` for UI grouping

---

## Implementation Plan

### 1. Database Changes
Add a column to group related media messages together for display.

**New Column:**
- `media_group_id` (TEXT, nullable) - Links messages that belong to the same album

### 2. Backend - Telegram Edge Function
Add a new `sendMediaGroup` function.

**New Action:** `send_media_group`
- Accepts an array of media items (up to 10)
- Uses Telegram's `sendMediaGroup` API
- Creates one database entry per media item, all sharing the same `media_group_id`

### 3. Backend - Messenger Edge Function
Add batch media handling (sequential with grouping).

**New Action:** `send_media_batch`
- Accepts an array of media items
- Sends each individually via existing `sendAttachment` function
- Creates database entries with shared `media_group_id`

### 4. Frontend - useChatMessages Hook
Add a new `sendMediaBatch` function.

**Changes:**
- New `sendMediaBatch(files: File[], caption?: string)` function
- Uploads all files to storage first
- Calls appropriate edge function with all URLs
- Creates optimistic UI messages grouped together

### 5. Frontend - ChatPanel & Customers
Update send handlers to use batch sending.

**Changes:**
- Replace sequential `sendMedia` calls with single `sendMediaBatch` call
- Update optimistic message display for grouped media

### 6. Frontend - Message Display
Update message bubbles to show grouped media as a gallery.

**Changes:**
- Detect messages with matching `media_group_id`
- Render as a grid/carousel instead of individual bubbles
- Show caption only once for the group

---

## Technical Details

### Telegram sendMediaGroup API
```typescript
async function sendMediaGroup(chatId: number, media: Array<{
  type: 'photo' | 'video',
  media: string,
  caption?: string
}>) {
  const response = await fetch(`${TELEGRAM_API}/sendMediaGroup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      media: media.map((item, i) => ({
        ...item,
        caption: i === 0 ? item.caption : undefined
      }))
    }),
  });
  return response.json();
}
```

### Media Group ID Generation
```typescript
const mediaGroupId = `mg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
```

### Message Display Grouping
```typescript
// Group consecutive messages with same media_group_id
const groupedMessages = useMemo(() => {
  const result = [];
  let currentGroup = null;
  
  for (const msg of filteredMessages) {
    if (msg.media_group_id && currentGroup?.media_group_id === msg.media_group_id) {
      currentGroup.items.push(msg);
    } else if (msg.media_group_id) {
      currentGroup = { media_group_id: msg.media_group_id, items: [msg] };
      result.push(currentGroup);
    } else {
      currentGroup = null;
      result.push(msg);
    }
  }
  return result;
}, [filteredMessages]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/telegram-bot/index.ts` | Add `sendMediaGroup` function and `send_media_group` action handler |
| `supabase/functions/messenger-webhook/index.ts` | Add `send_media_batch` action handler |
| `src/hooks/useChatMessages.ts` | Add `sendMediaBatch` function |
| `src/components/ChatPanel.tsx` | Update `handleSend` to use batch, add gallery display |
| `src/pages/Customers.tsx` | Update `sendMedia` to use batch, add gallery display |

### Database Migration
```sql
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS media_group_id TEXT;
```

---

## Limitations and Notes

1. **Telegram Limit**: Maximum 10 items per media group
2. **Mixed Types**: Telegram allows mixing photos and videos in one group
3. **Documents**: Documents cannot be grouped - will be sent individually
4. **Messenger**: True carousels require buttons/titles, so we'll use visual grouping only in the UI while sending sequentially
5. **Captions**: Only the first item shows a caption (Telegram API requirement)

---

## User Experience Flow

1. User selects 5 photos in chat
2. User types optional caption
3. User clicks Send
4. All 5 photos upload to storage
5. Single API call sends all as album
6. Chat displays as a grid/gallery view
7. Recipient sees album on Telegram/individual photos on Messenger (but grouped in our UI)
