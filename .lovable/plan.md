

# Fix Messenger Customers Showing "Unknown" Names

## Problem Analysis

I investigated the database and edge function thoroughly. Here's what's happening:

**468 out of 469 Messenger customers show "Unknown"** with no profile pic. The root causes:

1. **`handleReferral` doesn't save `page_id`** — 348 customers (all from ads) have `page_id: null`. Without `page_id`, the system can't look up the page token needed to fetch their Facebook profile. All 348 arrived after March 20 via ad referrals.

2. **`initConfig()` race condition** — Config is loaded asynchronously at module boot without `await`. On cold starts, the first request arrives before `bot_settings` values (app secret, system user token) are loaded. Confirmed: `/app-info` returns "No System User Token configured" on fresh calls even though `bot_settings` has the values.

3. **Even customers WITH `page_id` (120) show "Unknown"** — Page tokens were last synced Feb 9. After the client changed App credentials on March 20, old tokens may be invalidated. Profile fetching fails silently.

4. **`saveFbConfig` doesn't refresh the UI** — After saving credentials, the Connected App / System User cards still show "No info available" because `fetchAppInfo()` is never called.

5. **Backfill skips customers without `page_id`** — The existing backfill function requires `page_id` to fetch Messenger profiles, so it can't process the 348 customers missing it.

## Changes

### 1. `supabase/functions/messenger-webhook/index.ts`

**a) Add `page_id` to `handleReferral` insert** (line 720-727):
Add `page_id: pageId` to the customer insert. Also download and store the profile pic permanently (same pattern as `handleMessage`).

**b) Move `initConfig()` inside `serve()` with `await`** (line 80 → line 760):
Remove the fire-and-forget `initConfig()` call at line 80. Add `await initConfig()` at the start of the `serve()` handler. The existing 5-minute cache TTL ensures it only hits DB periodically.

### 2. `src/pages/FacebookPages.tsx`

**After successful `saveFbConfig`**: Call `fetchAppInfo()` to refresh the Connected App / System User cards, then close the dialog with `setFbConfigDialogOpen(false)`.

### 3. `supabase/functions/backfill-profile-pics/index.ts`

Update the backfill to handle customers with missing `page_id`:
- For Messenger customers without `page_id`, infer it by trying each active page from `facebook_pages` table
- When a profile is successfully fetched, update both `messenger_name`, `messenger_profile_pic`, AND `page_id` on the customer record
- Also backfill customers whose `messenger_name` is "Unknown" (not just those missing profile pics)

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/messenger-webhook/index.ts` | Add `page_id` to `handleReferral`, store profile pic permanently, move `initConfig()` inside `serve()` |
| `src/pages/FacebookPages.tsx` | Call `fetchAppInfo()` + close dialog after successful save |
| `supabase/functions/backfill-profile-pics/index.ts` | Handle missing `page_id` by trying all active pages, backfill "Unknown" names |

