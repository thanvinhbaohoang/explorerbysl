## Diagnosis

The Messenger replies you sent (page → customer Harold Than) are **echo events**, and your page is still not subscribed to that webhook field. I just checked the live subscription state for "Explorer by SL" (page_id `109469038735899`, which is Harold Than's page):

```
subscribed_fields: ["messages", "messaging_postbacks", "messaging_optins", "messaging_referrals"]
has_echoes: false
missing: ["message_reads", "messaging_handovers", "message_echoes"]
```

Without `message_echoes` in that list, Facebook does not send your outbound Page Inbox messages to our webhook — that's why nothing shows up. The webhook logs confirm: zero incoming POST events in the past several minutes, only the UI's GET calls.

There's also a secondary issue I spotted: when you tried Re-subscribe on **"Explorer Travel Agency - Cambodia"** (`103275792431920`), Facebook returned:

> "The user must be an administrator, editor, or moderator of the page in order to impersonate it."

That means the access_token stored for that page is not a valid page token with admin/editor/moderator role — likely the system user wasn't assigned the right role on that page, or the stored token is stale.

## Plan

### Step 1 — You: click Re-subscribe on "Explorer by SL"
Open `/system` → Facebook Pages tab → the **Explorer by SL** row → click **Re-subscribe**. Based on the live token check (the page token for this page is valid and has `pages_messaging` + `pages_manage_metadata`), this should succeed and immediately add `message_echoes`. After it succeeds, send a fresh Messenger message to Harold Than from your Page Inbox — it should land in our `/chat` within a couple seconds.

### Step 2 — If Step 1 fails or no echo arrives, I'll add a tiny diagnostic
Add a one-shot edge endpoint `GET /facebook-oauth/echo-test?page_id=...` that:
- Reads the stored page token
- Calls `GET /me/subscribed_apps?fields=subscribed_fields` with that token
- Calls `GET /debug_token` to confirm the token is a Page token, not a User/System User token
- Returns a JSON summary so we can see exactly what Facebook thinks our subscription state is

This is purely read-only and helps confirm whether the issue is subscription state vs token type vs webhook routing.

### Step 3 — Fix "Explorer Travel Agency - Cambodia" token (separate page, not blocking Harold)
The admin/editor/moderator error means the stored token isn't usable for management calls. Two ways to fix, in order of preference:

1. **Reconnect via OAuth** — On the Facebook Pages tab, use the "Connect Facebook" / OAuth button while logged in as a Facebook user who is admin of that page. The OAuth flow will issue a fresh page access token with the right role and store it.
2. **Grant the system user the role** — In Meta Business Suite → Business Settings → System Users → select your system user → "Add Assets" → add the page with Admin role. Then click Update Token (or Re-subscribe) again.

No code change is needed for Step 3 — it's purely a Facebook-side action.

## Out of scope
- No changes to the webhook handler — the echo-handling logic from the previous turn is already in place.
- No schema changes.
- No changes to other pages or other features.

## Verification
After Step 1:
1. From your phone's Messenger app (logged in as the Page or as Harold to the page), send a fresh message in the Explorer by SL ↔ Harold Than thread.
2. Within a few seconds, the message should appear in `/chat` on the correct side (employee side if you're replying from the Page, customer side if Harold is messaging the Page).
3. Tail `messenger-webhook` logs and confirm you see new `Incoming request: POST` entries plus `[echo] saved text` for page→customer messages.