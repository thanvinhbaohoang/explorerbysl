

# Fix: Timestamps Not Showing in Chat Conversation List

## Problem

The timestamp code was added correctly in the previous edit, but it may not be rendering visibly due to two issues:

1. **Query limit bug**: The `fetchLastMessages` function fetches all messages ordered by timestamp with Supabase's default 1000-row limit. With 1328+ messages, many customers won't get their last message loaded into the `lastMessages` state.

2. **Potential visual clipping**: The timestamp span might be getting clipped in narrow panel widths despite `flex-shrink-0`.

## Fix

### 1. Fix `fetchLastMessages` query (lines 131-135)

Instead of fetching all messages and relying on JS deduplication, use a more efficient approach -- fetch only the distinct latest message per customer using an RPC or simply ensure we don't hit the limit by querying per-batch. The simplest fix: since `customer.last_message_at` is already populated in the database, we can rely on it as the primary timestamp source and only use `lastMessages` for the preview text and real-time updates.

Change line 543 to prioritize `customer.last_message_at` as timestamp source and ensure it always renders something visible.

### 2. Make timestamp more visible

Add a `whitespace-nowrap` class to the timestamp span to prevent wrapping and ensure it's always visible even in narrow panels.

### 3. Add fallback display

If no timestamp is available at all, show a dash or empty string to make it clear the field exists.

## Files Changed

| File | Change |
|------|--------|
| `src/components/ChatConversationList.tsx` | Fix timestamp display: add `whitespace-nowrap`, ensure `lastMessage` query doesn't hit row limit by using `.limit()` per customer approach or relying on `customer.last_message_at` as primary source. Force re-render with a key change if needed. |

## Technical Details

- Modify `fetchLastMessages` to batch queries or add explicit `.limit(1000)` awareness -- simplest: use an RPC that gets `DISTINCT ON (customer_id)` to get exactly one message per customer
- Alternatively, create a database view or use the existing `customer.last_message_at` field as the sole timestamp source (it's already populated)
- Add `whitespace-nowrap` and `min-w-[3rem]` to the timestamp `<span>` to guarantee visibility
- The real-time `lastMessages` state will continue to update timestamps on new messages

