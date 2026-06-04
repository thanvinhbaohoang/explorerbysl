## Goal
When an employee replies to a customer from the Facebook Page's Messenger inbox (Page Inbox, Meta Business Suite, or Messenger mobile app), that outbound message should appear in our chat collection just like messages sent from our app.

## Current behavior
The webhook (`supabase/functions/messenger-webhook/index.ts`, lines 1595–1639) already handles `is_echo` events, but with gaps:
- Only saves **text** messages — any image, video, audio, file, or sticker reply sent from Page Inbox is silently dropped.
- Skips entirely if the customer doesn't exist yet in our `customer` table (e.g., employee initiates contact, or first interaction came in while messenger integration was off).
- Doesn't update `customer.last_message_at` ordering for the chat list (the DB trigger handles this, fine).

Also: echoes only arrive if the page is subscribed to the `message_echoes` webhook field. Need to verify that's part of our subscription setup.

## Changes

### 1. `supabase/functions/messenger-webhook/index.ts` — expand echo handler
Replace the text-only echo insert block (~lines 1599–1637) with logic that mirrors `handleMessage` for inbound attachments but stored as `sender_type: 'employee'`:

- Detect message type from `event.message.attachments[0].type` (`image`, `video`, `audio`, `file`, `template`, `fallback`) or fall back to `text`.
- For attachments, store the Facebook CDN URL in the matching column (`photo_url`, `video_url`, `voice_url`, `document_url`), plus `document_name`/`document_mime_type`/`document_size` where available, matching the schema already used for inbound messenger messages.
- For stickers/templates with no usable URL, save as text with a placeholder like `[sticker]` or the template title so the conversation thread stays coherent.
- If the recipient (customer) doesn't exist yet, create a minimal customer row first (same shape as `handleMessage`'s "new customer" path: `messenger_id = recipientId`, `page_id = currentPageId`, name = `Unknown` until a profile fetch resolves it), then trigger the same profile fetch flow used for new inbound customers so the row gets populated automatically.
- Keep the existing dedupe by `messenger_mid` so messages we sent from our own UI (which already inserted with their `mid`) aren't double-saved.
- Mark `is_read: true` (employee-sent) and use `event.message.timestamp` for ordering.
- Preserve `sent_by_name` as `null` for echoes (we don't know which employee replied in Page Inbox) — UI already tolerates this.

### 2. Webhook subscription check (no code change, just verification)
In the message I send after implementing, remind the user that the Facebook Page must be subscribed to the **`message_echoes`** webhook field for this to work. If they only subscribed to `messages`, no echo events will arrive and Page Inbox replies will never reach us. They can verify in the Facebook App dashboard under Messenger → Webhooks.

## Out of scope
- No schema changes.
- No frontend changes (ChatPanel/ChatConversationList already render `sender_type: 'employee'` messages and attachments).
- No changes to outbound send flow from our own UI.
- No changes to `handleMessage`, profile fetch, or any other unrelated handler.

## Verification
1. From the Facebook Page Inbox (or Meta Business Suite), reply to an existing customer with: a text message, then a photo, then a file.
2. All three should appear in our `/chat` view for that customer within seconds, on the employee/right side of the thread.
3. From Page Inbox, message a brand-new user who isn't in our DB yet — a new customer row should be created and the outbound message should appear under it.
4. Check edge logs for `[echo]` lines and confirm no duplicate inserts for messages we sent from our own UI.