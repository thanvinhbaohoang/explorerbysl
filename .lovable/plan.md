

## Diagnosis

Looking at `ChatConversationList.tsx`, the `unreadCounts` state is populated by:
1. An initial `fetchUnreadCounts()` call on mount
2. A realtime subscription that increments counts when new messages arrive **while the component is mounted**

**The bug**: When the user is on `/customers`, `ChatConversationList` is unmounted, so its realtime subscription isn't running. When they navigate to `/chat`, the component mounts and calls `fetchUnreadCounts()` — but this likely only fetches unread counts for the currently loaded page of customers (the first ~30). Any customer who received a new message while the user was on `/customers` and isn't in that initial slice won't get a count.

Additionally, if `fetchUnreadCounts()` only counts messages newer than some session-start timestamp (rather than querying actual `is_read = false` rows from DB), unread state from prior sessions/pages is lost entirely.

I need to verify the exact implementation before planning the fix.

## Investigation needed

Read `ChatConversationList.tsx` fully — specifically:
- How `fetchUnreadCounts` queries the DB (is it scoped to loaded customers? does it use `is_read`?)
- When it runs (mount only? on customer list change?)
- Whether `markMessagesAsRead` actually updates `is_read=false → true` in DB so the count source-of-truth is correct

## Plan

1. **Make `fetchUnreadCounts` query the DB directly for ALL unread messages** (not just for currently-loaded customers). Group by `customer_id` from `messages` where `is_read = false` and `from_user = customer side`. This gives a complete unread map regardless of which page of conversations is loaded.

2. **Re-run on mount every time `/chat` is opened** — already happens since component remounts, but ensure it doesn't get short-circuited by stale state.

3. **Confirm `markMessagesAsRead` writes `is_read = true` to DB** when a conversation is opened, so the count stays accurate across navigations.

4. **Optionally**: also fetch unread counts when the customer list grows (infinite scroll loads more customers) so newly-loaded rows immediately show their badge — but if step 1 fetches ALL unread, this is automatic.

Single file change: `src/components/ChatConversationList.tsx` (~15-30 lines around `fetchUnreadCounts`).

