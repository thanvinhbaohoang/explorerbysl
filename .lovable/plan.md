

## Diagnosis

The user reports that simply *visiting* `/chat` clears all unread badges — both in the conversation list and on the "Chat" nav button. This means `markMessagesAsRead` (or an equivalent UPDATE) is being triggered on mount/render rather than only when a conversation is explicitly clicked.

I need to inspect `ChatConversationList.tsx` and `ChatPanel.tsx` / `useChatMessages.ts` to find where `is_read` gets flipped, and confirm it's firing too eagerly.

## Likely culprits to verify

1. **`useChatMessages.loadMessages`** — the summary shows it calls `markMessagesAsRead` after loading. If `ChatPanel` (or anything else) calls `loadMessages` for a customer that wasn't user-clicked, that's the bug.
2. **`ChatConversationList`** — possibly auto-selects the first conversation on mount, which would cascade into `loadMessages` → `markMessagesAsRead`.
3. **`Chat.tsx`** — the URL `?customer=` param auto-selects a customer. Fine when clicked from CRM, but if `selectedCustomer` ever defaults to the first item, every visit silently marks one conversation read.

The bigger concern: even marking a *single* conversation read on entry shouldn't blank out the entire badge list. So there's likely a second bug — perhaps `fetchUnreadCounts` runs, then something resets `unreadCounts` to `{}` (e.g., a state reset on selection change, or the RPC failing silently and falling back to empty).

## Plan

1. **Inspect** `ChatConversationList.tsx`, `ChatPanel.tsx`, `useChatMessages.ts`, and `Chat.tsx` to map every place `is_read` is updated and every place `unreadCounts` is set/reset.

2. **Fix the read-marking trigger**: ensure `markMessagesAsRead` runs ONLY inside the explicit `onSelect` handler in `ChatConversationList` (user click), not inside `loadMessages`, not on mount, not on URL auto-select unless that came from a real CRM click.
   - Decouple "load messages for display" from "mark as read." Loading should be a pure read; marking should be an explicit user action.

3. **Fix the badge-reset bug**: ensure `unreadCounts` is never wiped to `{}` on customer selection or panel mount. The only mutations allowed:
   - Initial fill from `get_unread_counts()` RPC on mount
   - Increment on realtime new message
   - Set to `0` for a specific `customer_id` only when that conversation is explicitly opened by click

4. **Verify the Chat nav badge source**: confirm where the header's "Chat" unread badge reads its count from, and make sure it stays in sync (likely a separate query or shared hook). If it's recomputing from the same `messages` table, the same fix applies; if it's a separate state, ensure no reset happens on route change.

## Files to change (expected)

- `src/hooks/useChatMessages.ts` — remove `markMessagesAsRead` from `loadMessages`; export it for explicit use.
- `src/components/ChatConversationList.tsx` — call `markMessagesAsRead` (or do the UPDATE inline) only inside the `onSelect` click handler; locally zero-out `unreadCounts[customerId]` at the same moment.
- `src/components/ChatPanel.tsx` — stop calling `markMessagesAsRead` on mount/load if it does.
- `src/components/AppLayout.tsx` (or wherever the Chat nav badge lives) — ensure its source isn't being reset by route change; if it polls `get_unread_counts`, it'll self-heal.

No DB migration needed — the RPC from the previous fix stays.

