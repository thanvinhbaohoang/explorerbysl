

# Rename Facebook Pages to System Page + Add Telegram Bot Settings

## Overview

Rename the existing `/facebook-pages` route to `/system` and add a new **Telegram Bot Settings** tab to this page. The page will use tabs to organize Facebook Pages management and Telegram Bot settings in one place.

## What Changes

### 1. Rename route and navigation

- Change route from `/facebook-pages` to `/system` in `App.tsx`
- Update nav link label from "Pages" to "System" in `AppLayout.tsx`
- Update the page title from "Facebook Pages" to "System"

### 2. Add Tabs layout to the page

The page will have two tabs:
- **Facebook Pages** -- all existing Facebook Pages content (unchanged)
- **Telegram Bot** -- new section with bot status and welcome message editor

### 3. Database: Create `bot_settings` table

A simple key-value table to store the welcome message:

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| key | text (unique) | Setting identifier |
| value | text | The setting value |
| updated_at | timestamptz | Last modified |
| updated_by | uuid | Who last edited |

RLS: Authenticated users can read; admins can insert/update.

### 4. Telegram Bot tab content

- **Bot Status Card**: Calls a new endpoint on the `telegram-bot` edge function to fetch webhook info (`getWebhookInfo`) and bot details (`getMe`). Displays: bot username, webhook URL, pending updates, last error.
- **Welcome Message Editor**: A textarea pre-filled from `bot_settings` table (key: `telegram_welcome_message`). Save button writes to the database. Falls back to the current hardcoded message if no DB entry exists.
- **Re-register Webhook Button**: One-click button to call `setWebhook` via the edge function.

### 5. Edge function updates (`telegram-bot`)

- Add handling for authenticated POST requests with `action` field:
  - `action: "get_status"` -- calls Telegram `getWebhookInfo` + `getMe`, returns result
  - `action: "set_webhook"` -- calls Telegram `setWebhook`, returns success/failure
- Modify `handleStart` to query `bot_settings` for `telegram_welcome_message` key, falling back to the current hardcoded text

### 6. Files affected

| File | Change |
|------|--------|
| `src/App.tsx` | Rename route `/facebook-pages` to `/system` |
| `src/components/AppLayout.tsx` | Update nav link href and label |
| `src/pages/FacebookPages.tsx` | Rename to conceptually be "System" page, add Tabs with Facebook Pages + Telegram Bot sections |
| `supabase/functions/telegram-bot/index.ts` | Add `get_status`, `set_webhook` actions; read welcome message from DB |
| New migration | Create `bot_settings` table |

