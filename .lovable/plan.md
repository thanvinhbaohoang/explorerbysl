

# Fix: Can't Reply to Messenger Customers (Missing page_id)

## Root Cause

Most Messenger customers (8 out of 10 recent ones) have `page_id: null` in the database. When you try to reply, the edge function rejects the request with `"Missing page_id - required to send messages"`.

The `handleMessage` function in the webhook only sets `page_id` when **creating new customers** (line 512). It never updates `page_id` on existing customers who already have `null`.

## Fix

### 1. Edge function: Update `page_id` on existing customers (messenger-webhook/index.ts)

In `handleMessage`, after finding an existing customer, if their `page_id` is null, update it with the current `pageId` from the webhook event. This auto-heals existing records as customers send new messages.

```
// After line 494 (after the "Unknown name" refresh block)
if (customer && !customer.page_id && pageId) {
  await supabase.from('customer').update({ page_id: pageId }).eq('id', customer.id);
  customer.page_id = pageId;
}
```

### 2. Database migration: Backfill `page_id` for existing customers

Set `page_id` for all Messenger customers that have `null` using data from their messages. Since there are currently 2 active pages, and most customers message from `109469038735899`, we can backfill from the messages table or default to the active page.

```sql
UPDATE customer c
SET page_id = fp.page_id
FROM (SELECT DISTINCT ON (page_id) page_id FROM facebook_pages WHERE is_active = true LIMIT 1) fp
WHERE c.messenger_id IS NOT NULL AND c.page_id IS NULL;
```

### 3. Frontend: Better error message (ChatPanel / useChatMessages)

When a reply fails due to missing `page_id`, show a specific toast message instead of the generic "Failed to send message". The error from the edge function already contains the text.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/messenger-webhook/index.ts` | Auto-update `page_id` on existing customers when null |
| Migration SQL | Backfill `page_id` for all existing Messenger customers |
| `src/hooks/useChatMessages.ts` | Surface `page_id` missing error in toast |

