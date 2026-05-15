## Goal
Make Facebook page connection actually save the selected pages instead of completing OAuth with `0 page(s)`.

## What I’ll change
1. Update the Facebook OAuth permission request so the connect flow asks for the page-list permission needed by the callback.
2. Improve the callback logic so it surfaces a clear error when Facebook returns no pages, instead of showing a misleading success message.
3. Keep the existing popup flow, but make the UI show a more accurate result after OAuth completes.
4. Verify the end-to-end flow by checking the callback response and backend logs after the change.

## Why this is happening
The current OAuth function requests:
- `pages_messaging`
- `pages_read_engagement`
- `pages_manage_metadata`

But after login it fetches pages with `GET /me/accounts`. That page-list step commonly requires `pages_show_list`, and the current logs show Facebook is returning an empty page list:
- `Facebook OAuth: Upserted 0/0 pages`

So the OAuth handshake succeeds, but no pages are available to save.

## Planned implementation
### Backend
- Edit `supabase/functions/facebook-oauth/index.ts`
- Add `pages_show_list` to the OAuth scopes
- Detect when `/me/accounts` returns an empty array and return a specific error message explaining that no eligible pages were returned by Facebook
- Include lightweight logging around page count so future debugging is clearer

### Frontend
- Edit `src/pages/FacebookPages.tsx`
- Keep the popup flow, but handle the new “no pages returned” result cleanly so the toast is explicit instead of claiming success

## Validation
- Start the connect flow again from `/system`
- Confirm the popup result reports connected pages only when pages were actually returned
- Confirm backend logs no longer show `Upserted 0/0 pages` for a successful connect
- Confirm `facebook_pages` is populated and the page list refreshes in the UI

## Technical notes
- No database migration is needed
- No auth model change is needed
- This is a focused fix to the existing Facebook OAuth flow only