
# Audible Notifications with Click-to-Navigate

## Overview

Add audible notification sounds for new messages and new customers, along with clickable toast notifications that navigate directly to the relevant chat conversation.

---

## Current State

The app already has:
- Real-time Supabase subscriptions for new messages and customers
- Visual toast notifications using `sonner`
- Toast notifications with "Refresh" action buttons

What's missing:
- Audio playback for notifications
- Direct navigation to specific customer chat from toast clicks
- User preference to enable/disable sound notifications

---

## Implementation Plan

### Part 1: Add Notification Sound Files

Add two notification sound files to the `public` folder:
- `public/sounds/notification.mp3` - Short, pleasant chime for new messages
- `public/sounds/new-customer.mp3` - Distinct sound for new customers

These can be royalty-free sounds or generated using a service like Pixabay or Freesound.

### Part 2: Create Notification Sound Utility

**New File: `src/lib/notification-sound.ts`**

```typescript
// Notification sound player with user preference support
const STORAGE_KEY = 'notification-sound-enabled';

let notificationAudio: HTMLAudioElement | null = null;
let newCustomerAudio: HTMLAudioElement | null = null;

// Preload sounds for instant playback
export const preloadNotificationSounds = () => {
  notificationAudio = new Audio('/sounds/notification.mp3');
  newCustomerAudio = new Audio('/sounds/new-customer.mp3');
  notificationAudio.volume = 0.5;
  newCustomerAudio.volume = 0.6;
};

export const isSoundEnabled = (): boolean => {
  return localStorage.getItem(STORAGE_KEY) !== 'false';
};

export const setSoundEnabled = (enabled: boolean) => {
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
};

export const playMessageNotification = () => {
  if (!isSoundEnabled()) return;
  if (notificationAudio) {
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(() => {});
  }
};

export const playNewCustomerNotification = () => {
  if (!isSoundEnabled()) return;
  if (newCustomerAudio) {
    newCustomerAudio.currentTime = 0;
    newCustomerAudio.play().catch(() => {});
  }
};
```

### Part 3: Add Sound Toggle to UserNav

**File: `src/components/UserNav.tsx`**

Add a sound toggle button in the user navigation dropdown:

```typescript
import { Volume2, VolumeX } from "lucide-react";
import { isSoundEnabled, setSoundEnabled } from "@/lib/notification-sound";

// In the dropdown menu:
<DropdownMenuItem onClick={() => {
  const newState = !isSoundEnabled();
  setSoundEnabled(newState);
  // Force re-render
}}>
  {soundEnabled ? (
    <>
      <Volume2 className="h-4 w-4 mr-2" />
      Sound On
    </>
  ) : (
    <>
      <VolumeX className="h-4 w-4 mr-2" />
      Sound Off
    </>
  )}
</DropdownMenuItem>
```

### Part 4: Update ChatConversationList with Sound and Navigation

**File: `src/components/ChatConversationList.tsx`**

Update the real-time subscriptions to:
1. Play notification sounds
2. Make toast clickable to navigate to chat

```typescript
import { useNavigate } from "react-router-dom";
import { playMessageNotification, playNewCustomerNotification } from "@/lib/notification-sound";

// In ChatConversationList component:
const navigate = useNavigate();

// For new messages subscription:
if (newMessage.sender_type === "customer") {
  playMessageNotification();
  
  toast.success("New message", {
    description: `${customerName} sent a message`,
    icon: <Bell className="h-4 w-4" />,
    action: {
      label: "View",
      onClick: () => {
        // Find the customer and select them
        const customer = customers.find(c => c.id === newMessage.customer_id);
        if (customer) {
          onSelect(customer);
        }
      },
    },
  });
}

// For new customers subscription:
const newCustomer = payload.new as Customer;
playNewCustomerNotification();

toast.success(`New customer: ${newCustomer.messenger_name || newCustomer.first_name || "Unknown"}`, {
  icon: <Bell className="h-4 w-4" />,
  duration: 8000, // Longer duration for new customers
  action: {
    label: "Chat Now",
    onClick: () => {
      refetch().then(() => {
        onSelect(newCustomer);
      });
    },
  },
});
```

### Part 5: Update Other Pages with Centralized Notifications

**Files to Update:**
- `src/pages/Customers.tsx` - Use sound utilities, add navigation
- `src/pages/Dashboard.tsx` - Use sound utilities, add navigation

Each page will:
1. Import sound utilities
2. Add click handler to navigate to `/chat` with the customer pre-selected

For pages that aren't the Chat page, the toast action will navigate:

```typescript
toast.success("New message", {
  description: `${customerName} sent a message`,
  action: {
    label: "Open Chat",
    onClick: () => {
      navigate(`/chat?customer=${customerId}`);
    },
  },
});
```

### Part 6: Handle URL Parameter in Chat Page

**File: `src/pages/Chat.tsx`**

Update to read customer ID from URL and auto-select:

```typescript
import { useSearchParams } from "react-router-dom";

const Chat = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const customerId = searchParams.get('customer');
  
  // Auto-select customer from URL parameter
  useEffect(() => {
    if (customerId && customers) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setSelectedCustomer(customer);
        // Clear the URL parameter
        setSearchParams({});
      }
    }
  }, [customerId, customers]);
  
  // ... rest of component
};
```

### Part 7: Preload Sounds on App Start

**File: `src/App.tsx`**

Add sound preloading when the app initializes:

```typescript
import { preloadNotificationSounds } from "@/lib/notification-sound";

// In App component, add useEffect:
useEffect(() => {
  preloadNotificationSounds();
}, []);
```

---

## Files to Create/Modify

| File | Changes |
|------|---------|
| `public/sounds/notification.mp3` | New - message notification sound |
| `public/sounds/new-customer.mp3` | New - new customer notification sound |
| `src/lib/notification-sound.ts` | New - sound playback utilities |
| `src/components/UserNav.tsx` | Add sound toggle option |
| `src/components/ChatConversationList.tsx` | Add sounds + navigation to toasts |
| `src/pages/Chat.tsx` | Handle URL parameter for direct navigation |
| `src/pages/Customers.tsx` | Add sounds + navigation to toasts |
| `src/pages/Dashboard.tsx` | Add sounds + navigation to toasts |
| `src/App.tsx` | Preload notification sounds |

---

## User Experience Flow

### New Message Notification
1. Customer sends message
2. Notification sound plays (if enabled)
3. Toast appears: "New message - [Customer Name] sent a message" with "View" button
4. Clicking "View" navigates to `/chat` and opens that conversation
5. If already on Chat page, it selects that customer directly

### New Customer Notification
1. New customer starts chat
2. Distinct notification sound plays (if enabled)
3. Toast appears: "New customer: [Name]" with "Chat Now" button (8 second duration)
4. Clicking "Chat Now" navigates to `/chat` and opens that conversation

### Sound Preferences
1. User can toggle sounds on/off from the user menu (top-right)
2. Preference is saved in localStorage
3. Persists across sessions

---

## Technical Notes

- Sounds are preloaded on app start for instant playback
- Audio playback uses `.catch(() => {})` to handle browsers that block autoplay
- Browser tab must have been interacted with for audio to play (browser restriction)
- Sound files should be short (under 1 second) and compressed for fast loading
- Default volume set to 50% for messages, 60% for new customers
