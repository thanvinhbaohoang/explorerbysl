## Goal
Make sent chats finalize in the UI immediately after a successful send, instead of staying stuck on "Sending..." even though the message was delivered.

## What’s happening
The backend is working:
- Telegram logs show `Message sent and saved successfully`.
- Messenger logs show the sent message is saved and the echo webhook is intentionally skipped as a duplicate.

The bug is in the frontend optimistic-send flow in `src/hooks/useChatMessages.ts`:
- Text sends add a temporary message with `isPending: true`.
- On success, that temp message is left in place and waits for realtime to replace it.
- If the realtime insert arrives late or is missed, the temp row never gets reconciled and stays stuck as `Sending...`.
- Media/voice/album paths remove the temp row and also rely on realtime to add the final row, so they can disappear briefly or fail to finalize cleanly for the same reason.

## Plan

### 1. Add a shared optimistic reconciliation helper
In `src/hooks/useChatMessages.ts`, add a small helper that can:
- insert optimistic messages,
- mark them as no longer pending after a successful send,
- replace them when the real DB row arrives,
- and safely revoke preview blob URLs only when the optimistic row is actually removed or replaced.

### 2. Finalize text messages on successful edge-function response
Update `sendReply` so that when the edge function returns success:
- the optimistic message is immediately changed from `isPending: true` to `isPending: false`,
- it stays visible in the conversation instead of waiting entirely on realtime.

This removes the permanent stuck state even if realtime is delayed.

### 3. Make realtime replace the matching optimistic row instead of only pending rows
Improve the realtime `INSERT` handler so it matches and replaces the corresponding optimistic employee message using stable heuristics such as:
- same customer,
- same sender type,
- same message type,
- same text/caption where applicable,
- close timestamp window,
- optional media-group match for albums.

This avoids duplicates once the real DB message arrives after the optimistic one has already been marked as sent.

### 4. Apply the same logic to media, album, and voice sends
Update the other send paths so they no longer depend on realtime as the only way to finalize the UI:
- single media,
- media batch/album,
- voice clip.

They should either remain visible as finalized optimistic rows until replaced, or be reconciled with the real row without flicker or duplication.

### 5. Keep failure behavior unchanged
If the send fails:
- remove the optimistic row,
- preserve the current error toasts,
- keep 24-hour window handling unchanged.

## Technical details
- Primary file: `src/hooks/useChatMessages.ts`
- No backend, schema, auth, or routing changes needed.
- `src/components/ChatPanel.tsx` can keep using `message.isPending` as-is.

## Validation
After implementation, verify these cases:
1. Send a text message: it briefly shows `Sending...` then becomes a normal sent bubble.
2. Send a Messenger message: same result, no duplicate from the echo/save flow.
3. Send media, album, and voice: no stuck pending state, no disappearing bubble, no duplicate.
4. If realtime is slow, the message still finalizes in the UI.
5. If sending fails, the bubble is removed and the existing error toast still appears.