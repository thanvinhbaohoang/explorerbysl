# Fix: chat opens scrolled to top instead of bottom

## Problem

When opening certain conversations from the chat list, the message view appears scrolled to the very top instead of the latest message at the bottom. The "Load older messages" infinite-scroll logic is incorrectly winning the race against the "jump to bottom on customer switch" logic.

## Root cause

In `src/components/ChatPanel.tsx`, the scroll-management `useLayoutEffect` (around lines 269-300) has two flaws:

1. **`prevCustomerIdRef` is advanced on every effect run**, even when the effect runs with the previous customer's messages still in `filteredMessages` (the `isLoadingMessages` flag and `filteredMessages` don't update in the same render). By the time the new customer's messages arrive, `customerChanged` is already false, so the "scroll to bottom" branch never runs.

2. **`handleScroll` (lines 437-444) can fire during the transition.** While the new conversation is mounting, the container momentarily has `scrollTop = 0`. The scroll handler interprets that as "user reached the top → load older", sets `isPrependingRef.current = true`, and the next effect run takes the prepend-anchor branch — pinning the view at the top.

## Fix

Edit only `src/components/ChatPanel.tsx`:

1. **Track an explicit "pending scroll to bottom" ref**, set when `customer.id` changes (in the existing `loadMessages` `useEffect`) and consumed only after messages for the new customer have actually rendered (`filteredMessages.length > 0` and `!isLoadingMessages`). Keep retrying until consumed instead of relying on `customerChanged` being true on exactly the right render.

2. **Clear stale prepend state on customer switch.** When `customer.id` changes, reset `isPrependingRef.current = false` and `prevScrollHeightRef.current = null` so any leftover state from the previous conversation can't hijack the next render.

3. **Guard `handleScroll`** so it ignores scroll events while a pending-scroll-to-bottom is in flight, and require `messageOffset > 0` (i.e. we've already loaded the first page) before triggering an auto-load. This prevents the "scrollTop=0 during mount" false positive.

4. **Only advance `prevCustomerIdRef`** once we've actually handled the new customer's messages (i.e. after the scroll-to-bottom has been performed), not on every effect tick.

No changes to `useChatMessages.ts`, no schema or backend changes. Behavior of manual "Load older messages" button and the user-initiated scroll-to-top prepend remain unchanged once a conversation is fully loaded.

## Verification

- Open several conversations in a row (short ones, long ones, ones with media). Each should land at the latest message.
- Scroll up in a long conversation, trigger auto-load older messages — scroll position should still anchor correctly.
- Click "Load older messages" button — same anchoring behavior preserved.
- Receive a new message while scrolled up — still does not yank to bottom; while scrolled near bottom, still auto-follows.
