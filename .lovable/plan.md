## Diagnosis

The text Send button is unlocked, but during a voice or file send the composer **isn't even showing the text input** — it's still showing the voice-preview UI (or the file-preview chips) until the upload + edge-function call resolves. So the user has nothing to type into.

Two things keep the preview UI mounted:

- `sendVoiceClip` only clears `recordedAudio` / recording state inside its `finally` block (after upload + send finishes). Until then `ChatPanel` renders the audio-preview branch instead of the text input.
- `sendMediaBatch` (and `sendVoiceClip`) early-return when `isUploadingFile` is already true, so even if the composer were available, a second file/voice send during the first one would silently no-op.

## Changes

### 1. `src/hooks/useChatMessages.ts`

- **`sendVoiceClip`**: snapshot `recordedAudio`, `recordingDuration` into locals at the top, then **immediately clear** `recordedAudio`, `recordingDuration`, `isPlayingPreview`, `playbackProgress` before any `await`. Run upload + edge-function call afterwards using the local snapshot. Remove the corresponding resets from `finally` (keep only the `URL.revokeObjectURL` on the snapshot's preview URL, which can move to a `.finally(...)` on the async work or stay scoped to the local). The optimistic bubble already keeps the message visible with its own preview URL.
- **`sendVoiceClip` / `sendMediaBatch`**: remove the `|| isUploadingFile` early-return guard so concurrent uploads aren't silently dropped. The optimistic bubble per `tempId` already keeps each in-flight send isolated.
- Stop toggling the global `isUploadingFile` flag around these sends, OR repurpose it as a per-button local indicator only. Recommended: leave the state but only set it true/false around the synchronous "click → bubble appears" handoff (essentially remove it; nothing critical relies on it once the composer returns to normal input). Keep it exported with a constant `false` for API stability.

### 2. `src/components/ChatPanel.tsx`

- Once `isUploadingFile` no longer gates the composer, the existing render branches (`isRecording ? … : recordedAudio ? … : normal-input`) will fall through to the normal text input as soon as `recordedAudio` is cleared in step 1 — no JSX restructuring needed.
- Audit and drop `isUploadingFile` from `disabled` on:
  - the attachment dropdown trigger (line 624)
  - the mic button (line 645)
  - the file-batch send button (wherever applicable)
  
  so users can also start a second voice/file send while a first one is still uploading.
- Keep `selectedFiles.length > 0` based disables (mic disabled while composing a file batch) — that's a UX choice, not a concurrency lock.

### 3. `handleSend` (already done last turn)

No further change. It already snapshots + clears `selectedFiles` / `replyText` synchronously and fires `sendReply` / `sendMediaBatch` as fire-and-forget.

## Success criteria

- Hitting Send on a voice clip immediately returns the composer to the normal text input; the user can type and send a new text/voice/file while the voice clip is still uploading.
- Multiple in-flight uploads each get their own optimistic bubble and resolve independently.
- A failed send still removes only its own optimistic bubble and toasts.

## Out of scope

No backend, edge-function, schema, or RLS changes. No change to how optimistic bubbles render or dedupe.