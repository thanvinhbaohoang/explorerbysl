# Finish verification of the Inbox Filters (All / Unread / Not Replied)

## Current status
- Built: yes. Tabs, database lookup, speed index, error message with Retry, and the Unread refresh fix are all in place. Nothing is published.
- Passed: All-tab unchanged, database access rules, result accuracy against independent counts, speed (Unread ~6ms, Not Replied ~90ms), app build and type check.
- Not tested: on-screen click-through (tab switching, mobile Back, Retry, reading a chat from another device). The preview has no signed-in session for your account, so `/chat` redirects to sign-in.
- Not available: automated test suite (the project has none).

## Steps
1. You sign in to the preview once (Google or email) with an approved staff account.
2. Re-run the browser checks on `/chat`, desktop and mobile size:
   - All -> Unread -> Not Replied -> All: correct lists, page resets to 1, no flash of old rows.
   - Mobile: open a chat, press Back, filter tab is kept.
   - Retry: simulate a failed filtered load; confirm "Unable to load filtered conversations" + Retry, never an empty inbox.
   - Other device: mark a conversation read in a second browser session; it leaves Unread without a manual refresh.
3. Fix only issues that are reproduced, within the existing feature files.
4. Report pass/fail per check with screenshots; publish only if you approve.

## Technical details
- Read-only on customer data: no sending messages; marking read is limited to one test conversation you approve.
- Session restored via the preview's injected auth once available; no session minting for other users.
