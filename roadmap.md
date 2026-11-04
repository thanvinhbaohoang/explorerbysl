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
- Requested verification: All → Unread → Not Replied → All, mobile Back, Retry, and cross-device reading — NOT TESTED: opening `/chat` in Chromium redirects to `/auth`; session minting and `--self` failed because no auth account matches the requester. No source fixes or customer interactions performed. Awaiting preview sign-in.

## Unread sync fix (approved, not published)
- [x] Shared filtered-cache refresh helper; all 3 mark-read paths refresh Unread after success
- [x] Page-level live listener for unread→read changes
- [x] Filtered tabs re-check server on return; no previous-tab flash; aria-pressed
- [ ] Signed-in click-through (blocked: no preview session for your account)
- [ ] Publish (waiting on your approval)

## Saved Replies (approved plan, not published)
- [x] Private `saved-reply-media` bucket (10 MB) + additive migration (table, column grants, RLS, usage function, storage policies)
- [x] Hook, panel, dialog, thumbnail; button after Voice; draft-replace confirm; never auto-sends
- [x] 28 rule tests (`bun run test`); database permission checks passed in a rolled-back transaction
- [x] Release verification part 1: updated_at across separate transactions PASS (edit bumps 05:52:36.970→05:52:39.042; usage leaves it unchanged); bucket private + 10 MB + 3 storage policies verified; 28/28 tests; tsgo clean; build OK; lint matches baseline; linter 13 pre-existing, none new
- [ ] Signed-in click-through + Telegram / Messenger Page 1 / Page 2 sends (blocked: no preview session; minting as specific user not permitted, --self has no matching account)
- [ ] Storage policy checks with real uploads (needs signed-in session)
- [ ] Publish (waiting on your approval)
