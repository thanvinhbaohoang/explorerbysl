

# Fix Profile Photos and Mobile Chat Layout

## Overview

This plan addresses two issues in the `/chat` page:
1. Profile photos not displaying for customers
2. Poor mobile experience with cramped side-by-side panels

---

## Issue 1: Profile Photos Not Showing

### Current Situation

The avatar component correctly uses `customer.messenger_profile_pic`, but most customers don't have profile pictures stored:

| Platform | Count | With Profile Pic |
|----------|-------|-----------------|
| Telegram | 60 | 0 |
| Messenger | 3 | 1 |

**Why photos are missing:**

- **Telegram**: The bot API doesn't include profile pictures in standard message updates. We need to explicitly call `getUserProfilePhotos` API.
- **Messenger**: Requires `pages_messaging` permission which may not be fully granted for all users.

### Solution: Fetch Telegram Profile Photos

**Backend Changes (telegram-bot edge function):**

When creating a new customer or when profile photo is missing, call Telegram's `getUserProfilePhotos` API:

```text
GET https://api.telegram.org/bot<token>/getUserProfilePhotos?user_id=<telegram_id>&limit=1
```

If photos exist, download the first photo using `getFile` and store it in Supabase Storage, then save the URL to `messenger_profile_pic` (or a new `profile_photo_url` column).

**Frontend Changes:**

Update the avatar to use a universal `profile_photo_url` field that works for both platforms:

```text
<AvatarImage src={customer.profile_photo_url || customer.messenger_profile_pic || undefined} />
```

Also, use initials as a fallback instead of a generic icon:

```text
<AvatarFallback className="bg-primary/10 text-primary font-medium">
  {getInitials(displayName)}
</AvatarFallback>
```

---

## Issue 2: Mobile Layout

### Current Problem

The chat page uses `ResizablePanelGroup` which shows both the conversation list and chat panel side-by-side. On mobile screens:
- Both panels are visible but cramped
- Even with the resize handle, there's not enough room
- The experience doesn't match standard chat apps

### Solution: Full-Screen Navigation Pattern

On mobile, use a full-screen switching pattern like Telegram/WhatsApp/Messenger:

**Mobile behavior:**
1. Show only the conversation list (full-screen)
2. When a conversation is selected, show the chat panel (full-screen) with a back button
3. Tapping the back button returns to the conversation list

**Desktop behavior:**
- Keep the current resizable side-by-side layout (unchanged)

### Implementation

**File: `src/pages/Chat.tsx`**

```text
import { useIsMobile } from "@/hooks/use-mobile";

const Chat = () => {
  const isMobile = useIsMobile();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Mobile: Full-screen switching between list and chat
  if (isMobile) {
    return (
      <div className="h-[calc(100vh-3.5rem)]">
        {selectedCustomer ? (
          <ChatPanel 
            customer={selectedCustomer} 
            onBack={() => setSelectedCustomer(null)}
          />
        ) : (
          <ChatConversationList 
            selectedId={null}
            onSelect={setSelectedCustomer}
          />
        )}
      </div>
    );
  }

  // Desktop: Keep resizable side-by-side layout
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <ResizablePanelGroup direction="horizontal">
        {/* ... existing desktop layout ... */}
      </ResizablePanelGroup>
    </div>
  );
};
```

**File: `src/components/ChatPanel.tsx`**

Add a back button in the header for mobile:

```text
interface ChatPanelProps {
  customer: Customer;
  onBack?: () => void;  // Optional - only provided on mobile
}

// In the header section:
<div className="flex items-center gap-3">
  {onBack && (
    <Button variant="ghost" size="icon" onClick={onBack} className="mr-1">
      <ArrowLeft className="h-5 w-5" />
    </Button>
  )}
  <Avatar className="h-10 w-10">
    {/* ... */}
  </Avatar>
  {/* ... */}
</div>
```

**File: `src/components/ChatConversationList.tsx`**

Improve the mobile layout with better touch targets and padding:

```text
// Larger touch targets on mobile
<button
  className={cn(
    "w-full flex items-center gap-3 p-3 md:p-3 rounded-lg hover:bg-muted/50",
    // Larger padding on mobile
    "sm:p-4"
  )}
>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Chat.tsx` | Add mobile detection, implement full-screen switching |
| `src/components/ChatPanel.tsx` | Add `onBack` prop and back button for mobile |
| `src/components/ChatConversationList.tsx` | Improve mobile touch targets and remove border on mobile |
| `supabase/functions/telegram-bot/index.ts` | Fetch and store Telegram user profile photos |

---

## User Experience After Changes

### Mobile
1. Open `/chat` - see full-screen conversation list
2. Tap a conversation - chat opens full-screen with back arrow
3. Tap back arrow - return to conversation list
4. Profile photos visible (when available), initials shown as fallback

### Desktop
- Same as current behavior with side-by-side panels
- Profile photos visible with initials fallback

---

## Technical Details

### Telegram Profile Photo API

```text
// Step 1: Get profile photos
GET https://api.telegram.org/bot<token>/getUserProfilePhotos?user_id=123456&limit=1

// Response:
{
  "ok": true,
  "result": {
    "total_count": 1,
    "photos": [[
      { "file_id": "...", "width": 160, "height": 160 },
      { "file_id": "...", "width": 320, "height": 320 }
    ]]
  }
}

// Step 2: Get file path
GET https://api.telegram.org/bot<token>/getFile?file_id=<file_id>

// Step 3: Download file
GET https://api.telegram.org/file/bot<token>/<file_path>
```

### Mobile Breakpoint

Using the existing `useIsMobile` hook which triggers at 768px width.

