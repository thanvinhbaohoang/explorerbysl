# Message reactions — desktop hover and mobile long press

## Requested experience
- Hover over an eligible customer message on desktop to reveal a smile icon. Clicking it opens the emoji picker.
- Long-press that message on mobile to open the same picker. Scrolling, tapping media and playing recordings continue working normally; movement or release cancels the long press.
- Provide keyboard access, labelled emoji choices, Escape/outside-click dismissal and a touch-accessible alternative to long press.
- Select an emoji to add or change the staff reaction; select the current emoji again to remove it, only where removal is verified.
- Show customer and staff reactions separately beneath the exact message. Customer changes and removals update live where incoming events are supported.
- Keep Send, Saved Replies, Saved Voice, inbox filters and authentication behavior unchanged. Do not publish automatically.

## Evidence and channel limitations
The supplied screenshot confirms the bot's heart appeared on the Telegram customer message. It also shows a customer heart in Telegram itself, but does **not** prove the webapp received that event.

| Channel | Staff adds reaction | Staff changes/removes | Customer reactions reach webapp |
|---|---|---|---|
| Telegram private chat | Recipient-confirmed heart | Still requires verification | UNTESTED; registration secret cannot currently be verified, and private-chat reaction delivery has additional provider restrictions |
| Explorer by SL Messenger | Provider accepted emoji heart; receiving-side confirmation still required | Still requires verification | Still requires exact add/change/remove event evidence |
| Travel Agency Messenger | Still requires verification | Still requires verification | Still requires verification |

Do not expose a control or claim two-way support for an unverified direction. Historical Telegram messages without a stored provider message ID cannot safely receive a reaction control; never infer that ID from text or time. Unsupported channels receive a channel-specific proposal, not a simulated local reaction.

## 1. Close the capability test safely
1. Review the already-captured Messenger diagnostic events for exact message ID, emoji and add/change/remove action; use only the three previously approved internal chats.
2. Verify remaining outbound lifecycle actions and receiving-side results. First check both Messenger 24-hour windows; stop on an expired window. Customer-side confirmation requires the user's internal accounts, not fabricated evidence.
3. Record every provider rejection as FAIL, including the earlier Messenger reaction-name rejection; do not silently reinterpret it as a pass. Distinguish any separately accepted emoji request.
4. If any cell fails, stop testing, restore the exact subscription snapshots unconditionally, remove temporary Telegram logging/test actions, verify restoration, and report a channel-specific proposal.
5. On normal completion, perform the same unconditional restoration and diagnostic cleanup. Restore no configuration from guesses. Telegram subscription changes remain forbidden unless URL, secret configuration and allowed updates can be reproduced and restored exactly; unknown secret configuration means incoming Telegram reactions are UNTESTED, not FAIL.
6. Finish Phase 1, restore all temporary subscriptions and code, and give the user the completed 3×4 capability matrix. Stop there and wait for approval of the exact channel-by-channel scope before any reaction UI, migration or permanent function change. A provider-accepted request alone is not recipient-side confirmation.

## Separate Phase 2 approval gate
The interaction design is approved, but implementation is not. Phase 1 completion does not authorize Phase 2, even for capabilities that pass. Present a precise channel-by-channel proposal distinguishing send, change/remove and incoming reaction support, then wait for explicit approval. No reaction UI, migration, permanent function change or permanent subscription change occurs before that approval.

## 2. Proposed implementation — only after separate Phase 2 approval
- Add the hover/long-press picker and reaction badges as focused chat components. Use existing buttons, popovers, tokens and mobile layout conventions.
- Scope picker eligibility to actual message items, including individual album items; never apply one item's reaction to an entire album.
- Keep one in-flight reaction change per target. Show the confirmed result only after provider success, preserve the prior state on error, and allow explicit retry without automatic duplicate sends.
- For channels with verified incoming events, persist customer changes/removals idempotently and update the correct bubble across staff devices.
- Hide unsupported send controls and report unavailable incoming support explicitly in the release report.

## Proposed Phase 2 technical scope — not authorized yet
- Frontend: new reaction picker/badge components and a focused reaction hook/helper; minimal integration in `src/components/ChatPanel.tsx` and message typing/loading in `src/hooks/useChatMessages.ts` as necessary.
- Functions: validated staff-only reaction action using the real stored message/customer/page IDs, not caller-supplied recipient IDs; enforce existing channel windows and approval checks. Provider errors remain visible; no optimistic fake success.
- Telegram: start populating the existing `telegram_message_id` field on new incoming and outgoing messages without changing ordinary send behavior. No guessed backfill for older messages.
- Messenger: exact `messenger_mid` plus Page/customer scope for routing; permanent reaction subscription only after that Page's incoming capability passes and is explicitly included in the supported implementation.
- Storage: one additive migration for an approved-staff-only reaction table, indexes, grants and RLS; server-owned writes. Preserve provider target IDs for events arriving before their message row. Customer and bot/Page reaction identities remain distinct; staff attribution is audit metadata, not invented provider reaction counts.
- Live updates: effect-scoped subscription with teardown and conversation-scoped reads; no per-bubble subscriptions or repeated full-history queries.
- Preview and published app share live functions/database: disclose and record any deployment or subscription change. No automatic publication.

## Proposed Phase 2 verification and delivery — after approval
- Unit tests for eligibility, exact-message routing, add/change/remove state, duplicate events, long-press cancellation and provider-failure preservation.
- Signed-in desktop/mobile screenshots demonstrating picker opening, emoji selection, reaction display and touch scrolling/media playback without accidental reactions.
- Approved staff succeeds; signed-out/unapproved accounts cannot send or write reactions; forged customer/Page/message targets fail.
- End-to-end verification only in the three approved internal chats, with provider responses, correct app read-back and recipient-side evidence for every supported action.
- Regression checks for Send, Saved Replies, Saved Voice, albums and inbox filters; existing project tests, focused lint, permitted build/TypeScript harness and security scan.
- Remove only temporary test artifacts and diagnostics; preserve all current business replies, pictures and normal customer messages. Re-read the roadmap and report all remaining blockers.
- Deliver changed-file list, capability matrix, screenshots and one release verdict. Wait for approval before publishing.