# Fix infinite "Loading Messages" on fast chat switching

## Root cause

In `src/hooks/useChatMessages.ts`:

1. A `useEffect` (lines 105–109) **unconditionally sets `isLoadingMessages = true`** every time `selectedCustomer.id` changes.
2. `loadMessages` (line 193) **early-returns on a cache hit** (lines 259–267) **without ever calling `setIsLoadingMessages(false)`**. The `finally` block that clears the flag is only reached on the network path.

Result: when you switch to a conversation whose messages are already in `messagesCache` (which happens constantly when bouncing back and forth between two chats), the loader is flipped on by the effect, the cache branch paints the messages and returns, and the loader is never flipped off → infinite "Loading Messages…" overlay even though the messages are actually rendered underneath.

A secondary race also exists: there is no guard against an in-flight `loadMessages(A)` resolving after the user has already selected B. The late resolution can overwrite B's `messages`, `messageOffset`, `hasMoreMessages`, `linkedCustomersMap`, and clobber the loading state with values from the stale conversation.

## Fix (single file: `src/hooks/useChatMessages.ts`)

1. **Cache hit must clear the loading flag.** In the early-return block at lines 259–267, call `setIsLoadingMessages(false)` (and `setIsLoadingMoreMessages(false)` for safety) before `return`.

2. **Guard against stale fetches on fast switching.** Add a ref like `activeCustomerIdRef` that tracks the most recently requested customer id:
   - Set `activeCustomerIdRef.current = customer.id` at the top of `loadMessages` (only when `offset === 0`).
   - Before every `setMessages / setMessageOffset / setHasMoreMessages / setLinkedCustomerIds / setLinkedCustomersMap / setIsLoadingMessages(false)` that happens after an `await`, check `if (activeCustomerIdRef.current !== customer.id) return;` so a late response for the previous conversation cannot overwrite the current one or wedge the loading state.
   - Apply the same guard in the cache-hit branch (a cache hit for the now-stale customer should also be a no-op).
   - In the `finally` block, only clear loading flags when the request is still the active one.

3. **Keep the "reset loading on customer change" effect** at lines 105–109 — it's correct intent, just needs the two fixes above so it always gets cleared.

No changes to UI components, edge functions, or message-sending logic. The voice-recording work from the previous turn stays untouched.

## Verification

- Rapidly click back and forth between two conversations in `/chat`. The "Loading Messages" overlay should disappear as soon as either cached or freshly fetched messages are rendered, every time.
- Open conversation A (cold) → switch to B (cold) → switch back to A: A should snap in from cache instantly with no spinner.
- Network-throttled: start opening A, immediately click B before A finishes. B must end up displayed; the late A response must not overwrite B or leave the spinner on.
- Pagination ("Load more") and a normal cold load of a brand-new conversation still work.
