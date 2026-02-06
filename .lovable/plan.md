

# Retroactive Profile Picture Backfill for All Customers

## Overview

This plan creates a new edge function that will fetch and store profile pictures for all existing customers who are missing them. The function will handle both Telegram and Messenger customers using the existing helper functions.

## Current State

- **Storage location**: `chat-attachments/profile-pics/{customerId}.jpg`
- **Database column**: `customer.messenger_profile_pic` (stores the public URL)
- **Telegram**: Uses `getUserProfilePhotos` and `getFile` APIs
- **Messenger**: Uses Facebook Graph API with page access tokens from `facebook_pages` table

## Implementation

### New Edge Function: `backfill-profile-pics`

**File: `supabase/functions/backfill-profile-pics/index.ts`**

This function will:

1. Query all customers where `messenger_profile_pic IS NULL`
2. For each customer:
   - **Telegram**: Fetch profile photo via Telegram API
   - **Messenger**: Fetch profile from Facebook Graph API using page token
3. Download and upload to Supabase Storage
4. Update `customer.messenger_profile_pic` with the public URL

```text
Flow:
┌─────────────────────────────────────────────────┐
│ 1. Query customers with NULL messenger_profile_pic │
└───────────────────────┬─────────────────────────┘
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
┌─────────────────┐          ┌─────────────────────┐
│ Telegram User   │          │ Messenger User      │
│ (telegram_id)   │          │ (messenger_id)      │
└────────┬────────┘          └──────────┬──────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────────┐
│ getUserProfile  │          │ FB Graph API        │
│ Photos API      │          │ /{psid}?fields=     │
│ + getFile API   │          │   profile_pic       │
└────────┬────────┘          └──────────┬──────────┘
         │                              │
         └──────────────┬───────────────┘
                        ▼
         ┌──────────────────────────────┐
         │ Download image               │
         │ Upload to chat-attachments   │
         │   /profile-pics/{id}.jpg     │
         └──────────────┬───────────────┘
                        ▼
         ┌──────────────────────────────┐
         │ Update customer table        │
         │ SET messenger_profile_pic    │
         └──────────────────────────────┘
```

### Function Features

1. **Batch processing** with configurable limits to avoid timeouts
2. **Rate limiting** to respect Telegram/Facebook API limits
3. **Progress reporting** - returns count of processed/updated/failed
4. **Idempotent** - can be run multiple times safely
5. **Error handling** - continues on individual failures

### Code Structure

```typescript
// supabase/functions/backfill-profile-pics/index.ts

// Main logic:
async function backfillProfilePics(limit: number = 50) {
  // 1. Get customers missing profile pics
  const { data: customers } = await supabase
    .from('customer')
    .select('id, telegram_id, messenger_id, page_id')
    .is('messenger_profile_pic', null)
    .limit(limit);
  
  const results = { processed: 0, updated: 0, failed: 0, errors: [] };
  
  for (const customer of customers) {
    // Add delay to respect rate limits
    await delay(100); // 100ms between requests
    
    try {
      let photoUrl: string | null = null;
      
      if (customer.telegram_id) {
        // Telegram: Use getUserProfilePhotos + getFile APIs
        photoUrl = await getTelegramProfilePhoto(customer.telegram_id, customer.id);
      } else if (customer.messenger_id && customer.page_id) {
        // Messenger: Fetch from Facebook Graph API
        photoUrl = await getMessengerProfilePhoto(
          customer.messenger_id, 
          customer.page_id, 
          customer.id
        );
      }
      
      if (photoUrl) {
        await supabase
          .from('customer')
          .update({ messenger_profile_pic: photoUrl })
          .eq('id', customer.id);
        results.updated++;
      }
      
      results.processed++;
    } catch (error) {
      results.failed++;
      results.errors.push({ customerId: customer.id, error: String(error) });
    }
  }
  
  return results;
}

// Telegram helper (same as existing getUserProfilePhoto)
async function getTelegramProfilePhoto(telegramId: number, customerId: string) {
  // 1. Call getUserProfilePhotos API
  // 2. Get largest photo size
  // 3. Call getFile to get download URL
  // 4. Download and upload to storage
  // 5. Return public URL
}

// Messenger helper
async function getMessengerProfilePhoto(messengerId: string, pageId: string, customerId: string) {
  // 1. Get page token from facebook_pages table
  // 2. Call Graph API: /{psid}?fields=profile_pic
  // 3. Download profile_pic URL
  // 4. Upload to storage
  // 5. Return public URL
}
```

### API Endpoint

```
POST /functions/v1/backfill-profile-pics
Body: { "limit": 50 }  // Optional, defaults to 50

Response:
{
  "success": true,
  "processed": 50,
  "updated": 42,
  "failed": 3,
  "remaining": 128,
  "errors": [...]
}
```

### Usage

The function can be called multiple times to process all customers in batches:

```typescript
// From admin UI or script
await supabase.functions.invoke('backfill-profile-pics', {
  body: { limit: 100 }
});
```

## Rate Limiting Considerations

| Platform | Rate Limit | Our Approach |
|----------|------------|--------------|
| Telegram | 30 requests/second | 100ms delay between requests |
| Facebook | 200 calls/hour per user | Page tokens have higher limits; 100ms delay sufficient |

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/backfill-profile-pics/index.ts` | Main edge function with all logic |

## Summary

- Creates a new edge function to backfill missing profile pictures
- Handles both Telegram and Messenger customers
- Uses existing API patterns from `telegram-bot` and `messenger-webhook`
- Rate-limited to avoid API throttling
- Returns progress so you can track completion
- Can be run multiple times until all customers are processed

