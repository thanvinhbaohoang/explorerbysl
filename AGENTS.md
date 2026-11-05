# Agent rules

- Saved Replies only populate the chat composer (text + `processFiles`); never call send functions from them — delivery must stay on the existing Send path.
- `saved_replies` system columns (created_by, use_count, last_used_at, timestamps) are protected by column-level grants; change usage only via `record_saved_reply_use` — keeps clients from forging authorship or counts.
- Saved-reply pictures live in the private `saved-reply-media` bucket under `{reply_creator_id}/{reply_id}/`; upload before insert and delete on failure — avoids orphaned files and text-only leftovers.
- Unit tests run with `bun run test` (Vitest 2, pinned to stay compatible with Vite 5).
- Multi-picture Saved Replies read ordered child rows with legacy fallback, save complete sets through atomic RPCs, and drain the protected cleanup queue; download every picture before changing a draft to prevent partial albums.
