## Goal

In the chat header, when the currently open customer is linked to another platform account (Telegram ↔ Messenger), show a button representing that other account with a red badge for its unread customer messages. Clicking it switches the chat panel to that linked conversation, and the header (avatar, name, platform badge) updates to that account's details.

## Scope

Frontend only. No schema or webhook changes. Uses the existing `customer.linked_customer_id` relationship and the existing `get_unread_counts` RPC.

## Behavior

- Resolve "linked accounts" for the currently selected customer: any customer row where `id = current.linked_customer_id`, OR `linked_customer_id = current.id`, OR (when current has a non-null `linked_customer_id`) any row sharing the same `linked_customer_id`. Exclude the current customer itself.
- For each linked account on a different platform than the current view, render a small pill/button next to the existing platform badge in the chat header:
  - Avatar (messenger profile pic if Messenger, otherwise initials)
  - Platform icon (Facebook for Messenger, Send for Telegram)
  - Short name
  - Red destructive `Badge` with unread count (only when count > 0), positioned top-right of the button
- Click → switches the active conversation to that linked customer. The whole `ChatPanel` re-renders with that customer's avatar, name, messages, platform badge, and reply target. The original account then appears as the switch button on the other side.
- If there are no linked accounts (or no linked account on a different platform), no extra buttons are shown — header stays as today.
- Works on both desktop (resizable layout) and mobile (full-screen `ChatPanel`).

## Technical details

Files to change:

1. `src/pages/Chat.tsx`
   - Pass a new `onSwitchCustomer={setSelectedCustomer}` prop to `<ChatPanel>` in both mobile and desktop branches so the panel can replace the active customer.

2. `src/components/ChatPanel.tsx`
   - Accept new prop `onSwitchCustomer?: (c: Customer) => void`.
   - New `useEffect` that, whenever `customer.id` changes, fetches linked accounts:
     - Query `customer` table: `select id, telegram_id, first_name, last_name, username, messenger_id, messenger_name, messenger_profile_pic, last_message_at, page_id, detected_language, language_code, is_premium, first_message_at, created_at, locale, timezone_offset, linked_customer_id` using an `.or()` filter covering the three link cases above.
     - Filter out the current customer; store as `linkedAccounts: Customer[]` in local state.
   - Fetch unread counts for those linked ids:
     - Call `supabase.rpc('get_unread_counts')`, build a `Record<string, number>`, then read counts for each linked account id. Re-fetch on customer change and on a 30s interval (matches existing realtime fallback cadence in this codebase). No need for a realtime subscription — the conversation list already drives realtime; the panel just polls.
   - Render switcher buttons in the header's right-side action cluster, before the existing platform badge:
     - For each linked account whose platform differs from the current one, render a `Button variant="outline" size="sm"` containing a tiny `Avatar` (h-5 w-5), the platform icon, and the name (truncated to ~14 chars on mobile).
     - Wrap the button in a relative container; overlay a `<Badge variant="destructive" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]">` showing the unread count when > 0.
     - `onClick` → `onSwitchCustomer?.(linkedAccount)`.

3. No changes to `useChatMessages`. The platform filter logic inside the hook (built around `linkedCustomersMap`) is currently a no-op because the hook only seeds itself with `[customer.id]`; swapping the `customer` prop is sufficient and cleanest — the hook already fully resets on `selectedCustomer.id` change.

## Visual

```
[avatar] John Doe        [Media · 12]  [↩ John (FB) ⓷]  [Telegram]
         summary chip
```

`⓷` = red destructive badge with unread count.

## Out of scope

- No change to the conversation list, unread aggregation across linked ids (already done there), the 24h Messenger window logic, or how messages are stored.
- No support for linking more than 2 platforms (existing data model is 1:1, but loop handles N gracefully).
- No animation for switch; relies on existing customer-change scroll-to-bottom behavior in `ChatPanel`.

## Verification

- Open a customer that has a linked account on the other platform → switch button appears with correct avatar/name/icon.
- Send an unread message from the linked side (or seed `is_read=false`) → red badge shows correct count within 30s.
- Click switch button → header avatar/name/platform badge swap; message list reloads for that account; switch button now points back to the original.
- Open a customer with no link → no switch button rendered.
- Mobile viewport: switch button still visible (truncated label) and tappable; no header overflow.
