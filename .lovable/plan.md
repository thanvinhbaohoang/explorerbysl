## Goal

In the Chat surface, every platform account is its own conversation. A customer who exists on both Telegram and Messenger appears as two rows in the list, and opening one shows only that account's messages. No more merged transcripts, no more platform-toggle inside the chat window.

CRM linking (`linked_customer_id` on `customer`, `LinkCustomerDialog`, the linked-platform badges on the CRM page) stays intact — this change is scoped to the chat inbox UI.

## Changes

### 1. `src/hooks/useCustomersData.ts` — list every account separately

- Remove the `.is("linked_customer_id", null)` filter from both the count query and the data query so linked child rows are returned alongside parents.
- Stop computing `linkedPlatformsMap` (or return it empty). Each row now represents exactly one account/platform, so the merged-platform badges no longer apply on the chat list.
- Keep the `last_message_at desc` ordering — each row sorts by its own latest message timestamp, which is exactly what the user asked for.

### 2. `src/components/ChatConversationList.tsx` — render one row per account

- Drop `allLinkedPlatformsMap` state, refs, and the linked-customer realtime cross-bumping logic. Each customer row's `last_message_at` already moves it on its own.
- Render a single platform badge per row (Messenger if `messenger_id`, else Telegram) instead of the dual-platform badge derived from `linkedPlatformsMap`.
- Selection key stays `customer.id`. Realtime INSERT handler keeps the existing "unknown customer → jump to page 1 + refetch" behavior.

### 3. `src/hooks/useChatMessages.ts` — scope messages to the selected account only

- In `loadMessages`, set `allCustomerIds = [customer.id]` and `linkedMap = { [customer.id]: ... }`. Remove the two follow-up queries that fetch `customer.linked_customer_id` and `linked_customer_id = customer.id` siblings.
- `setPlatformFilter` is still set to the row's own platform (`messenger` or `telegram`), but since only one platform's messages are loaded, the in-panel filter has nothing to switch between.

### 4. `src/components/ChatPanel.tsx` — remove the platform switcher

- Remove the Telegram/Messenger toggle UI (and the "switch platform" affordances built on `linkedCustomersMap` / `linkedCustomerIds`).
- Header shows the single account's name + platform badge. Sending a reply uses that account's platform — no branching on linked siblings.

### 5. Notifications & unread counts

- `fetchUnreadCounts` (RPC `get_unread_counts`) keys by `customer_id` already, so per-account unread badges work without change.
- Notification sound + toast logic in `ChatConversationList` keeps firing per inserted message; it no longer needs to resolve "which linked parent owns this child."

## Out of scope

- No database migrations. `linked_customer_id`, `LinkCustomerDialog`, and CRM-side linked badges remain so the link metadata is preserved if we want to revisit it later.
- No edge-function changes.
- No changes to search, pagination, or sort order beyond removing the parent-only filter.
- CRM page (`/customers`) keeps its current merged display.

## Verification

1. A customer with both Telegram and Messenger accounts appears as two rows in `/chat`, each with its own `last_message_at`.
2. Opening the Telegram row shows only Telegram messages; opening the Messenger row shows only Messenger messages. No platform-switch toggle is visible inside the panel.
3. A new Telegram message bumps only the Telegram row to the top; the Messenger row stays where its own timestamp puts it.
4. Unread badges, notification sound, and "jump to page 1 on new message from off-page customer" still work.
5. CRM `/customers` page is unchanged: linked accounts still show with combined platform badges and the Link dialog still functions.