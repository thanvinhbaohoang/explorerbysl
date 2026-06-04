## Root cause

New-customer creation fails because the webhook asks Graph for `locale,timezone` in addition to name/profile_pic. Those fields need `pages_user_locale` and `pages_user_timezone`, which the app isn't approved for, so Facebook returns `(#100) Insufficient permission to access user profile (subcode 2018247)` and the whole response is dropped → customer is saved as `Unknown`.

The Refresh button uses only `name,first_name,profile_pic` against the same token and works.

## Change

**`supabase/functions/messenger-webhook/index.ts`** — one file.

1. In `tryFetchProfile`, change the Graph URL fields from
   `first_name,last_name,name,profile_pic,locale,timezone`
   to
   `name,first_name,last_name,profile_pic`
   (drop `locale,timezone`).

2. In the new-customer insert blocks (around lines 580 and 810), stop setting `locale` and `timezone_offset` from the profile response (set them to `null`, since the API no longer returns them). Leave the columns nullable as they already are.

3. In the "Unknown name refresh" block (around line 544), drop the `locale` / `timezone_offset` updates for the same reason — keep whatever was already on the row.

4. Keep all existing fallback logic (system_user_token first, page_token fallback) and all logging unchanged.

## Out of scope

- No schema changes, no frontend changes, no changes to `backfill-profile-pics` (it already matches this behavior or will be aligned only if it shows the same error in logs).
- Not touching the 5-min config cache — already bypassed by the previous fix for the system user token.
- Not adding a background retry; once fields are corrected, the first webhook event will populate the profile.

## Verify

1. Send a new Messenger message from a never-seen-before user.
2. Edge logs should show `[profile-fetch] success via=system_user_token:db psid=… name="…"`.
3. The new customer row should have a real `messenger_name` and a stored `messenger_profile_pic` immediately (no "Unknown"), matching what the Refresh button produces.
