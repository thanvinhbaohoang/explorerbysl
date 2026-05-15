## Goal
Make Messenger contacts stop landing as `Unknown` when the page is already connected and messaging permissions are valid.

## What I found
- The page-token diagnosis is now working correctly for **Vessels Of Soul**.
- That diagnosis only verifies the token itself.
- Customer names are fetched separately inside `messenger-webhook` via Facebook Graph `/{PSID}?fields=first_name,last_name,profile_pic,locale,timezone`.
- If that lookup fails, the code stores `messenger_name = 'Unknown'`.
- I confirmed recent `Unknown` customer records exist for the Vessels Of Soul page, so the webhook is receiving messages but the profile fetch is failing or returning no usable data.
- Current logs are not detailed enough to show the exact Graph API failure reason for those cases.

## Plan
1. Improve backend diagnostics in `messenger-webhook`
   - Log the exact Graph response for failed PSID profile lookups.
   - Include page id, PSID, HTTP status, and Facebook error payload so we can distinguish permission issues from PSID/account restrictions.
   - Keep secrets masked and avoid logging full tokens.

2. Add a PSID-level diagnostic path
   - Extend the existing Facebook backend tooling with a diagnostic endpoint that tests the exact same profile lookup used by the webhook.
   - Input: page id + Messenger PSID.
   - Output: whether the profile fetch succeeds, the Graph error body if it fails, and which stored page token was used.

3. Expose that diagnostic in the System UI
   - Add a simple action in the Facebook Pages/System area to run the new profile diagnostic for an `Unknown` user.
   - Show the raw result clearly so you can confirm whether Meta is refusing the profile lookup for that specific conversation.

4. Add a retry path for recovery
   - Reuse the same profile fetch logic to manually retry updating an `Unknown` customer once diagnostics succeed.
   - Only update the customer when Facebook actually returns a name/profile.

## Expected outcome
- We’ll be able to see the real reason Vessels Of Soul profile lookups fail.
- If the issue is only transient or token-context related, you’ll be able to retry and populate the real name.
- If Meta is blocking profile access for that sender/account type, the app will surface that explicitly instead of silently falling back to `Unknown`.

## Technical notes
- Files likely involved:
  - `supabase/functions/messenger-webhook/index.ts`
  - `supabase/functions/facebook-oauth/index.ts` or a nearby backend endpoint for diagnostics
  - `src/pages/FacebookPages.tsx`
- No database schema changes are expected for this fix.
- This stays scoped to diagnosis and recovery for Messenger profile fetching only.