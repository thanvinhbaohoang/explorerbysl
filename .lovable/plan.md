## Fix media not persisting in chat

Make media (photos, voice, video, documents) reliably appear in the chatbox, both immediately after sending and after reopening a conversation.

### Root causes
1. Optimistic media bubbles in `useChatMessages.ts` set `photo_url/video_url/voice_url/document_url = null`, so the bubble is blank until the real-time INSERT round-trips.
2. Real-time INSERTs update live `messages` state but never write into `messagesCache`. On reopen, the stale cache hides messages that arrived while away.
3. Cache key derived from `linkedCustomerIds` is order-sensitive, so different mounts can read different cache slots.

### Changes (frontend only — `src/hooks/useChatMessages.ts`)
1. **Optimistic previews**: in `sendMedia`, `sendMediaBatch`, and voice send, set `photo_url`/`video_url`/`document_url`/`voice_url` on the optimistic message to `URL.createObjectURL(file/blob)`. Track and `URL.revokeObjectURL` when the temp message is replaced or removed.
2. **Realtime → cache sync**: in the realtime INSERT handler, after updating live `messages`, mirror the same dedupe + pending-replacement update into `messagesCache[cacheKey]` (and bump `messageMetaCache` offset). Do the same on UPDATE for read-receipt/url changes.
3. **Resilient cache reads**: sort `linkedCustomerIds` before composing `cacheKey`. When `loadMessages` hits the cache and the newest cached message is older than ~30s, kick off a background refresh and merge. Clear stale entries on `forceRefresh`.

### Out of scope
- No webhook / edge function changes — DB confirms inbound, echo, voice, and document media are already stored correctly.
- No DB schema or RLS changes.
- No edits to `ChatPanel.tsx` or `MediaGroupBubble.tsx` — rendering already handles all four media types.

### Verification
- Send a photo from the in-app composer → bubble shows the image instantly, persists after switching conversations and back.
- Reply with a photo from FB Page Inbox → echo appears in the chatbox without manual refresh and survives reopen.
- Customer sends a photo / voice / video / document → appears live and after reopen.
