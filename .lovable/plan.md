# Send Messenger captions alongside media

## Problem
When an employee sends a photo/video with a caption to a Messenger customer, the webapp stores the caption on the media message row (rendered as a caption under the picture), but the Send API call only delivers the attachment. Messenger's Send API does not support captions on attachments, so the recipient sees only the image — the caption text is never delivered.

This affects both single-media sends and the batch (album) send path.

## Fix
In `supabase/functions/messenger-webhook/index.ts`, after a successful `sendAttachment` call, if a non-empty `caption` was provided, also call the existing `sendMessage(psid, caption, page_id)` helper so the caption is delivered as a follow-up text message in Messenger.

### Single send (`send_media` branch, around lines 1460–1516)
- After `sendAttachment` succeeds and before/around the DB insert, if `caption` is a non-empty string, call `await sendMessage(psid, caption, page_id)`.
- Keep the existing DB insert unchanged so the webapp UI continues to show the caption attached to the media bubble (no duplicate text row in our UI).
- If the follow-up text send fails, log it but do not fail the whole request — the media already delivered.

### Batch send (`send_media_batch` branch, around lines 1574–1618)
- After the loop finishes sending all media items, if `caption` is non-empty, call `await sendMessage(psid, caption, page_id)` once so the recipient sees the caption after the album.
- Keep the existing behavior of storing the caption on the first item's row for our UI.

## Out of scope
- No DB schema changes.
- No changes to the webapp UI, message rendering, or how captions are stored.
- No changes to Telegram, document, or voice send paths (Telegram already supports native captions; only Messenger needs the follow-up text).

## Verification
- Send a photo + caption to a Messenger customer from the webapp.
- Confirm in Messenger that both the image and the caption text arrive.
- Confirm the webapp chat still shows the caption under the photo bubble (single message row, no duplicate).
- Repeat with an album (multiple photos + caption) and confirm the caption arrives once after the album.
