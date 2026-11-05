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

## Saved Replies — signed-in verification (DONE 2026-11-04)
- Desktop: create reply with picture (upload + insert OK, toast shown), select fills composer + attaches picture, nothing sent
- Draft-replace confirm: Cancel keeps draft, Replace fills composer
- Mobile: bottom sheet renders, filter tabs All/Unread/Not Replied work
- Delete reply removes row + storage object (DB verified: 0 leftovers, 0 accidental sends)
- Verdict: SAFE TO PUBLISH

## Saved Replies: 0–4 pictures
- [x] Audit (33 replies / 33 pictures / 0 invalid at audit time — baseline grew from 32 because staff are adding replies live)
- [x] Additive migration 0003_add_saved_reply_images applied (backfill check passed)
- [x] Baseline re-recorded: 39 replies, 39 pictures, 39 matching entries, 0 invalid
- [x] Previous rolled-back database safety tests passed; pre-existing queue preserved.
- [x] User approved current baseline of 42 replies / 42 pictures; preserve two existing queue entries.
- [x] Frontend multi-picture UI; 37 unit tests pass; harness build/TypeScript OK; focused lint clean.
- [x] Desktop/mobile 0–4 pictures, reorder/replace/remove, failed upload/save/download, draft protection verified with temporary reply.
- [x] Four-picture delivery to all three approved internal chats; old published frontend single-picture Telegram delivery verified.
- [x] Temporary replies/child rows/objects/queue entries and 15 app-side test messages removed; external delivered messages may remain.
- [x] Baseline verification: 42 business pictures/objects unchanged; 41/42 whole reply hashes unchanged, one staff usage increment observed.
- [x] Final release report and screenshots delivered: NOT SAFE TO PUBLISH.
- [ ] Release review blocker: panel-open drain removed two pre-existing queue entries, violating test preservation.
- [ ] Remaining release checks: single-picture Messenger deliveries; deterministic lock-wait; fresh complete role/failure matrix.
- [ ] Publish: blocked until explicit user approval.
