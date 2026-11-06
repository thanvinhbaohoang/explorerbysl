# Roadmap

## Message reaction controls (requested 2026-11-06)
- [ ] Renewed capability-first scope: stopped for user choice because Telegram incoming message_reaction requires bot administrator status, unavailable in current private user-to-bot chats. Both Messenger lifecycles need coordinated actual events/recipient confirmation. No further implementation or publishing.
- [x] Release audit/correction: deployment inventory, evidence matrix, restoration read-back, narrow Preview fixes, 54 tests and preservation recorded in `.lovable/message-reactions-release-audit.md`. No new backend writes/publication during audit.
- [ ] Exact partial scope approval: waiting on user; original Phase 1 gate was not completed before partial implementation. Do not call complete or safe to publish.
- [ ] Provider-origin authentication and lease/reconciliation correction: separate approval needed; completed deep scan reports 51 findings (40 errors/11 warnings), no findings suppressed. No expansion authorized.
- [x] Messenger Huth Sakda signed-in picker → provider success → exact-message Team badge read-back verified. Mobile long press opens picker; 51 tests passed; build OK.
- [ ] Customer reactions: blocked pending incoming capability evidence and safe subscription approval; no incoming subscriptions or handlers activated. Messenger change/remove remains unverified. No customer badge is simulated.
- [ ] Telegram new-message end-to-end test: needs a new inbound Huth Sakda message with stored provider ID; historical IDs are not guessed. Albums remain excluded because Telegram redirects album reactions to another item.
- [x] User's corrected separate approval boundary recorded; premature implementation acknowledged.
- [x] Phase 1 closed: expired Travel Agency window stopped tests; exact Messenger subscriptions restored; temporary Telegram probe removed/deployed; diagnostic rows zero; result matrix in `.lovable/reaction-phase-1-results.md`.
- [x] Interaction design approved: hover picker, mobile long press, keyboard alternative and exact-message badges.
- [x] Exact verified outgoing scope implemented; unverified directions withheld.
- [x] Nothing published automatically.

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
- [x] User accepts current baseline: 42 business replies/pictures, zero cleanup entries; usage is mutable; do not recreate processed entries.
- [x] Targeted release: both single-picture Messenger deliveries provider-successful inside reply windows; one photo plus one caption follow-up each; all four app-side test rows removed.
- [x] Targeted release: creator/admin/other-staff/signed-out metadata permissions passed in expected rolled-back transaction.
- [ ] Measured concurrent serialization remains unverified: long lock caused request timeout; short attempts did not overlap reliably. No test data remains.
- [ ] Thumbnail recovery FAILED: transient image 404 restored access, one request only, broken thumbnail remained. Verification-only scope; no application fix made.
- [x] Temporary cleanup failure kept queue/object; successful retry removed both (fresh listing/catalog verified); referenced picture drain made zero delete calls.
- [x] 37 unit tests and focused lint pass; harness build OK; all business hashes and 42 actual picture byte hashes unchanged; usage unchanged; zero temporary remnants.
- [ ] Fresh standalone production-build and TypeScript runs unavailable under harness-only build rule; current build OK is observed, not a separate fresh TypeScript result.
- [x] Targeted evidence report/screenshots delivered; production asset URLs unchanged; no publication. Verdict NOT SAFE TO PUBLISH.
- [ ] Publish: blocked until explicit user approval.

## Saved Voice (preview only)
- [x] Library, button, panel, retry-safe send, Telegram strict voice
- [ ] Recipient-side screenshots on Telegram and both Messenger pages — blocked: needs the user's phones/accounts
