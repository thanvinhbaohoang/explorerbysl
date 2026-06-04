
## Goal

Use the Page `/conversations?fields=participants,messages{message,from}` endpoint (with the System User token) as a more reliable way to resolve "Unknown" Messenger customers — names + IDs come straight from the conversation participants, bypassing the per-PSID profile permission issue.

## Why this works better

The single-PSID profile lookup (`/{psid}?fields=first_name,...`) fails with `2018247` for some PSIDs. The `/conversations` endpoint returns participants (PSID + name) for every active thread on the page in one call, which we already verified works with the System User token.

## Changes

### 1. `supabase/functions/backfill-profile-pics/index.ts`

Add a new resolution path that runs BEFORE the per-PSID fetch:

- For each active page, call:
  ```
  GET /v19.0/{page_id}/conversations
    ?fields=participants,updated_time
    &limit=100
    &access_token={page or system token}
  ```
  Paginate via `paging.next` (cap at ~10 pages to stay safe).
- Build an in-memory map `{ pageId: { psid: { name, id } } }`.
- For each customer needing fix with `messenger_id`:
  1. Look up name in the conversations map (try known `page_id` first, else any page).
  2. If found → set `messenger_name`, `page_id`, then fetch profile pic via the existing `/{psid}?fields=profile_pic` call (this field is usually allowed even when name isn't) and store it.
  3. If still missing → fall back to existing per-PSID profile flow.
- Use `FACEBOOK_SYSTEM_USER_TOKEN` as the token for the conversations call (falls back to page's stored `access_token` if missing).

### 2. `src/pages/FacebookPages.tsx` (small)

Rename the existing backfill button tooltip / add a note that it now uses the Conversations API for name resolution. No new button needed — same endpoint, smarter logic.

## What this fixes

- "Unknown" customers like Saddam, Prince get real names on the next backfill run.
- Future inbound webhooks still try per-PSID first; if that fails the customer stays "Unknown" until the next scheduled/manual backfill, which will now succeed via conversations.

## Out of scope

- No schema changes.
- No webhook changes (separate concern — the webhook self-heal from previous plan still applies if you want it later).
- No new secrets.
