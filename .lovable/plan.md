## Root cause
On mobile, `src/pages/Chat.tsx` renders either `ChatPanel` OR `ChatConversationList` (not both). Every time the user opens a conversation — including tapping "View" on a new-message toast — the conversation list unmounts. When they return, it remounts and its internal `useState(1)` resets the page back to 1. That is what is throwing the user off pages 4–5.

The earlier fix only stopped explicit `setPage(1)` calls; it did not protect against the remount, so the issue still happens.

## Fix
Persist the chat list page so it survives remounts.

1. Lift pagination state into `src/pages/Chat.tsx`
   - Add `const [chatListPage, setChatListPage] = useState(1)` in `Chat.tsx`.
   - Pass `page` and `onPageChange` props into `ChatConversationList` (both mobile and desktop usages).

2. Update `src/components/ChatConversationList.tsx`
   - Accept optional `page` and `onPageChange` props; fall back to local state only if not provided (keeps the component reusable).
   - Replace internal `setPage` calls in the prev/next buttons and clamp effect with the prop setter when provided.
   - Keep all the existing background-refresh behavior unchanged.

3. Do not touch `?customer=` handling, realtime subscriptions, polling, prefetch, or sorting — those are already correct.

## Technical details
- Only two files change: `src/pages/Chat.tsx` and `src/components/ChatConversationList.tsx`.
- No schema, RLS, hook signature, or routing changes.
- Desktop is unaffected functionally (the list never unmounts there), but it benefits from the same lifted state for consistency.

## Validation
- Mobile: open `/chat`, paginate to page 4, open a conversation, tap back → list is still on page 4.
- Mobile: while on page 4, trigger a new message from another account → toast appears, list stays on page 4; tap "View" → conversation opens; tap back → list returns to page 4.
- Desktop: paginate to page 4, send a new message from another account → list stays on page 4, page-1 cache silently refreshes in the background.