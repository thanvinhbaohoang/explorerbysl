## Why this happens

The error is **not** about your Facebook Login for Business connection — that part worked fine and the Vessels Of Soul page token is stored correctly. The failure is a bug in our own `/token-debug` endpoint.

In `supabase/functions/facebook-oauth/index.ts` (line 347), we call Facebook's `debug_token` like this:

```
debug_token?input_token=PAGE_TOKEN&access_token=PAGE_TOKEN
```

Facebook requires the **`access_token` parameter (the caller)** to be one of:
- an **app access token** (`APP_ID|APP_SECRET`), or
- a user token belonging to an **owner/developer/admin of the app**.

A page token is neither, so Facebook rejects it with error 100. Explorer by SL only worked by coincidence — its underlying user happens to be a developer on our app, so Facebook accepted it. Vessels Of Soul was connected through a different user/business relationship, so the same call is rejected. This has nothing to do with whether the page itself is properly connected or has the right scopes.

## Fix

One-line change in the `/token-debug` handler: use the app access token as the caller credential, keep the page token as the subject being inspected.

```ts
const appAccessToken = `${FB_APP_ID}|${FB_APP_SECRET}`;
const dbgRes = await fetch(
  `https://graph.facebook.com/v21.0/debug_token?input_token=${token}&access_token=${appAccessToken}`
);
```

`FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` are already loaded at the top of this file (used by OAuth exchange and webhook signature verification). No new secrets, no DB changes, no frontend changes.

After this fix, Diagnose will work for every connected page regardless of which user or business connected it.

## Scope

- Edit: `supabase/functions/facebook-oauth/index.ts` — `/token-debug` handler only.
- No other files touched.