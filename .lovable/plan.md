# Fix: PC voice messages show 0 duration / won't play on Messenger

## Root cause

On PC (Chrome/Edge/Firefox), `MediaRecorder` records `audio/webm;codecs=opus`. Facebook's Send API accepts the upload, but Messenger's audio player cannot decode WebM/Opus — the bubble appears with **0:00 duration and no playback**. iOS Safari (and many Android Chrome builds) record `audio/mp4` (AAC), which Messenger plays correctly — that's why mobile works.

Messenger's audio attachment reliably plays MP3, M4A/AAC, and WAV. The fix is to re-encode the recorded blob to MP3 on the client before upload, but only when the captured format isn't already Messenger-friendly.

## Changes

### 1. `src/hooks/useChatMessages.ts`
- Add a helper `convertToMp3(blob: Blob): Promise<Blob>` that:
  - Decodes the blob via `new AudioContext().decodeAudioData(arrayBuffer)`.
  - Encodes to MP3 (mono, 64 kbps) with `lamejs` in 1152-sample frames inside a yielding loop so long clips don't block the UI.
  - Returns a `Blob` of type `audio/mpeg`.
- In `recorder.onstop`: keep the current preview blob as-is (for in-app playback). Store the original blob/extension on `recordedAudio` so we can decide later.
- In `sendVoiceClip` for the `messenger` branch only: if the file isn't already MP3/M4A/WAV, run `convertToMp3` and upload that file as `voice_<ts>.mp3` with `Content-Type: audio/mpeg`. Telegram path is unchanged (Telegram handles Opus voice fine via the existing `media_type: 'voice'` flow, but we'll still send MP3 if we already converted — simpler).
- Keep `audioBitsPerSecond: 64000` and existing codec preference order (no change to capture).

### 2. `src/components/ChatPanel.tsx`
- In the voice bubble `<audio>` element add `<source src={message.voice_url} type="audio/mpeg" />` as the **first** source so new MP3 clips play in-app. Keep the existing `audio/webm` and `audio/ogg` sources as fallbacks for historical messages.

### 3. `package.json`
- Add dependency `lamejs` (small, pure-JS, browser-safe MP3 encoder; no native bindings).

## Out of scope
- No edge function changes — `messenger-webhook` `sendAttachment` already forwards whatever URL we upload.
- No DB / RLS / schema changes.
- No mobile capture change (mobile already produces a Messenger-compatible format).

## Validation
1. Desktop Chrome: record 5s voice → send to a Messenger customer → bubble on the customer side shows correct duration (~0:05) and plays audio.
2. Desktop Firefox: same test.
3. iOS Safari: record + send → still works (no regression; either skips conversion because already m4a, or converts cleanly).
4. Android Chrome: record + send → plays on the customer end.
5. In-app: own voice bubble and history bubbles still play (mp3 source preferred, webm/ogg fallback for older messages).
6. Telegram voice send: still works end-to-end.
