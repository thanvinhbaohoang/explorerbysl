# Pre-publish audit: all unpublished changes

Read-only audit. No sends to customers, no database changes, no publishing. Ends with a SAFE / NOT SAFE verdict and a list of reasons.

## 1. Inventory what would go live
- List every change since the last publish: Message Reactions (picker, badges, per-channel emoji lists), Telegram message-ID capture, the reactions server function, the two reaction database changes, and any leftover partial work.
- Confirm which of these are already live on the shared backend (functions and database changes apply immediately) and which only appear after Publish (screens).

## 2. Reaction feature against your approved scope
- Picker appears only where proven: Telegram (heart, thumbs up, folded hands) and Explorer by SL Messenger (7 emojis). Hidden on Travel Agency, outside the 24-hour window, and on messages without a stored provider ID.
- Server picks the channel from the stored message and rejects other emojis, extra fields and Messenger removal.
- Badges show only provider-confirmed reactions on the exact message.
- Known limitations recorded: no incoming customer reactions (Telegram private chats can't send them; Messenger untested), no Messenger removal, no Travel Agency. Reaction work was marked paused/unapproved earlier, so I'll ask you to approve this partial scope explicitly before any SAFE verdict.

## 3. Regressions
- Desktop and phone checks in the preview with all customer sends blocked: normal Send, photos, voice notes, Saved Replies, Saved Voice, inbox filters (All / Unread / Not Replied), long press not breaking scrolling, photo opening or voice playback.

## 4. Business data preservation
- Saved Replies (56), pictures, Saved Voice entries and cleanup queue compared with the last recorded counts; no test leftovers.
- Messenger subscriptions still on the original six fields; Telegram webhook unchanged; no temporary test code.

## 5. Security and health
- Run the security scan and database linter; list each finding, mark new versus older, and say whether this release makes any reachable.
- Check access rules on the reactions table (staff read only, no browser writes).
- All tests, TypeScript, lint and build; review error logs.

## 6. Report
- Verdict with reasons, the older serious findings still open, and what you need to confirm. Publishing only after your approval.
