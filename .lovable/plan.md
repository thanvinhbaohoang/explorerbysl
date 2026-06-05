## Goal
Subscribe pages to the `message_echoes` webhook field directly from our app, so employee replies sent from the Facebook Page Inbox flow into our chat — no need to touch the Facebook App dashboard.

## Current state
- `supabase/functions/facebook-oauth/index.ts` line 28–29 has the constant `SUBSCRIBED_FIELDS = "messages,messaging_postbacks,messaging_referrals,message_reads,messaging_handovers"` — **missing `message_echoes`**.
- That constant is used both during OAuth auto-subscribe and by the `POST /subscribe-page` endpoint already wired to the "Subscribe" button on the Facebook Pages tab of `/system` (`src/pages/FacebookPages.tsx`).
- So the infrastructure to re-subscribe per page already exists; we just need to widen the fields list and let the user click Subscribe again on each page.

## Change

### `supabase/functions/facebook-oauth/index.ts`
Add `message_echoes` to `SUBSCRIBED_FIELDS`:
```
const SUBSCRIBED_FIELDS =
  "messages,messaging_postbacks,messaging_referrals,message_reads,messaging_handovers,message_echoes";
```
Nothing else changes — both the OAuth flow and the manual Subscribe button will now request echoes too.

### One small UI nudge in `src/pages/FacebookPages.tsx`
The current status check (`getPageSubscriptionStatus`) only verifies that *some* app is subscribed; it doesn't compare the actual fields. To make this self-service, we'll:
- In the `/subscription-status` response, include the `subscribed_fields` array Facebook returns for our app.
- In the frontend, treat a page as "needs resubscribe" (show the Subscribe button) when `message_echoes` is missing from the returned fields — even if the page already shows the green "Webhook ✓" badge for the older field set.
- Add a small caption under the Subscribe button: "Re-subscribe to enable employee-reply sync" when echoes are missing, so the user knows why.

## Out of scope
- No changes to the webhook handler itself (the echo logic from the previous turn already handles incoming events).
- No changes to the Facebook App dashboard configuration. (Note: `message_echoes` is enabled per-page via Graph API; it does not need a separate App Review approval beyond the existing `pages_messaging` permission you already use.)
- No schema changes.

## Verification
1. Deploy the edge function change.
2. Open `/system` → Facebook Pages.
3. For each connected page, the badge should now say "Webhook ✕" or the Subscribe button should appear (because the existing subscription lacks `message_echoes`).
4. Click **Subscribe** for one page → toast "subscribed to webhook".
5. From Facebook Page Inbox, reply to a customer with text + a photo → both messages appear in our `/chat` for that customer within seconds, on the employee side.
6. Repeat for the remaining pages.