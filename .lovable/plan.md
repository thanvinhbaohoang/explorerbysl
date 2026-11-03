# Inbox Conversation Filters: All / Unread / Not Replied

A minimal, regression-safe filter for the chat inbox. The existing "All" query path stays byte-for-byte unchanged; the two new filters run through one new additive, read-only RPC.

## 1. File-by-file change plan

### A. New SQL migration: `get_filtered_customer_ids` RPC
One new function, nothing else. No table/column/RLS changes, no data writes.

```sql
CREATE OR REPLACE FUNCTION public.get_filtered_customer_ids(
  p_filter text,              -- 'unread' | 'not_replied'
  p_search text DEFAULT '',
  p_platform text DEFAULT 'all',        -- 'all' | 'telegram' | 'messenger'
  p_messenger_enabled boolean DEFAULT true,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE(customer_id uuid, total_count bigint)
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
          ORDER BY m.timestamp DESC LIMIT 1
        ) = 'customer')
      )
    ORDER BY c.last_message_at DESC NULLS LAST
  )
  SELECT b.id, (SELECT count(*) FROM base) AS total_count
  FROM base b
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_filtered_customer_ids(text, text, text, boolean, int, int) TO authenticated;
```

Notes:
- Read-only `SELECT` — no INSERT/UPDATE/DELETE.
- Mirrors the All query's visibility rules (messenger toggle, platform, search) so results are consistent.
- Filter + sort happen in SQL **before** LIMIT/OFFSET, so pagination is correct across the whole dataset, not just the loaded page.
- Does not touch or reuse `get_unanswered_customer_ids` or `get_unread_counts`.

### B. `src/hooks/useCustomersData.ts`
- Add a `filter` parameter (default `"all"`) to `customersQueryKey` and `useCustomersData`, appended at the end of the key so existing cached "all" entries are untouched.
- In `fetchCustomersPage`: if `filter === "all"`, run the **existing code path unchanged**. Otherwise:
  1. `supabase.rpc("get_filtered_customer_ids", { p_filter, p_search, p_platform, p_messenger_enabled, p_limit: itemsPerPage, p_offset: (page-1)*itemsPerPage })`
  2. Fetch full customer rows with `.in("id", ids)` and re-order them to match the RPC's ID order (`.in()` does not preserve order).
  3. Attach lead_source exactly as the existing code does.
  4. Return `{ customers, total: total_count, linkedPlatformsMap: {} }`.

### C. `src/components/ChatConversationList.tsx`
- New state: `const [filter, setFilter] = useState<"all" | "unread" | "not_replied">("all")`.
- Segmented control rendered directly below the search field, using existing `Button`/`cn` primitives and theme tokens (no hardcoded colors):
  `[All] [Unread] [Not Replied]` — compact, `h-7`/`text-xs`, active segment uses `bg-muted`/secondary variant styling consistent with the current design.
- `setFilter` also calls `setPage(1)` (resets pagination via the existing lifted page state in `Chat.tsx`).
- Pass `filter` into `useCustomersData`; the key change automatically refetches.
- Empty states:
  - Unread: "No unread conversations"
  - Not Replied: "No conversations waiting for a reply"
  - All: existing behavior unchanged.
- Header count line (`{totalCustomers} customers`) now reflects the filtered total automatically since it reads from the same query.

### D. `src/pages/Chat.tsx`
- No change required. Filter state lives in `ChatConversationList`; page state is already lifted and `onPageChange(1)` handles the reset.

### E. Generated types
- Regenerate `src/integrations/supabase/types.ts` happens automatically with the migration on Lovable Cloud; no manual edit.

### F. Tests
- The project has no test runner configured, so verification is a manual regression checklist (section 4) plus a direct RPC smoke test against the database after the migration.

## 2. RPC input/output contract

| Input | Type | Meaning |
|---|---|---|
| `p_filter` | text | `'unread'` or `'not_replied'` |
| `p_search` | text | `''` = no search (list passes `''`, same as today) |
| `p_platform` | text | `'all'` (list always passes `'all'` today) |
| `p_messenger_enabled` | boolean | from `useMessengerIntegration` |
| `p_limit` / `p_offset` | int | page size 20, offset from page number |

Output rows: `customer_id uuid`, `total_count bigint` (same total repeated on every row; 0 rows when the filter matches nothing, in which case the client treats total as 0).

Semantics:
- **unread**: customer has ≥1 message with `sender_type='customer' AND is_read=false`.
- **not_replied**: the customer's latest message (by `timestamp`) has `sender_type='customer'`.

## 3. Realtime update strategy

No changes to the existing subscriptions. They keep working because:
- New message INSERT → existing handler updates `lastMessages`, unread counts, and `last_message_at` locally, and calls `refreshPageOneInBackground()` for unknown conversations.
- One addition: the background refresh and the page-1 polling refetch must invalidate the **current filter's** query key, not the hardcoded `("customers", 1, 20, "", "all", …)` key. `refreshPageOneInBackground` will include `filter` in the key it invalidates.
- When a conversation is opened, `handleSelect` already marks messages read in the DB. On the next refetch (poll, page change, or realtime invalidation) it naturally drops out of Unread. Not Replied is unaffected by opening — it only clears when an employee message is inserted, which the existing realtime INSERT handler already observes; the next refetch removes it from the list.
- The 30-second polling fallback (page 1 only) keeps filtered lists fresh without extra subscriptions.

## 4. Regression test checklist

1. **All tab (unchanged path)**: list, sorting, pagination, search, unread badges, waiting-time badges, platform icons, realtime toast + preview updates — all behave exactly as before.
2. **Unread tab**: shows only conversations with unread customer messages; count line matches; opening a conversation clears its badge and (after refetch) removes it from the list.
3. **Not Replied tab**: shows only conversations whose latest message is from the customer; opening one does **not** remove it; sending a reply (employee message) removes it on next refetch.
4. **Pagination**: filter change resets to page 1; Prev/Next work; page-4 browsing is not yanked back to page 1 by incoming messages (existing behavior preserved for all tabs).
5. **Filter + pagination correctness**: totals and pages reflect the whole filtered dataset, not just loaded rows.
6. **Search**: still searches all customers via the dropdown, independent of the active filter.
7. **Realtime**: new message appears, sounds play, list re-sorts by latest timestamp on every tab.
8. **Mobile**: segmented control fits the narrow list pane; fullscreen chat navigation unchanged.
9. **Messenger toggle off**: broken "Unknown" messenger profiles stay hidden on all tabs.

## 5. Rollback strategy

- Frontend: revert the two file edits — the All path is untouched, so reverting fully restores current behavior.
- Database: the RPC is additive and read-only; rollback is `DROP FUNCTION public.get_filtered_customer_ids(text, text, text, boolean, int, int);` — no data or schema is affected.
- No migrations alter existing objects, so there is nothing to backfill or restore.
