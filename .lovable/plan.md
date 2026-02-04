

# Fix Profile Photos in Conversation List

## Problem Summary

Profile photos are not displaying for customers in the chat list. There are two separate issues:

| Platform | Current State | Root Cause |
|----------|---------------|------------|
| **Messenger** | Only 1/3 customers have photos | Facebook API permission issues + URL expiration |
| **Telegram** | 0 customers have photos | Profile photo fetching not implemented |

---

## Detailed Analysis

### Messenger Issues

1. **Permission Problem**: Two Messenger customers show `messenger_name: "Unknown"` and `messenger_profile_pic: null` - this indicates the Facebook Graph API call to fetch user profile failed (requires `pages_messaging` permission)

2. **URL Expiration**: Harold Than's profile picture URL will expire:
   - URL contains `ext=1768430855` (Unix timestamp = ~May 2026)
   - After expiration, the image will fail to load
   - Current code saves the temporary Facebook URL directly instead of downloading permanently

### Telegram Issues

The `handleStart` function in `telegram-bot` edge function:
- Captures username, first_name, last_name, language_code
- Does **NOT** call Telegram's `getUserProfilePhotos` API
- Never stores any profile photo URL

---

## Solution

### Part 1: Add Telegram Profile Photo Fetching

Modify `supabase/functions/telegram-bot/index.ts`:

1. Add a new `getUserProfilePhoto` function that:
   - Calls Telegram's `getUserProfilePhotos` API
   - Downloads the photo using `getFile`
   - Stores it in Supabase Storage permanently
   - Returns the permanent URL

2. Update `handleStart` and message handling to:
   - Fetch and store profile photo for new customers
   - Optionally refresh photo for existing customers periodically

```typescript
// New function to add
async function getUserProfilePhoto(userId: number): Promise<string | null> {
  try {
    // Get user's profile photos
    const response = await fetch(
      `${TELEGRAM_API}/getUserProfilePhotos?user_id=${userId}&limit=1`
    );
    const data = await response.json();
    
    if (!data.ok || !data.result.photos || data.result.photos.length === 0) {
      return null;
    }
    
    // Get the largest size of the first photo
    const photoSizes = data.result.photos[0];
    const largest = photoSizes[photoSizes.length - 1];
    
    // Download and store permanently
    return await downloadAndStoreFile(largest.file_id, 'photo');
  } catch (error) {
    console.error("Error getting user profile photo:", error);
    return null;
  }
}
```

### Part 2: Fix Messenger Profile Photo Storage

Modify `supabase/functions/messenger-webhook/index.ts`:

1. Add a dedicated function to download and permanently store profile pictures
2. Update `handleMessage` to use permanent storage instead of Facebook's temporary URL
3. Store the permanent Supabase Storage URL in the database

```typescript
// Download profile pic and store permanently
async function downloadAndStoreProfilePic(url: string, customerId: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    const fileName = `profile-pics/${customerId}.jpg`;
    
    const { error } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, await blob.arrayBuffer(), {
        contentType: 'image/jpeg',
        upsert: true  // Overwrite if exists
      });
    
    if (error) return null;
    
    const { data } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName);
    
    return data.publicUrl;
  } catch (error) {
    console.error("Error storing profile pic:", error);
    return null;
  }
}
```

### Part 3: Backfill Existing Customers

Create an edge function endpoint to refresh profile photos for existing customers:
- For Telegram: Fetch photos using `getUserProfilePhotos`
- For Messenger: Re-fetch using Graph API and store permanently

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/telegram-bot/index.ts` | Add `getUserProfilePhoto` function, update customer creation to fetch/store photos |
| `supabase/functions/messenger-webhook/index.ts` | Add `downloadAndStoreProfilePic` function, update profile storage to use permanent URLs |

---

## Technical Notes

### Telegram API
- `getUserProfilePhotos` returns an array of photos at different resolutions
- Each photo has a `file_id` that can be used with `getFile` to download
- No special permissions needed - bots can always get profile photos

### Messenger API
- Requires `pages_messaging` permission to fetch user profiles
- Profile pics are temporary URLs that expire
- The 2 customers with "Unknown" name may have failed API calls due to permission issues

### Storage Strategy
- Store all profile photos in `chat-attachments/profile-pics/`
- Use customer ID as filename for easy updates: `profile-pics/{customer_id}.jpg`
- Use `upsert: true` to allow photo updates

---

## Expected Outcome

After implementation:
- New Telegram customers will have their profile photo fetched and stored
- New Messenger customers will have permanent photo URLs (not expiring)
- Existing customers can be updated via a backfill process
- The conversation list will display actual user avatars instead of placeholders

