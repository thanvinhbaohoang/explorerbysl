

# Add Facebook Configuration Editor to /system

## What We're Building

An admin-only "Facebook Configuration" card within the existing Facebook Pages tab on `/system`. This lets admins input/update Facebook App credentials directly from the UI after completing App Verification, with clear guidance on each field.

## Changes

### 1. `src/pages/FacebookPages.tsx` — Add Configuration Card

Add a new card below the App & Business Info cards (inside the Facebook Pages tab) with four fields:

| Field | bot_settings key | Input Type | Guidance Text |
|-------|-----------------|------------|---------------|
| **Facebook App ID** | `facebook_app_id` | Text | "Found in your Facebook App Dashboard → Settings → Basic. A numeric ID like `123456789012345`." |
| **Facebook App Secret** | `facebook_app_secret` | Password (with show/hide) | "Found in App Dashboard → Settings → Basic → App Secret. Click 'Show' to reveal it. Never share this publicly." |
| **System User Token** | `facebook_system_user_token` | Password (with show/hide) | "Generated in Business Settings → System Users → select user → Generate Token. Must have `pages_messaging`, `pages_read_engagement`, and `pages_manage_metadata` permissions." |
| **Webhook Verify Token** | `facebook_verify_token` | Text | "A custom string you create. Must match exactly what you entered in the Facebook App Dashboard → Webhooks → Verify Token field." |

Features:
- Load current values from `bot_settings` on mount
- Single "Save Configuration" button that upserts all four values
- Show/hide toggle for secret fields
- Admin-only visibility (`isAdmin` guard)
- Security notice explaining these are stored securely in the database
- Step-by-step helper text under each field so admins know exactly where to find each value

### 2. `supabase/functions/messenger-webhook/index.ts` — Read Config from DB

Add a `getConfigValue(supabaseClient, key, envFallback)` helper that:
1. Queries `bot_settings` for the key
2. Returns the DB value if found, otherwise falls back to `Deno.env.get(envFallback)`
3. Caches results to avoid repeated queries per request

Update the existing env var reads for `FACEBOOK_APP_SECRET`, `FACEBOOK_SYSTEM_USER_TOKEN`, `FACEBOOK_APP_ID`, and `FACEBOOK_VERIFY_TOKEN` to use this helper.

### No Database Changes Needed

The `bot_settings` table already exists with admin-only RLS for insert/update, and authenticated read access.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/FacebookPages.tsx` | Add config editor card with 4 fields, load/save from `bot_settings`, clear field descriptions |
| `supabase/functions/messenger-webhook/index.ts` | Add `getConfigValue()` helper, use DB-first config resolution |

