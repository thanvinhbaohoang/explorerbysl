# Fix: Unread sync + filtered-list consistency (no publish)

Scope: frontend only. No changes to All query/key/options, integrations, sending, auth, RPC, index, tables, RLS, or data.

## Changes

1. **Shared helper** — export `invalidateFilteredCustomerCaches(queryClient, filter: "unread" | "not_replied")` from `src/hooks/useCustomersData.ts`. Predicate: `queryKey[0]==='customers' && queryKey[6]===filter` (6-element All key can never match). Returns the `invalidateQueries` promise. The list component reuses it.
2. **Mark-read paths** (invalidate `unread` only, only when the update returns no error):
   - ChatConversationList selection path (switch to shared helper).
   - `ChatPanel.tsx` linked-account switch update (~line 555).
   - `useChatMessages.ts` `markMessagesAsRead` (~line 1158).
3. **Realtime UPDATE listener** in `src/pages/Chat.tsx` (stays mounted while the mobile list is hidden): `useEffect(..., [queryClient])`, one channel with a unique name on `messages` UPDATE, `removeChannel` on cleanup. Does nothing unless `new.sender_type==='customer' && old.is_read===false && new.is_read===true` (ignores transcription, attachment, text, delivery updates). Confirm REPLICA IDENTITY FULL on messages with a read-only catalog query.
4. **Missed events** — `refetchOnMount: 'always'` only for unread/not_replied. All's staleTime, gcTime, placeholderData, refetch behavior and keys stay unchanged.
5. **No previous-tab flash (filtered modes only)** — All keeps its existing `allCustomers` state, sync and realtime behavior exactly. For filtered modes, the rows shown come straight from the current query result, with the existing lastMessages/unreadCounts overlays, sorting and preview updates still applied; data from a previous query key is never shown. Order of what shows:
   1. Error on the current query → "Unable to load filtered conversations" + Retry
   2. Loading or placeholder data → filtered skeleton
   3. Success with zero rows → correct empty state
   4. Success with rows → conversation list
   New customer messages still enter and reorder the list after invalidate/refetch.
6. **Accessibility** — `aria-pressed={filter===value}` on the 3 buttons; no visual change.

## Process
- Show the proposed diff in chat, then apply.
- Re-run the full 13-section audit with evidence: every mark-read path invalidates all Unread pages after success; the realtime false→true predicate; employee replies still update Not Replied; All keys never invalidated by filtered logic; channels don't pile up across rerenders (single subscription); a local update plus the realtime event cause no refetch loop; mobile Back keeps the filter and refetches; render precedence / no flash; build + tsgo pass; lint delta zero. Anything that needs a signed-in session is marked NOT TESTED if no session is available.
- Do not publish; return the revised report and verdict.
