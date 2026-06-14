## Two bugs to fix in PC voice messages

### Bug 1 — Voice bubble disappears from our chat box after "Voice message sent"

**Root cause.** In `sendVoiceClip` (`src/hooks/useChatMessages.ts` ~line 930) the optimistic bubble is removed by `tempId` as soon as the edge function returns, expecting the Realtime `INSERT` to add the persisted row. For voice this race fails frequently:

- MP3 conversion + upload + Facebook send takes several seconds, during which `selectedCustomer` / `linkedCustomerIds` can change identity and resubscribe the Realtime channel (effect deps at line 1032 use object identity), causing the `INSERT` event to be dropped.
- The edge function inserts the row without `messenger_mid` reliably matched to anything client-side, so even if Realtime arrives late we can't dedupe; and if it arrives before line 930 the pending-replace path runs, then line 930 still no-ops (good), but if it arrives after, the bubble is briefly gone.

Net effect: the bubble vanishes until a refetch.

**Fix.** Stop deleting the optimistic message on success. Instead, mutate it in place into a non-pending message that points at the uploaded `mediaUrl`, and let Realtime dedupe by tempId vs real id.

- In `sendVoiceClip` success path: replace the `setMessages(prev => prev.filter(msg => msg.id !== tempId))` with a `setMessages(prev => prev.map(...))` that, for the message with `id === tempId`, sets `isPending: false`, `voice_url: mediaUrl`, and stores a new field `messenger_mid: response.data?.message_id ?? null`.
- In the Realtime `INSERT` handler (around lines 980–998), when `newMessage.sender_type === 'employee'`, prefer to dedupe by `messenger_mid` first (if both sides have one), then fall back to the existing "replace first pending" path. If a non-pending optimistic with matching `messenger_mid` already exists, drop the incoming insert instead of appending.
- Keep the blob URL alive until the row is replaced by the real Realtime row (don't `revokeBlobUrls(tempId)` on success; revoke it when the Realtime row replaces it, or on unmount via the existing tracker).
- Apply the same shape change to `messagesCache` mirror so re-open keeps the bubble.

This mirrors how text/photo behave reliably and removes the visible gap.

### Bug 2 — Messenger still shows 0:00 for PC voice

The previous attempt switched to `@breezystack/lamejs`. The "lamejs is not defined" runtime error in the console is from the pre-fix bundle (timestamp before the dev server reload) — but even with a clean lamejs build, Messenger's audio player frequently reports 0:00 for CBR MP3 produced by lamejs because the stream has no Xing/Info VBR header and no ID3 `TLEN` tag; some Messenger surfaces use that header for the duration label.

**Fix.** Drop MP3 entirely and encode a **WAV (PCM 16-bit)** blob instead. WAV is on Messenger's supported audio attachment list, requires no external library, and embeds duration directly via the RIFF/`fmt ` chunk so Messenger's player shows the real length and plays back.

- Rewrite `src/lib/audio-conversion.ts`:
  - Keep `isMessengerFriendlyAudio` regex.
  - Replace `convertToMp3` with `convertToWav(blob): Promise<Blob>` that:
    1. Decodes via `AudioContext.decodeAudioData`.
    2. Downmixes to mono Float32.
    3. Writes a standard 44-byte RIFF/WAVE PCM-16 header followed by Int16 PCM samples at the source sample rate (no resampling needed; Messenger accepts common rates).
    4. Returns a `Blob` of type `audio/wav`.
  - Remove the `@breezystack/lamejs` import. Remove the package from `package.json`.
- In `useChatMessages.ts` `sendVoiceClip`: rename import to `convertToWav`, upload as `voice_<ts>.wav` with `Content-Type: audio/wav`.
- In `ChatPanel.tsx` voice `<audio>` element: add `<source ... type="audio/wav" />` as the first source; keep mp4/webm/ogg fallbacks for historical messages (mp3 source can stay too — harmless).

### Out of scope

- No edge-function, DB, RLS, or schema changes.
- No change to mobile capture path (mobile already produces a Messenger-friendly format and skips conversion via `isMessengerFriendlyAudio`).
- No change to Telegram voice send.

### Validation

1. Desktop Chrome record 5s → send to Messenger → bubble in our app stays visible the whole time, never disappears; toast "Voice message sent" appears; refresh and the same bubble is still there exactly once (no duplicate).
2. Same clip on customer's Messenger shows ~0:05 duration and plays.
3. Desktop Firefox: same.
4. iOS Safari: still works, no double-send, no duplicate bubble.
5. Telegram voice send: still works end-to-end.
6. Console: no `lamejs is not defined`, no Realtime resubscribe warnings during a send.
