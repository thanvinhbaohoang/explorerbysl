

# Fix: Facebook Connect — 0 Pages + Infinite Loading

## Root Causes

**1. Window doesn't close / infinite loading**: Modern browsers null out `window.opener` when navigating cross-origin (app domain → facebook.com → supabase.co). The `postMessage` never reaches the parent window, so `setConnecting(false)` never fires and the popup stays open.

**2. 0 pages returned**: The `/me/accounts` call returns empty. This needs debugging — likely the user token lacks `pages_show_list` scope, or the long-lived token exchange silently failed. Adding logging will help diagnose.

## Fix Approach

### Edge Function (`fb-exchange-token/index.ts`)

- **Add debug logging** for each step: log the token exchange response, long-lived token exchange response, and pages response (without exposing tokens — just status/counts).
- **On callback success, redirect to the app** instead of relying on `window.opener.postMessage`. Redirect to something like `https://explorerbysl.lovable.app/facebook-connect?fb_connected=true&pages=N` (or the preview URL). This bypasses the cross-origin `window.opener` problem entirely.
- **On callback error**, redirect with `?fb_error=message` instead of postMessage.

### Frontend (`FacebookConnect.tsx`)

- **On mount, check URL params** for `fb_connected=true` or `fb_error`. If present, show toast, clean URL params, and refresh pages list.
- **Remove popup approach** — instead of `window.open()`, navigate the current window (or keep popup but handle via redirect). Simplest: use `window.location.href` to go to the auth URL directly, then the callback redirects back.
- **Alternative (keep popup)**: The popup approach can still work if the callback redirects the popup to a page on the app domain that then does `window.opener.postMessage`. But the simplest fix is to use full-page redirect.

### Recommended: Full-page redirect flow

1. User clicks "Connect Facebook Page"
2. Frontend navigates to `fb-exchange-token/auth-url`, gets the OAuth URL
3. Frontend does `window.location.href = authUrl` (full redirect, no popup)
4. Facebook redirects to `fb-exchange-token/callback`
5. Callback processes tokens, then redirects to `{APP_ORIGIN}/facebook-connect?fb_status=success&pages=N`
6. FacebookConnect page reads query params on mount, shows toast, cleans URL

### Changes needed for the redirect approach

**Edge function changes:**
- Accept a `redirect_origin` query param in `/auth-url` and store it (or pass via OAuth `state`)
- In `/callback`, after processing, do a 302 redirect to `{redirect_origin}/facebook-connect?fb_status=success&pages=N` instead of returning HTML
- On error, redirect to `{redirect_origin}/facebook-connect?fb_status=error&message=...`
- Add console.log for token data, pages data to debug the 0 pages issue

**Frontend changes:**
- `handleConnect`: fetch auth URL, then `window.location.href = authUrl` (no popup)
- `useEffect` on mount: parse `fb_status` from URL, show toast, call `navigate('/facebook-connect', { replace: true })` to clean params
- Remove popup/message listener code

## Technical Details

| File | Change |
|------|--------|
| `supabase/functions/fb-exchange-token/index.ts` | Add logging, switch callback from HTML/postMessage to 302 redirect back to app |
| `src/pages/FacebookConnect.tsx` | Replace popup flow with full-page redirect, read query params on mount |

