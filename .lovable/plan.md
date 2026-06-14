# Keep user on their current chat page when new messages arrive

## Problem
In `src/components/ChatConversationList.tsx`, whenever a new message arrives for a customer that isn't on the currently loaded page, `jumpToTopAndRefresh()` runs and calls `setPage(1)`. So if the user is browsing page 4–5 of older conversations, a single incoming message yanks them back to page 1.

## Fix
Remove the forced page reset. New messages should update state silently in the background; the user keeps their place.

### Changes in `src/components/ChatConversationList.tsx`

1. **Replace `jumpToTopAndRefresh`** so it no longer changes the page.
   - Keep a lightweight "refresh page 1 in the background" behavior by invalidating/refetching the page‑1 query via `queryClient` (so when the user does navigate back to page 1, it's fresh), but never call `setPage(1)`.
   - Also refresh unread counts so the toast/badge stays accurate.

2. **Update the message INSERT subscription handler** (around line 294):
   - Still detect "unknown conversation" (customer not in the loaded page and not in linked map).
   - Instead of jumping to page 1, just trigger the background page‑1 refresh above. The toast notification already lets the user click "View" to jump straight to that customer.

3. **Update the customer INSERT subscription handler** (around line 370):
   - Replace the unconditional `refetch()` (which refetches the current page and can disrupt the user's view as new customers shuffle ordering) with the same background page‑1 refresh. Only refetch the current page if the user is actually on page 1.
   - Keep the toast + "Chat Now" action (it already navigates by customer id, so it works regardless of which page the user is on).

4. **Keep the 30s polling fallback** but make it only refetch when the user is on page 1, to avoid older pages reshuffling under them. (Manual pagination still works; React Query cache for other pages stays warm via the existing prefetch loop.)

5. **Leave alone**: the clamp‑page effect (still useful if the total shrinks), prefetching of next 4 pages, search behavior, and the unread/last-message overlays (those are keyed by customer id, so they update correctly even for customers not on the current page).

## Out of scope
- No changes to data fetching hook, schema, or webhook/edge functions.
- No UI/visual changes.
- Mobile vs desktop layout untouched.

## Verification
- Navigate to page 4 of the chat list, send a test message from another account; the list should stay on page 4, a toast should appear, and clicking "View" should still open the right conversation.
- Returning to page 1 should show the bumped conversation at the top (background refresh applied).
