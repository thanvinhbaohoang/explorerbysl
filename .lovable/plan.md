## Root cause
Facebook delivers two webhook events for the same ad click:
1. A standalone `messaging_referrals` event.
2. The first `message` event, which carries `message.referral` with the same ad context.

`supabase/functions/messenger-webhook/index.ts` calls `handleReferral` for both (lines 1860 and 1868), and `handleReferral` (lines 875–885) does an unconditional `INSERT` into `telegram_leads`. Result: two near-identical rows in the Traffic table, a few seconds apart, both with the same `messenger_ref` / `ad_title` / `post_id`.

The `isNewCustomer && !hasReferral` check in `handleMessage` (line 661) already prevents an extra `direct_message` row, so no change is needed there.

## Fix — single edge-function change
File: `supabase/functions/messenger-webhook/index.ts`, function `handleReferral`.

Before the `INSERT` at line 875, look up any existing `telegram_leads` row for this customer that represents the same ad click and skip the insert if found.

Dedupe key (in order of preference, whichever is present on the incoming referral):
1. `user_id = customer.id` AND `messenger_ref = referral.ref` (when `referral.ref` exists — m.me ?ref= and CTM ads almost always have it).
2. Fallback when no `ref`: `user_id = customer.id` AND `post_id = referral.ads_context_data?.post_id` AND `created_at >= now() - interval '10 minutes'` (covers CTM variants with only ad_context).
3. Final fallback: `user_id = customer.id` AND `platform = 'messenger'` AND `created_at >= now() - interval '2 minutes'` (catches rare cases where both events arrive without a stable key — still bounds duplicates to a short window).

If a matching row exists, log `[handleReferral] duplicate ad referral, skipping insert (matched lead <id>)` and return without inserting. Otherwise insert as today.

No schema change, no UI change, no other code paths touched. Bulk backfill and direct-message lead creation are unaffected.

## Verification
1. After deploy, click an ad → land in Messenger → send first message.
2. Open `/traffic` and confirm exactly one row for that user with the ad's `ad_title` / `messenger_ref` / `post_id`.
3. Edge-function logs should show `Handling referral event` followed by `duplicate ad referral, skipping insert` for the second arrival (or vice-versa depending on delivery order).
4. Confirm direct (non-ad) Messenger users still get a single `direct_message` lead.
5. Confirm Telegram traffic capture is unchanged.

## Out of scope
- No DB unique constraint (referral events without `ref` make a clean unique index awkward; the in-handler check is sufficient and easy to tune).
- No backfill/cleanup of existing duplicates. If you'd like, a follow-up can delete older duplicate rows where `(user_id, messenger_ref, post_id)` match within a small window.

## File touched
- `supabase/functions/messenger-webhook/index.ts` — add the pre-insert dedupe lookup in `handleReferral`.
