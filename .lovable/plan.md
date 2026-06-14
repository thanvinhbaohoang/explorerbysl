## Plan

1. Update every Messenger voice-send entry point to convert recorded audio to MP3 before upload, not just the chat hook.
2. Add a hard validation/logging step so Messenger voice sends fail or warn if the uploaded file is not `audio/mpeg` / `.mp3`.
3. Make the in-app audio player include MP3 source support so the saved voice message matches the actual uploaded format.
4. Verify the request body sent to the backend now contains an `.mp3` storage URL instead of `.webm`.

## What likely went wrong

- The captured network request shows Messenger was sent:
  `.../chat-media/...webm`
- That means Messenger still received the browser recording format, which explains the 0-duration/unplayable result.
- There is at least one other voice-send path in the codebase (`src/pages/Customers.tsx`) that still uploads the original file without conversion.
- It is also possible the preview was on stale client code when the test ran.

## Technical details

- `src/hooks/useChatMessages.ts` already attempts MP3 conversion for Messenger.
- `src/pages/Customers.tsx` still uploads the raw recorded file for Messenger and needs the same conversion logic.
- `src/components/ChatPanel.tsx` currently only renders `audio/webm` and `audio/ogg` sources for voice playback; add `audio/mpeg`.
- Validation target: the outbound `media_url` for Messenger should end in `.mp3` and storage metadata should reflect `audio/mpeg`.

## Success criteria

- A new Messenger voice send produces a storage URL ending in `.mp3`.
- Messenger shows a real duration and the clip plays.
- The app still previews and stores Telegram voice messages as before.