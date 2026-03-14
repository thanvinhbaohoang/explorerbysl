

# Instant Chat Loading with Skeleton/Spinner

## Problem
When clicking a conversation in `/chat`, there's a noticeable unresponsive delay before the chat panel appears. The `ChatPanel` component mounts, then triggers `loadMessages` in a `useEffect`, which first queries linked customers before fetching messages. During this setup time, the UI feels frozen.

## Solution
Show the `ChatPanel` immediately on click with a loading state, so the transition feels instant. The existing loading spinner inside `ChatPanel` already works once `isLoadingMessages` is true -- the issue is that the state starts as `false` and only becomes `true` after the `useEffect` fires and `loadMessages` begins.

## Changes

| File | Change |
|------|--------|
| `src/hooks/useChatMessages.ts` | Initialize `isLoadingMessages` to `true` instead of `false`, so the spinner shows immediately when the component mounts with a new customer |
| `src/hooks/useChatMessages.ts` | Add a `useEffect` that resets `isLoadingMessages` to `true` when `selectedCustomer` changes, ensuring the spinner appears instantly on customer switch (before `loadMessages` is even called from ChatPanel) |

## Technical Details

In `useChatMessages.ts`:
1. Change `useState(false)` to `useState(!!selectedCustomer)` for `isLoadingMessages` -- this ensures the spinner renders on the very first frame when a customer is selected.
2. Add an effect that watches `selectedCustomer?.id` and sets `isLoadingMessages(true)` immediately, so switching between conversations also shows the spinner without any gap.

The cache check inside `loadMessages` already calls `setIsLoadingMessages(false)` in the `finally` block (and returns early for cached data), so cached conversations will still load near-instantly -- the spinner will flash only briefly or not at all for cached chats.

