# Roadmap

## Done: Inbox filters (All / Unread / Not Replied)
- [x] Migration: `get_filtered_customer_ids` RPC (SECURITY INVOKER, REVOKE PUBLIC/anon, GRANT authenticated)
- [x] Types regenerated; RPC verified present
- [x] `useCustomersData.ts`: filter param, 7th cache-key element, RPC fetch + defensive validation
- [x] `Chat.tsx`: filter state lifted, passed to both list instances
- [x] `ChatConversationList.tsx`: segmented control, error state + retry, keepPreviousData guard, predicate invalidation, page clamp
- [x] EXPLAIN ANALYZE: unread 6ms; not_replied 506ms → 84ms after `idx_messages_customer_ts` index
- [x] Build clean; RPC output shape verified against live data (229 unread conversations)

## Open
- Signed-in browser test of the tabs — blocked: no preview session available (multiple auth users, none matching the requesting email). Needs user sign-in or an approved test account.

## Unread sync fix (approved, not published)
- [x] Shared filtered-cache refresh helper; all 3 mark-read paths refresh Unread after success
- [x] Page-level live listener for unread→read changes
- [x] Filtered tabs re-check server on return; no previous-tab flash; aria-pressed
- [ ] Signed-in click-through (blocked: no preview session for your account)
- [ ] Publish (waiting on your approval)
