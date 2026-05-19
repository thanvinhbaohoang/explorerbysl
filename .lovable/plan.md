## Issues & Goals

**1. Rotate button doesn't rotate**
Looking at `src/components/MediaViewer.tsx`, the icon labeled with `RotateCcw` is actually wired to `resetTransform()` — it resets zoom, it doesn't rotate. There's no real rotation logic.

**2. No way to flip through photos in a conversation**
Today, clicking a photo opens a single image. To find a previously-sent passport photo, the employee has to scroll the chat and click each one. We need an album/gallery viewer.

---

## Plan

### A. Make the rotate button actually rotate

In `MediaViewer.tsx`:
- Add `rotation` state (0/90/180/270).
- Wire the `RotateCcw` button to `setRotation(r => (r - 90 + 360) % 360)`.
- Apply `transform: rotate(${rotation}deg)` to the `<img>` inside `TransformComponent` (keep zoom/pan working via the wrapper).
- Add a small reset button (separate icon, e.g. `Maximize`) that resets both rotation and zoom — so we don't lose the reset action.
- On mobile, expose the rotate control too (currently the bottom toolbar is `hidden sm:flex`); show a compact rotate button in the top bar so phones can use it.

### B. Album view to navigate between photos in a conversation

Goal: when the employee opens any photo, they can swipe / arrow through every other photo (and video) from that customer's conversation, newest-first ordering preserved.

**Data source**
The chat already has all messages loaded in `ChatPanel` via `useChatMessages`. We'll derive an ordered media list from the same messages array — no extra fetch — containing `{ id, src, type, mimeType, timestamp }` for each message where `message_type` is `photo` or `video` (including items inside `MediaGroupBubble`).

**Component changes**
1. New `ChatMediaContext` (or simple prop drilling from `ChatPanel`) exposing the ordered `mediaItems` array.
2. Update `MediaThumbnail` (in `MediaViewer.tsx`) to accept an optional `mediaId` and, when clicked, open the viewer at that item's index in the album rather than as a standalone image.
3. Refactor `MediaViewer` into an album-aware viewer:
   - Props: `items: MediaItem[]`, `initialIndex: number`, `onClose`.
   - Internal `currentIndex` state.
   - Prev/Next buttons (left/right chevrons), keyboard arrows (← →), `Esc` to close.
   - Swipe gestures on mobile (touch start/end delta).
   - Counter in header: "3 / 27".
   - Thumbnail strip at the bottom (horizontal scroll, current item highlighted) — clicking a thumb jumps to it. Hidden on very small screens to save space; replaced by the counter + swipe.
   - Reset zoom & rotation when `currentIndex` changes.
4. Wire `MediaGroupBubble` and any single-photo/video bubble in `ChatPanel` to use the album-aware thumbnail so all media in the conversation participate in the same album.

**Ordering**
Media items sorted by message `timestamp` ascending (oldest → newest), matching chat order. Opening any thumbnail jumps to its index; Next moves forward in time, Prev moves backward. (Easy to flip if preferred.)

### Files to touch

- `src/components/MediaViewer.tsx` — rotation fix, album viewer (prev/next, counter, thumbstrip, keyboard, swipe), reset action.
- `src/components/ChatPanel.tsx` — build `mediaItems` from messages and provide via context/props.
- `src/components/MediaGroupBubble.tsx` — use album-aware thumbnail (pass `mediaId`).
- (Optional) small `ChatMediaContext.tsx` for clean prop passing.

### Out of scope
- A separate "Media gallery" page for a customer (already exists at `MediaGallery.tsx` — not touched here).
- Server-side pagination of media (all photos are already in the loaded chat window).
