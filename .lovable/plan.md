# Capture Telegram messages without `/start` and fix chat bumping

## Root cause

### 1. Messages without `/start` are silently dropped

`supabase/functions/telegram-bot/index.ts` → `saveMessage` (line 470):

```ts
const { data: customer } = await supabase
  .from('customer')
  .select('id, messenger_profile_pic')
  .eq('telegram_id', message.from.id)
  .single();

if (customer) {
  // ...save message...
}
```

- `.single()` errors when no row exists, so `customer` is undefined.
- The `if (customer)` branch is skipped — message vanishes, no log, no DB write.
- Only `handleStart` ever creates a `customer` row, so anyone who DMs the bot before sending `/start` (e.g. opened the chat via `t.me/<bot>` link, then typed normally; or the customer row was cleaned up) is invisible to the system.

### 2. Pre-existing customer not bumped to top of chat list

Verified the DB trigger `trg_update_customer_last_message_at` is firing correctly — `customer.last_message_at` always matches the latest message timestamp. The conversation list query orders by `last_message_at desc`.

The reported "doesn't push to top" symptom is a **direct downstream consequence of #1**: when the Telegram message is dropped, no insert happens, the trigger doesn't fire, and the row never bumps. As soon as `saveMessage` auto-creates the customer when missing and inserts the message, the existing trigger + the existing realtime handler in `ChatConversationList.tsx` (which prepends unknown conversations via `ensureConversationLoaded`) will move the conversation to the top.

## Changes

### `supabase/functions/telegram-bot/index.ts` → `saveMessage`

1. Switch the customer lookup from `.single()` to `.maybeSingle()` so a missing row is `null` instead of an error.
2. If no customer is found, **auto-create one** from `message.from` (mirroring the create path in `handleStart`):
   - `telegram_id`, `username`, `first_name`, `last_name`, `language_code`, `is_premium`
   - `first_message_at = new Date(message.date * 1000).toISOString()` (use the actual Telegram timestamp, not now)
   - `detected_language` via existing language detection helper if available, otherwise leave default
3. After creation, fire-and-forget `getUserProfilePhoto(message.from.id, newCustomer.id)` and patch `messenger_profile_pic` (same pattern as `handleStart`).
4. Also insert a `telegram_leads` row with `platform='telegram'`, `user_id=newCustomer.id`, `messenger_ref='direct_message'` — matches the existing convention for direct (non-deep-link) entry points so the Traffic page reflects them.
5. Continue with the existing message-save path using the new customer's id.

Extract the create-customer logic into a small helper (`ensureCustomerFromTelegramUser(message)`) and call it from `saveMessage`. `handleStart` keeps its own flow (it already handles deep-link tokens), but we can optionally route its lookup through the same helper in a follow-up — out of scope for this fix.

### No frontend changes required

`ChatConversationList.tsx` already:
- Subscribes to `messages` INSERT events
- Calls `ensureConversationLoaded(messageCustomerId)` when the conversation isn't in the loaded page → fetches the customer and prepends it
- Re-sorts `sortedCustomers` by `last_message_at`

Once the edge function inserts the message, this flow takes over and the conversation appears at the top in real time.

## Verification

1. From a Telegram account that has never `/start`ed the bot, send "hi". Confirm:
   - A `customer` row is created (matching `telegram_id`, `first_name`, etc.).
   - A `messages` row is inserted with `sender_type='customer'`.
   - The conversation appears at the top of `/chat` within seconds (no manual refresh).
2. From a pre-existing Telegram customer whose row exists, send a new message. Confirm the chat list bumps them to the top in real time.
3. Confirm `/start` still works unchanged (welcome message sent, deep-link token logic intact).
4. Confirm media messages (photo, voice, video, document) from a never-`/start`ed user also create the customer and save correctly — they go through the same `saveMessage` path.

## Out of scope

- No changes to `handleStart` (existing behavior preserved).
- No schema changes; existing trigger and policies already cover the new insert path.
- No UI changes to chat list ordering or realtime handlers.
