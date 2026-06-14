## Goal

Let the user keep typing and sending more messages immediately, without waiting for the previous send round-trip to resolve. Each in-flight message still shows its own "Sending…" bubble, but the composer stays unlocked.

## Changes

### 1. `src/hooks/useChatMessages.ts` — make sends concurrent
- Remove the `isSending` gate from `sendReply` (line 384): drop the `|| isSending` check so multiple sends can run in parallel.
- Stop toggling the global `isSending` state around the send (line 421 and the matching reset in `finally`). The per-message `isPending` flag on the optimistic bubble already conveys per-message status.
- Keep `isSending` exported as a constant `false` (or remove it entirely and update the one consumer) so the return shape stays stable for `ChatPanel`.
- Apply the same treatment to the other send paths that currently rely on `isSending` (voice clip, files) — they should also fire independently and only manage their own pending bubble / `isUploadingFile` for the local upload progress indicator.

### 2. `src/components/ChatPanel.tsx` — unlock the composer
- Line 660: remove `isSending` (and `isUploadingFile` for text sends) from the Send button `disabled` expression. Keep only:
  - empty content guard (`!replyText.trim() && selectedFiles.length === 0`)
  - `isMessengerOutsideWindow`
- `handleSend` (line 324): clear `replyText` and `selectedFiles` synchronously before awaiting the send, so the textarea is immediately ready for the next message. Do not `await` the send inside the click handler — fire-and-forget so a slow network doesn't block the next keystroke / Enter.
- Leave the mic button and file upload button's `isUploadingFile` gate alone (those are local browser operations that genuinely need exclusivity).

## Out of scope

- No backend, RLS, or schema changes.
- No change to optimistic bubble rendering, dedupe, or error toasts — those already key off `tempId` per message and will continue to work when several are in flight.
- Telegram and Messenger paths get the same behavior; no platform-specific logic added.

## Success criteria

- After hitting Send, the textarea clears instantly, focus stays, and a new message can be typed and sent before the first server response returns.
- Multiple "Sending…" bubbles can be visible at once, each resolving independently.
- A failed send still shows its toast and rolls back only its own optimistic bubble.