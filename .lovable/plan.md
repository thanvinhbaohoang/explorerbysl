## Problem

In `ChatPanel.tsx`, scrolling up to load older messages snaps the viewport back to the bottom. Two bugs cause this:

1. **Auto-scroll effect (lines 174–180)** runs on every `filteredMessages.length` change. When older messages are prepended via pagination, length grows and the effect scrolls to `messagesEndRef` — yanking the user back down.
2. **No scroll anchoring on prepend.** When the page-2 query resolves and prepends ~50 items, the scrollTop stays at `0`, which both (a) re-triggers `handleScroll` (line 314) firing another `loadMessages` call, and (b) means the user has no visual anchor to the message they were reading.

## Fix (frontend-only, `src/components/ChatPanel.tsx`)

### 1. Track whether the next render is a prepend vs. a new-message append

- Add `prevMessageCountRef = useRef(0)` and `firstVisibleMessageIdRef = useRef<string | null>(null)`.
- Add `isPrependingRef = useRef(false)` set to `true` inside `handleScroll` right before calling `loadMessages(customer, messageOffset)`.

### 2. Replace the unconditional auto-scroll effect

Current behavior: scroll to bottom whenever `filteredMessages.length` or `platformFilter` changes.

New behavior:
- **Initial load / customer switch / platform switch:** scroll to bottom (keep existing UX).
- **New message appended at bottom** (length grew and last message id changed): scroll to bottom only if user was already near bottom (within ~100px) — otherwise leave them where they are so they can keep reading history while new replies arrive.
- **Prepend (older messages loaded):** do NOT scroll to bottom. Instead, after the DOM updates, restore scroll position so the previously-first-visible message stays under the user's eye:
  - Before the fetch, capture `firstVisibleMessageIdRef.current = filteredMessages[0]?.id` and capture `scrollContainerRef.current.scrollHeight` as `prevScrollHeight`.
  - After messages update, in a `useLayoutEffect`, set `scrollContainer.scrollTop = scrollContainer.scrollHeight - prevScrollHeight`. This is the standard "scroll anchor on prepend" pattern and avoids the snap.

### 3. Guard `handleScroll` against rapid retriggers

- Change the trigger from `scrollTop === 0` to `scrollTop < 50` so the user doesn't sit exactly at 0 after prepend.
- Bail out early when `isLoadingMoreMessages` is already true (already partially guarded, keep it).
- After a successful prepend, nudge `scrollTop` to a small positive value (handled implicitly by the anchor restore above, since `scrollHeight - prevScrollHeight` is > 0).

### 4. Add a `scrollContainerRef`

The messages scroller (`<div className="flex-1 overflow-y-auto ...">` at line 415) currently has no ref — add `ref={scrollContainerRef}` so we can read/write `scrollTop` and `scrollHeight` for the anchor logic.

## Out of scope

- No changes to `useChatMessages.ts`, pagination size, realtime handlers, or DB queries.
- No changes to the conversation list, header, input area, or mobile layout.
- No changes to platform-switch behavior (we're past that — each row is single-platform now).

## Verification

1. Open a conversation with >50 messages. Scroll to top — older messages load, scroll position stays anchored on the message you were viewing (no snap to bottom).
2. While scrolled up reading history, a new incoming message must NOT yank you to the bottom. A small "new messages" indicator is out of scope; the message simply appears at the bottom and you scroll down when ready.
3. On opening a conversation or switching platforms, view still lands at the bottom (latest message).
4. Sending a reply still scrolls to bottom (because the user is at the bottom when sending).