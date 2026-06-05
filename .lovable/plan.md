# Diagnose why "Explorer Travel Agency - Cambodia" can't fetch user info

## What the data shows

Querying the database confirms the issue is isolated to one page:

| Page | Page ID | Customers | Unknown names | Missing profile pics |
|---|---|---|---|---|
| Explorer by SL | 109469038735899 | 104 | 1 | 1 |
| **Explorer Travel Agency - Cambodia** | **103275792431920** | **25** | **25** | **25** |
| Vessels Of Soul | 561589463698263 | — | — | — |

Every customer on the Cambodia page is "Unknown" with no photo — the token used by `backfill-profile-pics` cannot read PSIDs for that page. Both pages have a stored per-page token (~200 chars, same `EAAKZBya` prefix), so the failure is almost certainly one of:

1. The **System User Token** (`FACEBOOK_SYSTEM_USER_TOKEN`) was issued in a Business Manager that owns "Explorer by SL" but **not** the Cambodia page.
2. The Cambodia page's per-page token is expired/revoked, or was issued without `pages_messaging` permission.
3. The Cambodia page was never granted `pages_messaging` / `Messenger Access` for the connected app, so PSID → profile lookup is rejected even with a valid token.

We need a diagnostic to tell which one.

## Plan

### 1. New diagnostic edge function `diagnose-page-token`

For each active row in `facebook_pages` (and the global System User Token), call Graph and report results without ever returning the token itself:

- `GET /{page_id}?fields=id,name,access_token` using **System User Token** → confirms whether the SUT can see this page.
- `GET /debug_token?input_token={page_token}&access_token={app_id}|{app_secret}` → returns scopes, expiry, is_valid, and the user/page the token is bound to.
- Pick one PSID belonging to that page from `customer.messenger_id` and call `GET /{psid}?fields=first_name,last_name,profile_pic` with (a) the page's stored token and (b) the SUT — report HTTP status + Graph error code/subcode for each.

Response shape per page:
```json
{
  "page_id": "...",
  "name": "...",
  "system_user_token": { "can_read_page": true|false, "error": "..." },
  "page_token": { "valid": true|false, "expires_at": "...", "scopes": [...], "error": "..." },
  "psid_lookup_with_page_token": { "ok": true|false, "status": 200, "error_code": null },
  "psid_lookup_with_system_token": { "ok": true|false, "status": 400, "error_code": 100, "error_subcode": 2018218 }
}
```

Admin-only (check `has_role(auth.uid(), 'admin')`). Uses existing `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_SYSTEM_USER_TOKEN` secrets — no new secrets.

### 2. "Diagnose token access" button on `FacebookPages.tsx`

Add a button in the page header. On click, invoke the function and render a per-page result card showing the four checks as green/red badges plus the Graph error message. This makes it obvious whether the fix is:
- **Re-issue the System User Token** in a BM that owns both pages, OR
- **Update the Cambodia page's per-page token** via the existing `UpdateTokenDialog`, OR
- **Add `pages_messaging` to the app** for the Cambodia page in Meta Business Settings.

### Files

- new: `supabase/functions/diagnose-page-token/index.ts`
- edit: `src/pages/FacebookPages.tsx` (button + results panel)

No DB migrations, no schema changes, no changes to webhook / backfill code.

## Out of scope

Auto-fixing the token. Once the diagnostic identifies the cause, the existing UpdateTokenDialog or a re-issued SUT (via `update_secret`) resolves it.
