

# Fix: Chat List Sorting to Match Instagram/Messenger Behavior

## How Instagram/Messenger Actually Works

Instagram and Messenger use a single, simple sorting rule: **conversations are sorted purely by the timestamp of the last message, newest on top**. There is no separate "unread first" grouping. When you tap a conversation and it becomes "read," it stays exactly where it is — its position is determined only by when the last message arrived, not by read/unread status.

This is why your current implementation feels broken: the "unread first" sorting rule causes conversations to jump around when clicked (read status changes → position changes).

## What Needs to Change

### 1. Database: Trigger + Backfill `last_message_at` (migration)

Most customers have `NULL` in `last_message_at`, so the initial DB query returns them in arbitrary order. Fix:

- Create a trigger on `messages` INSERT to auto-update `customer.last_message_at`
- Backfill all existing customers from their actual message history

### 2. Sorting Logic (`ChatConversationList.tsx`)

**Remove the "unread first" sorting entirely.** Replace with pure timestamp sorting (newest first), exactly like Instagram:

```text
Current (broken):
  1. Unread conversations (sorted by time)
  2. Read conversations (sorted by time)
  → Clicking marks read → conversation jumps to group 2

Instagram/Messenger model:
  1. All conversations sorted by last message time, newest first
  → Clicking marks read → position unchanged (time didn't change)
  → New message arrives → that conversation moves to top
```

The unread badge still shows on each conversation — it just doesn't affect sort order.

### 3. No Pinning Needed

With pure timestamp sorting, clicking a conversation never changes its position because marking as read doesn't change the timestamp. The "disappearing conversation" problem goes away completely — no pinning logic required.

## Files Changed

| File | Change |
|------|--------|
| **Migration SQL** | Add trigger `update_customer_last_message_at` on `messages` INSERT + backfill query |
| **`src/components/ChatConversationList.tsx`** | Remove unread-first sorting from `sortedCustomers` memo. Sort only by `lastMessages` timestamp falling back to `last_message_at` — newest first |

