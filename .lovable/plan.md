## Problem

When the user clicks the linked-account switcher in the chat header, the panel switches to that account and its incoming messages get marked as read, but the unread badge on the (now-other-side) switch button still shows the stale count until the 30-second poll fires.

## Fix

In `src/components/ChatPanel.tsx`, make the linked-account unread badge refresh promptly on conversation switch and on incoming/read changes — not only on a 30s timer.

### Changes (single file)

1. Extract the unread fetch into a stable callback `refreshLinkedUnread` (uses current `linkedAccounts` ref to avoid stale-closure issues).
2. Trigger `refreshLinkedUnread` in these situations, in addition to the existing 30s interval:
   - When `customer.id` changes — once immediately and again after 800ms (gives `useChatMessages.markMessagesAsRead` time to commit before we re-read counts).
   - When `linkedAccounts` change (already covered).
   - On a Supabase realtime subscription for `messages` rows whose `customer_id` is in the current linked-id set. Subscribe to both `INSERT` (new incoming bumps count) and `UPDATE` (mark-as-read clears count). Channel name `chat-linked-unread-${customer.id}`. Use `postgres_changes` event with filter `customer_id=in.(id1,id2,…)`; resubscribe whenever the set of linked ids changes; clean up on unmount.
3. Keep the 30s interval as a safety fallback (matches the project's existing realtime fallback cadence). It's cheap — single RPC call.

### Out of scope

- No DB or schema changes; realtime is already enabled in this project (existing `ChatConversationList` subscribes to `messages` the same way).
- No changes to `useChatMessages`, the conversation list, or the switcher button rendering itself.

### Verification

- Open a customer linked to another platform that has unread messages on the other side → badge appears.
- Click switcher → panel swaps; the badge that now sits on the previously-active side should reflect zero (or whatever truly is unread for that account) within ~1 second, not 30s.
- Have a new customer message arrive on the linked side while staying on the current side → badge increments without waiting for the 30s poll.
