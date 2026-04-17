

## Diagnosis (confirmed)

DB has **6,503 unread customer messages across 2,099 customers**. The function `fetchUnreadCounts()` in `src/components/ChatConversationList.tsx` runs:

```ts
supabase.from("messages").select("customer_id").eq("sender_type","customer").eq("is_read",false)
```

Supabase caps `.select()` at **1,000 rows by default**. So only the first 1,000 unread message rows are returned, covering a subset of customers. Many conversations the user sees in the list (especially older ones) are missing from `unreadCounts` — so no badge, no highlight.

When the user stays on `/chat`, realtime gradually fills in counts as new messages arrive — that's why it "works after a while" and not on first navigation.

The Chat nav button doesn't actually have a count (I verified `AppLayout.tsx`); the user is likely seeing toasts/sound notifications and inferring activity. The real bug is just incomplete unread fetching.

## Fix

In `src/components/ChatConversationList.tsx`, replace the row-by-row fetch with a server-side aggregation so we don't hit the 1,000-row cap:

**Option A (recommended)** — add a new Postgres RPC `get_unread_counts()` that returns one row per customer with a count, and call it from `fetchUnreadCounts()`. Result set will be ~2,099 rows (one per customer) — well under the limit, and a single fast query.

```sql
CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS TABLE(customer_id uuid, unread_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT customer_id, COUNT(*)::bigint
  FROM messages
  WHERE sender_type='customer' AND is_read=false AND customer_id IS NOT NULL
  GROUP BY customer_id;
$$;
```

Then in `fetchUnreadCounts`:
```ts
const { data } = await supabase.rpc('get_unread_counts');
const counts: Record<string, number> = {};
data?.forEach(r => { counts[r.customer_id] = Number(r.unread_count); });
setUnreadCounts(counts);
```

**Also**: re-run `fetchUnreadCounts()` whenever the customer list grows (new pages loaded via infinite scroll) so newly-loaded rows immediately reflect their counts — though with the RPC returning everything, one call on mount is enough.

## Files

- `supabase/migrations/<new>.sql` — add `get_unread_counts()` RPC
- `src/components/ChatConversationList.tsx` — swap the query in `fetchUnreadCounts`

No other changes needed. Realtime increment, `markMessagesAsRead`, and visual styling all stay as-is.

