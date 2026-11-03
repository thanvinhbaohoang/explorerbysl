# Fix: Unread sync + filtered-list consistency (no publish)

Scope: frontend only. No changes to All query/key, integrations, sending, auth, RPC, index, tables, RLS, or data.

## Changes

1. **Shared helper** — move `invalidateFilterCaches` into `src/hooks/useCustomersData.ts` as an exported `invalidateFilteredCustomerCaches(queryClient, filter)` (predicate on `queryKey[0]==='customers' && queryKey[6]===filter`). The list component reuses it; All keys (6 elements) can never match.
2. **Mark-read paths** (invalidate `unread` only, only after `error` is null):
   - ChatConversationList selection path (already done; switch to shared helper).
   - `ChatPanel.tsx` ~line 555 linked-account switch update.
   - `useChatMessages.ts` `markMessagesAsRead` (~line 1158).
3. **Realtime UPDATE listener** in `src/pages/Chat.tsx` (persists while mobile list unmounts): one `useEffect([])` channel on `messages` UPDATE; invalidates `unread` only when `new.sender_type==='customer' && old.is_read===false && new.is_read===true`. Unique channel name, `removeChannel` on unmount.
4. **Missed events** — in `useCustomersData`, for filtered modes only set `refetchOnMount: 'always'`; All options untouched.
5. **No previous-tab flash** — in ChatConversationList, treat result as current only when `!isPlaceholderData` (filtered modes); otherwise skip copying rows into `allCustomers` and render the filtered skeleton. Derive displayed rows during render (not via effect) so no one-frame lag.
6. **Accessibility** — `aria-pressed={filter===value}` on the 3 buttons.

## Process
- Show the proposed diff in chat before applying, then apply.
- Re-run the full 13-section audit, proving each listed item (mark-read paths, realtime predicate, employee reply → Not Replied, All never invalidated, single subscription, mobile Back keeps filter + refetches, no flash via code + render-order reasoning, build/tsgo pass, lint delta zero). Items needing a signed-in session marked NOT TESTED if no session.
- Do not publish; return revised report.
