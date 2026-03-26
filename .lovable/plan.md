

# Show Saved Config in Connected App & System User Cards

## Problem
When the Facebook Graph API is unreachable (e.g. "API access deactivated"), `appInfo` comes back null. The Connected App card then only shows "No app info available" with a Configure button — even though the client has already saved their App ID, Secret, and System User Token via the config dialog.

## Solution
When `appInfo` is null but `fbConfig.facebook_app_id` has a value, show the saved configuration data instead of the empty "Configure" state. Same for the System User card when `systemUser` is null but `fbConfig.facebook_system_user_token` exists.

## Changes (single file: `src/pages/FacebookPages.tsx`)

### Connected App card (lines 616-625)
Replace the "No app info available" fallback with a three-way check:
1. `appInfo` exists — show full live data (existing code, unchanged)
2. `appInfo` null but `fbConfig.facebook_app_id` is set — show a "configured but not verified" state displaying:
   - App ID (masked partially)
   - App Secret status (configured/not configured)
   - A warning badge: "Could not verify with Facebook API"
   - Edit Configuration button for admins
3. Neither — show original "Configure App" button

### System User card (same pattern)
When `systemUser` is null but `fbConfig.facebook_system_user_token` is set, show:
- "System User Token configured" with a check icon
- Token preview (first/last few chars masked)
- Warning that live verification failed
- Edit button for admins

### Technical Details
- Use `fbConfig.facebook_app_id` and `fbConfig.facebook_system_user_token` which are already loaded from `bot_settings` via `fetchFbConfig()` on mount
- Mask sensitive values: show first 4 and last 4 chars of App ID, show "Configured" for secret/token
- Add an `AlertTriangle` icon with amber styling for the "API unreachable" warning

## Files Changed

| File | Change |
|------|--------|
| `src/pages/FacebookPages.tsx` | Add fallback display for saved-but-unverified config in both cards |

