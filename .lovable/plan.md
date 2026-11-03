# Inbox Conversation Filters: All / Unread / Not Replied (revised)

A minimal, regression-safe filter for the chat inbox. The existing "All" query path and its cache key stay byte-for-byte unchanged; the two new filters run through one new additive, read-only RPC.

## 1. The SQL migration (full text)

One new function, nothing else. No table/column/RLS changes, no data writes.

```sql
CREATE OR REPLACE FUNCTION public.get_filtered_customer_ids(
  p_filter text,                        -- 'unread' | 'not_replied'
  p_search text DEFAULT '',
  p_platform text DEFAULT 'all',        -- 'all' | 'telegram' | 'messenger'
  p_messenger_enabled boolean DEFAULT true,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT c.id, c.last_message_at
    FROM public.customer c
    WHERE
      -- same visibility rules as the existing All query
      (p_messenger_enabled OR c.messenger_id IS NULL OR c.messenger_name <> 'Unknown')
      AND (p_platform <> 'telegram'  OR (c.telegram_id IS NOT NULL AND c.messenger_id IS NULL))
      AND (p_platform <> 'messenger' OR c.messenger_id IS NOT NULL)
      AND (p_search = '' OR
           c.first_name ILIKE '%' || p_search || '%' OR
           c.last_name  ILIKE '%' || p_search || '%' OR
           c.username   ILIKE '%' || p_search || '%' OR
           c.messenger_name ILIKE '%' || p_search || '%')
      AND (
        (p_filter = 'unread' AND EXISTS (
          SELECT 1 FROM public.messages m
          WHERE m.customer_id = c.id AND m.sender_type = 'customer' AND m.is_read = false
        ))
        OR
        (p_filter = 'not_replied' AND (
          SELECT m.sender_type FROM public.messages m
          WHERE m.customer_id = c.id
          ORDER BY m.timestamp DESC, m.created_at DESC, m.id DESC
          LIMIT 1
        ) = 'customer')
      )
    ORDER BY c.last_message_at DESC NULLS LAST, c.id
  ),
  counted AS (
    SELECT count(*) AS total FROM base
  ),
  paged AS (
    SELECT id FROM base LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'customer_ids', COALESCE((SELECT jsonb_agg(id) FROM paged), '[]'::jsonb),
    'total_count', (SELECT total FROM counted)
  );
$$;

-- Lock down, then grant narrowly: SECURITY DEFINER must not be publicly executable
REVOKE EXECUTE ON FUNCTION public.get_filtered_customer_ids(text, text, text, boolean, int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_filtered_customer_ids(text, text, text, boolean, int, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_filtered_customer_ids(text, text, text, boolean, int, int) TO authenticated;
```

Key properties:
- Returns a **single JSON object** `{ customer_ids: [...], total_count: N }` — always returned, even when the page is empty or out of range (`customer_ids` is `[]`, `total_count` still correct).
- Read-only `SELECT` — no INSERT/UPDATE/DELETE.
- Deterministic ordering: customers by `last_message_at DESC NULLS LAST, id`; latest-message lookup by `timestamp DESC, created_at DESC, id DESC`.
- Filter + sort happen in SQL **before** LIMIT/OFFSET — pagination is correct across the whole dataset.
- Does not touch or reuse `get_unanswered_customer_ids` or `get_unread_counts`.
- After applying: run `EXPLAIN ANALYZE` for both filter modes. If `not_replied` is slow, add an additive composite index `CREATE INDEX idx_messages_customer_ts ON public.messages (customer_id, timestamp DESC);` in the same or a follow-up migration.

## 2. File-by-file change plan

### `src/hooks/useCustomersData.ts`
- `customersQueryKey` and `useCustomersData` gain a `filter` parameter defaulting to `"all"`.
- Cache key rule: when `filter === "all"`, the key is **exactly the existing 5-element key** (unchanged). Only for `"unread"` / `"not_replied"` is the filter appended as a 6th element.
- `fetchCustomersPage`: if `filter === "all"`, run the existing code path unchanged. Otherwise:
  1. `supabase.rpc("get_filtered_customer_ids", { p_filter: filter, p_search: searchTerm, p_platform: platformFilter, p_messenger_enabled: messengerEnabled, p_limit: itemsPerPage, p_offset: (page - 1) * itemsPerPage })`
  2. Read `data.customer_ids` / `data.total_count` from the JSON result; if `customer_ids` is empty, return `{ customers: [], total: total_count, linkedPlatformsMap: {} }` immediately.
  3. Fetch full customer rows with `.in("id", ids)` and re-order them to match the RPC's ID order (`.in()` does not preserve order).
  4. Attach `lead_source` exactly as the existing code does.

### `src/components/ChatConversationList.tsx`
- New state: `const [filter, setFilter] = useState<"all" | "unread" | "not_replied">("all")`.
- Segmented control below the search field, built from existing `Button`/`cn` primitives and theme tokens: `[All] [Unread] [Not Replied]`, compact (`h-7`, `text-xs`), active segment styled like the existing muted/selected row treatment.
- `setFilter` also calls `setPage(1)` (uses the existing lifted page state).
- Pass `filter` into `useCustomersData`, `refreshPageOneInBackground`, and the next-page prefetch (both its `queryKey` and its `queryFn`), plus their dependency arrays.
- **keepPreviousData guard:** when `filter !== "all"`, do not render `placeholderData` rows from a previous filter. While the filtered query is pending, show the skeleton loading state (or an empty list) instead of stale All-tab rows.
- Empty states: Unread → "No unread conversations"; Not Replied → "No conversations waiting for a reply"; All → unchanged.
- Header count line reflects the filtered total automatically (same query data).

### `src/pages/Chat.tsx`
- No change required.

### Generated types
- Regenerate `src/integrations/supabase/types.ts` after the migration and **verify** `get_filtered_customer_ids` is present in the file before wiring the client call (explicit check, not assumed).

## 3. Realtime update strategy (immediate, no 30s wait)

Existing subscriptions stay; three targeted refetches are added, all invalidating the **current filter's** query key:

1. **Mark-read success** (`handleSelect`'s messages update resolves) → invalidate the current Unread query so the conversation leaves the Unread list immediately.
2. **Employee message INSERT** (existing realtime handler) → invalidate the current Not Replied query so the conversation leaves Not Replied immediately.
3. **Customer message INSERT** (existing handler) → invalidate the current filtered query (Unread and Not Replied both gain the conversation) in addition to the existing local preview/unread updates and `refreshPageOneInBackground`.
4. The 30-second page-1 polling fallback remains as a safety net, but nothing depends on it.

Invalidations use the filter-aware key; the All key is never touched by filtered-tab logic.

## 4. Regression test checklist

1. **All tab**: list, sorting, pagination, search, unread badges, waiting badges, platform icons, realtime toasts — identical to today; cache key unchanged (verify no refetch storm on mount).
2. **Unread tab**: only conversations with unread customer messages; opening one clears the badge and removes it from the list immediately after mark-read resolves.
3. **Not Replied tab**: only conversations whose latest message is from the customer; opening does not remove it; sending a reply removes it immediately on the employee-message insert.
4. **Tab switch**: no flash of All-tab rows under Unread/Not Replied (loading/empty state shown instead).
5. **Pagination**: filter change resets to page 1; totals/pages reflect the whole filtered dataset; browsing older pages is not yanked back by incoming messages.
6. **Search**: dropdown search still works independently of the active filter.
7. **Realtime**: new customer message makes the conversation appear in Unread/Not Replied without waiting 30s; sounds and previews still fire.
8. **Mobile**: segmented control fits the narrow pane; fullscreen chat navigation unchanged.
9. **Messenger toggle off**: broken "Unknown" messenger profiles stay hidden on all tabs.
10. **RPC security**: calling the RPC as anon fails; as authenticated succeeds (verified via a direct query after migration).

## 5. Rollback strategy

- Frontend: revert the two file edits — the All path and key are untouched, so reverting fully restores current behavior.
- Database: `DROP FUNCTION public.get_filtered_customer_ids(text, text, text, boolean, int, int);` (and `DROP INDEX IF EXISTS idx_messages_customer_ts;` if the index was added). No data or existing schema is affected.
- No backfill or restore needed — nothing existing is modified.

## Scope limits

Only `ChatConversationList.tsx`, `useCustomersData.ts`, generated types, and one additive migration. No Telegram, Messenger, auth, sending, attachment, customer-linking, or existing table changes.
