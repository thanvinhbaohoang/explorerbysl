# Saved Voice Messages (Preview only)

## Goal
A shared library of reusable voice messages. Staff record or upload a message once, give it a title and keywords, and later load it into the voice composer. It only sends when they press the voice Send button.

## What staff will see
- A new **Saved Voice** button right after Saved Replies, on desktop and mobile:
  `[Attachment] [Voice] [Saved Replies] [Saved Voice] [Message] [Send]`
  It matches the other buttons and has a tooltip and an accessible name. On narrow screens the message box still has room to type.
- The button opens a searchable panel: a bottom sheet on mobile, matching Saved Replies. Each entry shows its title, keywords, length and a Play preview. Search covers title and keywords. There are New, Edit and Delete actions.
- **New / Edit form:** title, keywords, and either Record or Upload (MP3, M4A, OGG or WebM). It shows a playable preview before saving.
- **Choosing an entry:** the panel loads it into the existing voice preview bar with play and the correct length. It does not send. If there is already text, pictures or a recording, it asks before replacing them (Cancel / Replace).
- **Sending:** the existing voice Send button only. Messenger's 24-hour window is respected as it is today.

## Rules
- Approved staff can view and use entries. Only the creator or an admin can edit or delete one, the same as Saved Replies.
- Recordings are stored privately. Limits: 5 MB maximum and between 1 and 120 seconds. The file type is checked from the file's actual content.
- Every saved voice is converted once, when saved, into a single voice-friendly format (MP3). Both Telegram voice notes and Messenger audio accept it.

## Delivery behavior
- **Telegram:** Saved Voice always uses Telegram's voice-note method. If Telegram rejects it, staff see a clear error and the app does **not** resend it as a plain audio file. Normal voice recordings keep today's behavior, as you chose.
- **Messenger (both pages):** Messenger has no separate "voice note" type for business pages; voice is sent as an audio attachment. I will test both pages and check the recipient's view with screenshots. If it does not appear as a playable voice clip with the correct length, I will report it as a limitation and not mark it complete.

## Testing (Preview only, nothing published)
- Button order and size on desktop and on mobile (390 px); a narrow screen still lets staff type.
- Search, recording, upload of each allowed type, rejection of oversized, too-long or wrong files, preview, and Cancel/Replace when a draft exists.
- Permissions: other staff cannot edit or delete; signed-out users are denied; direct database writes are denied.
- Delivery only to the three approved internal chats (Telegram Huth Sakda, Explorer by SL Messenger, Travel Agency Messenger), with screenshots of the recipient's view.
- Regression: Saved Replies (all 42 untouched) and normal voice recording/sending still work.
- Test data is clearly labelled and deleted afterward, including test files and test messages where possible.
- Unit tests, build, type check and security scan.

## Technical details
- **One additive migration:** creates the `saved_voices` table (id, title, keywords[], audio_path, mime_type, size, duration_sec, created_by, use_count, last_used_at, timestamps). It has the same grants and RLS pattern as `saved_replies`: system columns are protected by column-level grants; create, update and delete go through SECURITY DEFINER RPCs with staff, creator and admin checks; and a `record_saved_voice_use` RPC tracks usage. Validation triggers check size and duration. Storage policies cover the new private bucket `saved-voice-media` (created with the storage tool, 5 MB limit) under `{creator_id}/{voice_id}/`. The migration includes a guard that the bucket exists and is private. Upload happens before the insert, and the file is deleted if saving fails.
- **New files:** `src/lib/savedVoices.ts` (validation, search, magic-byte checks, duration probe), `src/hooks/useSavedVoices.ts`, `src/components/SavedVoicePanel.tsx`, `src/components/SavedVoiceDialog.tsx`, and `src/lib/savedVoices.test.ts`. Conversion reuses the existing `audio-conversion` (lamejs) helper.
- **`ChatPanel.tsx`:** adds the button after `SavedRepliesPanel` and the selection handler.
- **`useChatMessages.ts`:** a small addition only. A new `loadVoiceDraft(file, durationSec, { savedVoice: true })` sets the existing recorded-audio state and duration. `sendVoiceClip` passes `strict_voice: true` for Telegram when the draft came from Saved Voice. All other send logic is unchanged.
- **`telegram-bot` edge function:** when `strict_voice` is true, `sendVoice` returns the error instead of falling back to `sendAudio`. The default path is unchanged. The function is redeployed.
- `AGENTS.md` gets one new rule for the Saved Voice architecture.
- Not changed: Saved Replies data, the inbox filters, sign-in, the other integrations, and the existing migrations.

## Report you will get
Changed files, the migration, test results, screenshots (button placement, panel, recipient views), limitations, and a final SAFE / NOT SAFE TO PUBLISH verdict. Nothing will be published automatically.
