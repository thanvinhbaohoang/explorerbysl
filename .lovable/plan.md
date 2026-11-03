# Inbox Conversation Filters: All / Unread / Not Replied (final)

A minimal, regression-safe filter for the chat inbox. The existing "All" query path and its exact cache key stay unchanged; the two new filters run through one new additive, read-only RPC.

## 1. Final SQL migration (full text)

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
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Parameter validation and clamping
  IF p_filter NOT IN ('unread', 'not_replied') THEN
    RAISE EXCEPTION 'Invalid filter: %. Must be unread or not_replied', p_filter;
  END IF;
  p_limit := GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
  p_offset := GREATEST(0, COALESCE(p_offset, 0));

  RETURN (
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
    ),
    counted AS (
      SELECT count(*) AS total FROM base
    ),
    paged AS (
      SELECT b.id
      FROM base b
      ORDER BY b.last_message_at DESC NULLS LAST, b.id
      LIMIT p_limit OFFSET p_offset
    )
    SELECT jsonb_build_object(
      'customer_ids', COALESCE(
        (SELECT jsonb_agg(p.id ORDER BY b2.last_message_at DESC NULLS LAST, b2.id)
         FROM paged p JOIN base b2 ON b2.id = p.id),
        '[]'::jsonb
      ),
      'total_count', (SELECT total FROM counted)
    )
  );
END;
$$;

-- Lock down, then grant narrowly: SECURITY DEFINER must not be publicly executable
REVOKE EXECUTE ON FUNCTION public.get_filtered_customer_ids(text, text, text, boolean, int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_filtered_customer_ids(text, text, text, boolean, int, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_filtered_customer_ids(text, text, text, boolean, int, int) TO authenticated;
```

Key properties:
- Returns a **single JSON object** `{ customer_ids: [...], total_count: N }` — always returned, even when the page is empty or out of range (`customer_ids` is `[]`, `total_count` still correct).
- Deterministic ordering applied in the `paged` CTE and in `jsonb_agg`: `last_message_at DESC NULLS LAST`, customer `id` as tie-breaker. Latest-message lookup ordered by `timestamp DESC, created_at DESC, id DESC`.
- Parameters validated: `p_filter` must be `unread`/`not_replied`; `p_limit` clamped to 1–100; `p_offset` clamped to ≥ 0.
- Read-only — no INSERT/UPDATE/DELETE. Does not touch or reuse `get_unanswered_customer_ids` or `get_unread_counts`.
- After applying: run `EXPLAIN ANALYZE` for both filter modes before publishing. If `not_replied` is slow, add an additive index in a follow-up migration:
  `CREATE INDEX idx_messages_customer_ts ON public.messages (customer_id, timestamp DESC, created_at DESC, id DESC);`

## 2. Final file-by-file implementation plan

### `src/hooks/useCustomersData.ts`
- `customersQueryKey` and `useCustomersData` gain a `filter` parameter defaulting to `"all"`.
- Cache key rule: when `filter === "all"`, the key is **exactly the existing 6-element key** `["customers", page, itemsPerPage, searchTerm, platformFilter, messengerEnabled]` — unchanged. Only for `"unread"` / `"not_replied"` is the filter appended as a 7th element.
- `fetchCustomersPage`: if `filter === "all"`, run the existing code path unchanged. Otherwise:
  1. Call the RPC with `{ p_filter: filter, p_search: searchTerm, p_platform: platformFilter, p_messenger_enabled: messengerEnabled, p_limit: itemsPerPage, p_offset: (page - 1) * itemsPerPage }`.
  2. **Defensively validate the response**: RPC error → throw; if the JSON is missing `customer_ids` (array) or `total_count` (number) → throw. A malformed response must surface as an error state, never as an apparently empty inbox.
  3. If `customer_ids` is empty, return `{ customers: [], total: total_count, linkedPlatformsMap: {} }`.
  4. Fetch full customer rows with `.in("id", ids)` and re-order them to match the RPC's ID order (`.in()` does not preserve order).
  5. Attach `lead_source` exactly as the existing code does.

### `src/pages/Chat.tsx`
- **Filter state is lifted here**: `const [filter, setFilter] = useState<"all" | "unread" | "not_replied">("all")`. This is required because on mobile `ChatConversationList` unmounts when a conversation is opened — component-local state would silently reset to All after pressing Back.
- Pass `filter` and `onFilterChange` into **both** the mobile and desktop `ChatConversationList` instances.

### `src/components/ChatConversationList.tsx`
- Accept `filter` / `onFilterChange` props (with local-state fallback only if uncontrolled, matching the existing page-state pattern).
- Segmented control below the search field, built from existing `Button`/`cn` primitives and theme tokens: `[All] [Unread] [Not Replied]`, compact (`h-7`, `text-xs`), active segment styled like the existing muted/selected row treatment.
- Changing the filter also calls `setPage(1)`.
- Pass `filter` into `useCustomersData`, `refreshPageOneInBackground`, and the next-page prefetch (both its `queryKey` and its `queryFn`), plus their dependency arrays.
- **keepPreviousData guard:** when `filter !== "all"`, do not render `placeholderData` rows from a previous filter — show the skeleton loading state (or empty list) until the filtered query resolves.
- **Filtered page clamping:** if a filtered total shrinks to 0 while the user is on page ≥ 2, return to page 1. The existing All-tab clamp behavior stays unchanged.
- Empty states: Unread → "No unread conversations"; Not Replied → "No conversations waiting for a reply"; All → unchanged.
- Header count line reflects the filtered total automatically (same query data).

### Generated types
- Regenerate `src/integrations/supabase/types.ts` after the migration and **verify** `get_filtered_customer_ids` is present in the file before wiring the client call (explicit check, not assumed).

## 3. Realtime update strategy (immediate, predicate-based)

A new helper invalidates **every cached page** of an affected filter via a React Query predicate (matching `queryKey[0] === "customers"` and `queryKey[6] === filter`). It never touches the All cache (6-element keys have no element 7, so they can't match).

1. **Customer message INSERT** (existing realtime handler) → invalidate all `unread` and `not_replied` cached pages, in addition to the existing local preview/unread updates and `refreshPageOneInBackground`.
2. **Employee message INSERT** (existing handler) → invalidate all `not_replied` cached pages so a replied conversation leaves Not Replied immediately.
3. **Mark-read success** (`handleSelect`'s messages update resolves) → invalidate all `unread` cached pages so the conversation leaves Unread immediately.
4. The 30-second page-1 polling fallback remains as a safety net, but nothing depends on it.

## 4. Regression test checklist

1. **All tab**: list, sorting, pagination, search, unread badges, waiting badges, platform icons, realtime toasts — identical to today; cache key unchanged (verify no refetch storm on mount).
2. **Unread tab**: only conversations with unread customer messages; opening one clears the badge and removes it from the list immediately after mark-read resolves.
3. **Not Replied tab**: only conversations whose latest message is from the customer; opening does not remove it; sending a reply removes it immediately on the employee-message insert.
4. **Tab switch**: no flash of All-tab rows under Unread/Not Replied (loading/empty state shown instead).
5. **Pagination**: filter change resets to page 1; totals/pages reflect the whole filtered dataset; browsing older pages is not yanked back by incoming messages; filtered total hitting 0 on page ≥ 2 returns to page 1.
6. **Mobile**: open a conversation from a filtered list, press Back — the same filter is still active (state lifted to Chat.tsx); segmented control fits the narrow pane.
7. **Search**: dropdown search still works independently of the active filter.
8. **Realtime**: new customer message makes the conversation appear in Unread/Not Replied without waiting 30s; sounds and previews still fire.
9. **Messenger toggle off**: broken "Unknown" messenger profiles stay hidden on all tabs.
10. **RPC security**: calling the RPC as anon fails; as authenticated succeeds (verified via direct query after migration).
11. **Malformed response**: if the RPC errors or returns unexpected JSON, the list shows an error state, not an empty inbox.

## 5. Rollback strategy

- Frontend: revert the three file edits — the All path and key are untouched, so reverting fully restores current behavior.
- Database: `DROP FUNCTION public.get_filtered_customer_ids(text, text, text, boolean, int, int);` (and `DROP INDEX IF EXISTS idx_messages_customer_ts;` if the index was added). No data or existing schema is affected.
- No backfill or restore needed — nothing existing is modified.

## Scope limits

Only `src/components/ChatConversationList.tsx`, `src/hooks/useCustomersData.ts`, `src/pages/Chat.tsx`, generated Supabase types, and one additive migration. No Telegram, Messenger, auth, sending, attachment, customer-linking, or existing table changes.
