## The fix

When a Telegram (or any) message arrives via realtime INSERT for a customer who isn't in the currently-loaded list, jump the conversation list back to page 1 and refetch. Since `customer.last_message_at` was just updated by the DB trigger, page 1 (ordered by `last_message_at desc`) will return that customer at the very top.

### Change in `src/components/ChatConversationList.tsx`

Inside the `messages` INSERT realtime handler (around line 350), replace the current "if unknown → ensureConversationLoaded" branch with:

```ts
if (!isKnownConversation) {
  if (page !== 1) setPage(1);
  void refetch();
  return;
}
```

And drop `ensureConversationLoaded` entirely (it's no longer needed). The existing in-page bump (`setAllCustomers(prev => prev.map(...))` for known customers) stays so customers already on the page move to the top instantly without waiting for the refetch.

The toast + sound + unread-count update fire **before** this branch (they already do), so notifications still happen regardless of which page the user was viewing.

### Why this matches the requested behavior

- Brand-new message from a customer not currently visible → page 1 loads, sorted by `last_message_at desc` → that customer is row #1.
- If the user was on page 3 looking at older conversations, they get yanked back to page 1 the moment a new message arrives. This matches Messenger/Instagram: "newest message always at top of the main view."
- Customers already on page 1 just re-sort instantly via the existing in-memory bump.

## Verification

1. On page 1, have a pre-existing Telegram customer (currently on page 4) send a message. The list should refresh and that customer should appear at the very top within ~1s, with a toast + sound.
2. On page 3, repeat. The list should snap back to page 1 with that customer at the top.
3. Customer already visible on page 1 → instant re-sort to top (no flicker, no refetch wait).
4. `/start` from a brand-new customer still works via the existing `chat-list-customers` channel — untouched.

## Out of scope

- No edge function or DB changes.
- No realtime reconnect or polling-replay logic.
- No changes to sort order, search, unread counts, or pagination UI.