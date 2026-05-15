# Clean Up Unknown Messenger Customers

Verified counts (live):

| Table | Rows to delete |
|---|---|
| `customer` (messenger_id set + name "Unknown") | **3,685** |
| `messages` (FK customer_id) | **14,224** |
| `telegram_leads` (FK user_id) | **7,903** |
| `customer_summaries` | **2** |
| `customer_notes` / `customer_action_items` / `linked_customer_id` refs | **0** |

Safety checks confirmed: zero of these customers have a `telegram_id`, manual identity fields, notes, actions, or anything linking back to them. Real Messenger customers (with a real `messenger_name`) and Telegram-only customers are untouched.

## Selection criterion (single source of truth)

```sql
messenger_id IS NOT NULL
AND (messenger_name IS NULL OR messenger_name = '' OR messenger_name ILIKE 'unknown%')
AND telegram_id IS NULL          -- belt-and-suspenders: never touch dual-platform users
AND legal_first_name IS NULL
AND national_id IS NULL
AND passport_number IS NULL
```

The extra null guards are redundant against today's data but make the cleanup self-documenting and safe if it's ever re-run.

## Implementation

### 1. New edge function `cleanup-unknown-customers`
- Admin-auth gated (verify caller has `admin` role via `has_role()`).
- `GET /preview` → returns counts for each table matching the criterion (used to populate the confirm dialog with live numbers).
- `POST /execute` → runs the deletion in FK-safe order using the service role:
  1. `customer_summaries` where customer_id in (...)
  2. `telegram_leads` where user_id in (...)
  3. `messages` where customer_id in (...)
  4. `customer` where id in (...)
- Returns `{ deleted: { customers, messages, leads, summaries } }`.

Doing this server-side (not from the browser) avoids RLS round-trips, keeps it atomic-ish, and handles the 14k+ row delete without client timeouts.

### 2. UI in `src/pages/FacebookPages.tsx` (System Settings → Messenger section)
- Add an admin-only **"Clean Unknown Customers"** card with a destructive-styled button.
- Click → fetch `/preview`, open an `AlertDialog` showing the live counts ("This will permanently delete 3,685 customers, 14,224 messages, 7,903 traffic leads, and 2 AI summaries from the failed Messenger integration. This cannot be undone.").
- Confirm → call `/execute`, toast the deleted counts, refetch chat list / customer queries.
- Hidden entirely for non-admins (use `useUserPermissions`).

### 3. No schema migration
- Existing admin DELETE policies on `customer`, `messages`, `customer_summaries`, `telegram_leads` are sufficient (function uses service role anyway).

## Out of scope
- No automated/scheduled job — runs only when an admin clicks.
- No restoration / soft-delete — this is a hard purge.
- No changes to webhook profile-fetch logic (already fixed).
- Real Messenger customers with valid names are not touched, even if their conversation is empty.
