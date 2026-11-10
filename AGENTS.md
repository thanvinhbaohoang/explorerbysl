# Agent rules

- Saved Replies only populate the chat composer (text + `processFiles`); never call send functions from them — delivery must stay on the existing Send path.
- `saved_replies` system columns (created_by, use_count, last_used_at, timestamps) are protected by column-level grants; change usage only via `record_saved_reply_use` — keeps clients from forging authorship or counts.
- Saved-reply pictures live in the private `saved-reply-media` bucket under `{reply_creator_id}/{reply_id}/`; upload before insert and delete on failure — avoids orphaned files and text-only leftovers.
- Unit tests run with `bun run test` (Vitest 2, pinned to stay compatible with Vite 5).
- Multi-picture Saved Replies read ordered child rows with legacy fallback, save complete sets through atomic RPCs, and drain the protected cleanup queue; download every picture before changing a draft to prevent partial albums.
- Saved Voice stores one canonical MP3 per entry in the private `saved-voice-media` bucket (`{creator}/{id}/`), writes only via RPCs; selecting loads a local copy into the voice draft and Telegram sends it with `strict_voice` (no sendAudio fallback) — keeps the library private and delivery voice-style.
- `chat-attachments` stays a public bucket so customers can open sent media by link, but its records can only be listed, added, replaced or deleted by approved staff (has_role); server functions write with service access — no anonymous listing.
- Message reactions use a dedicated staff-validated function with server-resolved provider IDs and server-owned state/leases; only provider-confirmed results become badges, and historical IDs are never guessed.
- Outgoing quoted replies use a separate staff-validated delivery function and persistent request IDs; ordinary sends stay unchanged, and ambiguous provider outcomes cannot be automatically resent.
