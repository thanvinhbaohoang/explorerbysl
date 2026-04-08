

# Facebook Login for Business — Clean Rebuild

## Context
You already have a working `facebook-oauth` edge function and `facebook_pages` table that do most of what you're describing. Rather than creating fully parallel infrastructure, I recommend **updating the existing functions and adding the missing pieces**. However, since you've explicitly requested new table/function names, I'll build exactly what you asked for.

## What Gets Built

### 1. Database: Three New Tables

**`connected_pages`** — stores authorized Facebook Pages
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, auto-generated |
| page_id | text | unique, Facebook Page ID |
| page_name | text | |
| page_access_token | text | long-lived Page Access Token |
| token_expires_at | timestamptz | nullable |
| created_at | timestamptz | default now() |

**`fb_contacts`** — stores Messenger sender profiles
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| psid | text | Facebook Page-Scoped ID |
| page_id | text | which page they messaged |
| first_name | text | nullable |
| last_name | text | nullable |
| profile_pic | text | nullable |
| created_at | timestamptz | default now() |
| unique(psid, page_id) | | one contact per page |

**`fb_messages`** — stores inbound/outbound messages
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| psid | text | sender/recipient PSID |
| page_id | text | |
| message_text | text | nullable |
| direction | text | 'inbound' or 'outbound' |
| created_time | timestamptz | default now() |

All tables get RLS: authenticated SELECT, service_role INSERT/UPDATE.

### 2. Edge Function: `fb-exchange-token`

Handles the OAuth callback and token exchange:
- **GET `/auth-url`** — builds the Facebook OAuth URL with scopes `pages_messaging,pages_show_list,pages_manage_metadata`
- **GET `/callback`** — receives OAuth redirect, exchanges code → short-lived token → long-lived token, calls `/me/accounts`, upserts each page into `connected_pages`
- Reads `FB_APP_ID` and `FB_APP_SECRET` from environment variables (Deno.env)

### 3. Edge Function: `fb-webhook`

Handles Meta webhook verification and inbound messages:
- **GET** — responds to `hub.verify_token` challenge using `FB_VERIFY_TOKEN` env var
- **POST** — processes `messaging` events:
  - Looks up page token from `connected_pages` by recipient page_id
  - Fetches sender profile via `GET /{PSID}?fields=first_name,last_name,profile_pic` using that page token
  - Upserts contact into `fb_contacts`
  - Inserts message into `fb_messages`

### 4. Frontend: Connect Button

Update `FacebookPages.tsx` to call the new `fb-exchange-token/auth-url` endpoint and open the OAuth popup. On success, refresh the connected pages list from the new `connected_pages` table.

### 5. Environment Variables

Uses existing secrets (already configured):
- `FACEBOOK_APP_ID` → `FB_APP_ID`
- `FACEBOOK_APP_SECRET` → `FB_APP_SECRET`  
- `FACEBOOK_VERIFY_TOKEN` → `FB_VERIFY_TOKEN`

No new secrets needed — these are already set.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Create `connected_pages`, `fb_contacts`, `fb_messages` tables with RLS |
| `supabase/functions/fb-exchange-token/index.ts` | New — OAuth flow + token exchange |
| `supabase/functions/fb-webhook/index.ts` | New — webhook verification + message handling |
| `supabase/config.toml` | Add `fb-exchange-token` and `fb-webhook` with `verify_jwt = false` |
| `src/pages/FacebookPages.tsx` | Update Connect button to use new `fb-exchange-token` endpoint, fetch from `connected_pages` |

## Note on Existing Infrastructure

The existing `facebook-oauth`, `messenger-webhook` functions and `facebook_pages` table will remain untouched. You can deprecate them later once the new setup is verified working.

