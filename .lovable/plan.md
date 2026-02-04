
# Mobile-Friendly App Layout Improvements

## Overview

This plan addresses three key mobile UX issues:
1. Navigation is not responsive (shows all links on mobile, cramped)
2. Chat input area jumps/scrolls when keyboard appears on mobile
3. No search filter in the conversation list for quick customer access

---

## Part 1: Hamburger Menu Navigation

### Current State
The `AppLayout.tsx` shows all navigation links horizontally in the center, which becomes cramped on mobile screens.

### Solution
Add a hamburger menu using the existing `Sheet` component that slides in from the left on mobile devices.

**Changes to `src/components/AppLayout.tsx`:**

```text
Desktop (md and up):
+----------------------------------+
| Logo      [Nav Links]    UserNav |
+----------------------------------+

Mobile (below md):
+----------------------------------+
| [☰]  Logo              UserNav   |
+----------------------------------+
         ↓ (tap hamburger)
+--------+-------------------------+
| [Sheet]|                         |
| Chat   |                         |
| Custom |                         |
| Traffic|                         |
| ...    |                         |
+--------+-------------------------+
```

**Implementation:**
- Import `Sheet`, `SheetContent`, `SheetTrigger`, `SheetClose` from `@/components/ui/sheet`
- Add `Menu` icon from lucide-react
- Wrap mobile nav in a Sheet that slides from "left"
- Show hamburger button only on mobile (`md:hidden`)
- Keep existing horizontal nav visible on desktop (`hidden md:flex`)

---

## Part 2: Fixed Chat Input on Mobile

### Current Problem
On mobile devices, when the virtual keyboard opens, the chat input area can scroll out of view or jump around. This is a common iOS/Android issue with `100vh` calculations.

### Solution
Use `dvh` (dynamic viewport height) CSS units and ensure the input area is properly fixed at the bottom with correct z-indexing. Add mobile-specific viewport handling.

**Changes to `src/pages/Chat.tsx`:**
- Update mobile container height to use `h-[calc(100dvh-3.5rem)]` instead of `h-[calc(100vh-3.5rem)]`
- This uses the dynamic viewport height which accounts for mobile browser chrome and keyboard

**Changes to `src/components/ChatPanel.tsx`:**
- Change the main container to use `flex flex-col` with proper height inheritance
- Ensure messages area uses `flex-1 overflow-y-auto min-h-0` (already correct)
- Add `flex-shrink-0` to both header and input area (already present)
- Add safe-area padding for iOS notch: `pb-safe` or `padding-bottom: env(safe-area-inset-bottom)`

**Changes to `src/index.css`:**
Add CSS for safe area and mobile viewport:
```css
/* Mobile viewport fix */
@supports (height: 100dvh) {
  .h-dvh-safe {
    height: 100dvh;
  }
}

/* iOS safe area */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

---

## Part 3: Search Filter for Chat Conversations

### Current State
The `ChatConversationList` shows all customers with no way to quickly search or filter.

### Solution
Add a search input at the top of the conversation list that filters customers by name in real-time.

**Changes to `src/components/ChatConversationList.tsx`:**

```text
+---------------------------+
| Conversations             |
| 63 customers+             |
+---------------------------+
| [🔍 Search customers...]  |  ← NEW
+---------------------------+
| Customer 1                |
| Customer 2                |
| ...                       |
+---------------------------+
```

**Implementation:**
1. Add state for search query: `const [searchQuery, setSearchQuery] = useState("")`
2. Add search Input with Search icon from lucide-react
3. Filter customers before sorting:
```typescript
const filteredBySearch = useMemo(() => {
  if (!searchQuery.trim()) return allCustomers;
  const query = searchQuery.toLowerCase();
  return allCustomers.filter(customer => {
    const name = customer.messenger_name || 
      `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
      customer.username || '';
    return name.toLowerCase().includes(query);
  });
}, [allCustomers, searchQuery]);
```
4. Use `filteredBySearch` in the sorting logic instead of `allCustomers`
5. Add "X" clear button when search has text
6. Show "No results" message when search yields no matches

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/AppLayout.tsx` | Add hamburger menu using Sheet component for mobile navigation |
| `src/pages/Chat.tsx` | Update height calculation to use `dvh` for mobile |
| `src/components/ChatPanel.tsx` | Add safe-area padding for iOS devices |
| `src/components/ChatConversationList.tsx` | Add search input and filter functionality |
| `src/index.css` | Add utility classes for safe-area and dynamic viewport |

---

## Visual Summary

### Mobile Navigation (Before → After)
```text
BEFORE:                         AFTER:
+------------------------+      +------------------------+
| Logo [Chat][Cust][...]|      | [☰] Logo        [User] |
+------------------------+      +------------------------+
(cramped, hard to tap)          (clean, hamburger menu)
```

### Chat Search (New Feature)
```text
+---------------------------+
| Conversations       [X]   |
| 63 customers              |
+---------------------------+
| 🔍 Search customers...    |
+---------------------------+
| [Avatar] John Doe      2m |
|          Latest message...|
+---------------------------+
```

### Chat Input (Fixed)
```text
+---------------------------+
|      Messages Area        |
|      (scrollable)         |
|                           |
+---------------------------+
| [📎][🎤] Type message [→] |  ← Always visible, never jumps
+---------------------------+
  ↑ Safe area padding for iOS
```

---

## Expected Outcome

After implementation:
- **Mobile navigation**: Clean hamburger menu that opens a side sheet with all navigation links
- **Fixed chat input**: Input area stays pinned at the bottom even when keyboard is open
- **Search filter**: Quick access to find any customer by typing their name
- Better overall mobile experience matching native chat app UX
