## Goal

Make the chat input non-blocking. After hitting send (text, media, or voice), the input clears immediately and is ready for the next message. The only "sending" indicator is the optimistic bubble (`isPending`) inside the conversation. Sends run concurrently and resolve independently.

## What's blocking today

- `useChatMessages.ts` keeps two global flags: `isSending` (text) and `isUploadingFile` (media/voice). Each send sets the flag, awaits the edge function, then clears it.
- `ChatPanel.tsx` disables the textarea, send button, attach button, and voice button based on those flags, so the user must wait for the round-trip (especially painful for voice → MP3 conversion + Messenger upload).
- Each send function also early-returns if its flag is true, so even programmatic rapid sends are dropped.

## Plan

1. **Remove global send/upload guards in `src/hooks/useChatMessages.ts`**
   - Stop using `isSending` / `isUploadingFile` as gates inside `sendReply`, `sendMedia`, `sendMediaBatch`, and `sendVoiceClip`.
   - Keep the optimistic message insertion (`isPending: true`) and the existing `markOptimisticSent` / failure rollback per message — that already gives per-bubble status.
   - Keep `isSending` / `isUploadingFile` exported but only as informational counters (or drop them from the return). Per-message state lives on the optimistic message itself.
   - Each call generates its own `tempId` and runs its own async pipeline, so concurrent invocations don't collide. Confirm the realtime dedupe path still keys off `tempId` / `messenger_mid`.

2. **Unblock the input in `src/components/ChatPanel.tsx`**
   - Remove `isSending` and `isUploadingFile` from the `disabled=` props on the textarea, send button, attach button, and voice button.
   - Keep functional disables that still make sense: empty input, `isMessengerOutsideWindow`, and the media-preview "Send" button gated on `mediaItems.length === 0`.
   - On submit: clear `replyText` / selected files immediately, before awaiting the send. The optimistic bubble is already appended synchronously, so the user sees their message and a fresh input in the same frame.
   - Voice: stop the recorder, append the optimistic voice bubble synchronously, then kick off conversion+upload+send in the background. The mic button returns to idle right away.

3. **Per-bubble UX**
   - Optimistic bubbles continue to show a small "Sending…" / spinner state via `isPending`.
   - On failure, the bubble is removed (existing behavior) and a toast explains why. No change to error-handling semantics.
   - Voice bubble shows the same pending indicator while MP3 conversion + upload run in the background.

4. **Safety checks**
   - Confirm no other caller depends on `isSending` / `isUploadingFile` being a hard mutex (search usages in `ChatPanel`, `Customers.tsx`, etc.).
   - Make sure the realtime subscription continues to reconcile the eventual real row against optimistic messages, even when several are in flight at once.

## Out of scope

- No backend / edge function changes. Edge functions stay synchronous; only the client stops blocking on them.
- No schema changes. We rely on existing `isPending` client-side flag and current realtime dedupe.
- No queue/persistence for in-flight messages across reloads (can be a follow-up if desired).

## Success criteria

- User can type and send a second text message while the first is still in flight; both appear as optimistic bubbles and resolve independently.
- User can record and send a voice clip, then immediately type and send a text without waiting; the voice bubble shows pending until upload+send completes.
- Failed sends remove only their own optimistic bubble and show a toast; other in-flight messages are unaffected.
