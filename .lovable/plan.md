## Goal
Make sure that when a new Messenger message arrives from any connected page, the webhook calls Graph with **that page's own access token** (which you've now verified works) to populate the customer's name and profile picture — instead of relying on the System User Token first.

## Current behavior (the bug)
`getUserProfile(psid, pageId)` in `supabase/functions/messenger-webhook/index.ts` (lines 309–325) tries the **System User Token first**, then falls back to the page token. If the SUT can't read a PSID for a given page (the exact problem we just diagnosed for "Explorer Travel Agency - Cambodia"), the new customer is created with `messenger_name = 'Unknown'` and `messenger_profile_pic = null` — even though the page's own token would have worked.

## Fix
**One small change inside `getUserProfile`** — invert the order so the per-page token is the primary source:

1. Look up `getPageToken(pageId)` from the `facebook_pages` row that matches the webhook's `entry.id`. This is the exact token+page-id pair you just tested in the browser and confirmed works.
2. Call `tryFetchProfile(psid, pageToken, 'page_token', pageId)`. If it returns a profile → use it.
3. Only if the page token call fails (missing row, revoked, network error), fall back to `getSystemUserTokenFresh()` as a safety net.
4. If both fail, log a clear `[profile-fetch] both tokens failed page=… psid=…` line so it surfaces in the edge-function logs.

This is the only logic change. All three call sites (`getUserProfile(senderId, pageId)` on lines 559, 607, 838, plus the echo-handler call on line 1692) already pass the correct `pageId` derived from `entry.id`, so they automatically benefit.

## Why this is safe
- The page token already has `pages_messaging` for its own PSIDs (you verified with the curl). The SUT, by contrast, is only guaranteed to work for pages whose Business Manager actually owns the System User — which is the failure mode we just hit.
- The existing `backfill-profile-pics` function keeps its current "SUT first, page tokens as fallback" order — that's fine because backfill iterates all pages anyway. Only the realtime webhook path needs the flip.
- No DB changes, no new secrets, no schema migrations. No UI changes.

## Verification after the change
1. Send a brand-new Messenger message to **Explorer Travel Agency - Cambodia** from a test account.
2. Check the edge-function logs for `[profile-fetch] success via=page_token page=103275792431920 psid=…`.
3. Open the Chat inbox — the new conversation should appear with the real name and avatar (not "Unknown"), without needing to run the backfill button.
4. Repeat for **ExplorerBySL** to confirm we didn't regress that page.

## Out of scope
- Re-running the backfill for the 25 stuck Cambodia customers (separate one-shot — can be triggered from Facebook Pages → "Backfill profile pictures" button after this fix lands).
- Any changes to send-message paths, attachments, or the SUT itself.
- The existing `diagnose-page-token` function — still useful for future audits, no changes needed.

## File touched
- `supabase/functions/messenger-webhook/index.ts` — replace the body of `getUserProfile` (lines 309–325) with the page-token-first ordering described above.
