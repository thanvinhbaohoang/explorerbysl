
# Fix Customer Profile Pictures in Chat

## Problem Summary

Customer profile pictures are showing as initials instead of actual photos because:

1. **Most customers have no profile picture stored** - The database shows only 1 out of 20 recent customers has a `messenger_profile_pic` value
2. **Profile photos are only fetched for NEW customers** - The `telegram-bot` edge function only calls `getUserProfilePhoto()` when creating a new customer record
3. **Existing customers never got their photos** - Customers created before this feature was added, or those who started chatting through a regular message instead of `/start`, don't have photos

## Solution Overview

Update the Telegram bot to fetch and store profile pictures for all customers who don't have one yet, and optionally create a one-time backfill script for existing customers.

## Implementation Steps

### Step 1: Update telegram-bot Edge Function

Modify the message handling logic to check if an existing customer is missing their profile picture and fetch it if so.

**File: `supabase/functions/telegram-bot/index.ts`**

Changes:
- In the message handler (when customer already exists), check if `messenger_profile_pic` is null
- If null, call `getUserProfilePhoto()` and update the customer record
- This ensures any customer who sends a message will get their photo fetched if missing

```text
Before (simplified):
if (existingCustomer) {
  // Customer exists - use existing ID
  customerId = existingCustomer.id;
  // Update basic info only
  await supabase.from('customer').update({...basic info...})
}

After (simplified):
if (existingCustomer) {
  customerId = existingCustomer.id;
  await supabase.from('customer').update({...basic info...})
  
  // Fetch profile photo if missing
  if (!existingCustomer.messenger_profile_pic) {
    const profilePhotoUrl = await getUserProfilePhoto(telegramId, customerId);
    if (profilePhotoUrl) {
      await supabase.from('customer')
        .update({ messenger_profile_pic: profilePhotoUrl })
        .eq('id', customerId);
    }
  }
}
```

### Step 2: Update handleStart Function

Similarly update the `/start` command handler to fetch photos for existing customers who are missing them.

### Step 3: Update Regular Message Handler

Apply the same logic to the regular message handler (`handleMessage` function) to ensure photos are fetched whenever a customer without a profile picture sends any message.

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/telegram-bot/index.ts` | Add profile photo fetching for existing customers in multiple handlers |

### Query Change for Existing Customer Lookup

The current query only selects `id`:
```typescript
const { data: existingCustomer } = await supabase
  .from('customer')
  .select('id')  // Only gets id
  .eq('telegram_id', u.id)
  .maybeSingle();
```

Update to also select `messenger_profile_pic`:
```typescript
const { data: existingCustomer } = await supabase
  .from('customer')
  .select('id, messenger_profile_pic')  // Also get profile pic status
  .eq('telegram_id', u.id)
  .maybeSingle();
```

### Backfill Consideration

For existing customers who haven't messaged since this update, you have two options:

1. **Wait for natural backfill** - Photos will be fetched as customers send new messages
2. **Manual backfill** (optional) - Run a one-time script/SQL to trigger photo fetching for all Telegram customers with null profile pics

## Expected Outcome

After implementation:
- New customers will get profile photos immediately
- Existing customers will get their photos on their next message
- The chat conversation list will display actual profile pictures instead of initials
- Messenger customers will continue to work as before (photos already fetched on webhook)
