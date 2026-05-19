# Media Button in Chat Header

Add a quick-access **Media** button in the `ChatPanel` header that opens the existing `MediaViewer` album view directly, so employees can browse all photos/videos in the conversation without scrolling through messages.

## What it does

- A small button labeled **Media** with an Images icon, placed in the chat header (next to the platform switcher / summary button).
- Shows a count badge of the total media items in the current conversation (e.g. `Media · 27`).
- Disabled (greyed out) when the conversation has no photos/videos.
- Click → opens the existing fullscreen `MediaViewer` starting at index 0 (most recent or oldest depending on existing `mediaItems` order — we'll keep current sort).
- All existing viewer features apply automatically: thumbnail strip, prev/next, zoom, rotate, download, keyboard arrows, swipe.

## Files to change

**`src/components/ChatPanel.tsx`**
- Import `MediaViewer` from `@/components/MediaViewer` and `Images` icon from `lucide-react`.
- Add local state `const [mediaViewerOpen, setMediaViewerOpen] = useState(false)`.
- In the header (around line 385, inside the right-hand control group), render:
  - A `Button` (variant `outline`, size `sm`) with `Images` icon + "Media" label + count, disabled when `mediaItems.length === 0`.
- At the end of the component (before closing `ChatMediaProvider`), conditionally render `<MediaViewer items={mediaItems} initialIndex={0} onClose={() => setMediaViewerOpen(false)} />` when `mediaViewerOpen`.

No changes to `MediaViewer.tsx` or `ChatMediaContext.tsx` — they already support standalone usage with an items array.

## Out of scope

- No separate gallery page or grid view inside the chat (the existing fullscreen viewer + thumbnail strip already covers fast browsing).
- No filtering by photo vs video (could add later).
- No changes to mobile layout beyond the button rendering responsively in the existing header.
