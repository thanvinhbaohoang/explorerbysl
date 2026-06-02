# Why traffic stopped on 2026-05-22

## Root cause (confirmed)

The `capture-traffic` edge function is returning **500** on every call since 5/22. Edge function logs show:

```
ERROR Database insert error: {
  code: "PGRST204",
  message: "Could not find the 'utm_ad_id' column of 'telegram_leads' in the schema cache"
}
```

The deployed edge function tries to insert `utm_ad_id`, `utm_adset_id`, and `utm_campaign_id` (fields the `/redirect` page started sending), but those columns do not exist on `public.telegram_leads`. Every `/redirect` and `/telegram` visit fails silently — the user is still redirected to Telegram, but no lead row is written. Direct `/start` chats with the bot still work, which is why messages keep arriving but Traffic stays empty.

Background checks done:
- `telegram_leads` last row: 2026-05-22 17:27 UTC.
- Telegram bot still receiving messages today (so users + bot are fine).
- Direct SQL insert into `telegram_leads` works — only the PostgREST insert fails.
- Manual `curl` to the edge function reproduces the 500.

## Fix

Add the three missing columns to `telegram_leads` so the captured ad-level attribution actually gets stored. This matches what `Redirect.tsx` already collects and what the deployed edge function tries to insert.

Migration:
```sql
ALTER TABLE public.telegram_leads
  ADD COLUMN IF NOT EXISTS utm_adset_id text,
  ADD COLUMN IF NOT EXISTS utm_ad_id text,
  ADD COLUMN IF NOT EXISTS utm_campaign_id text;
```

Also reconcile the repo copy of `supabase/functions/capture-traffic/index.ts` so its `insert({...})` includes the three new fields (the version in the repo is older than what is deployed — without this, the next push would regress the fix).

No frontend changes needed. After the migration runs and the function is redeployed, new visits to `/redirect` and `/telegram` will land in `telegram_leads` again and the Traffic page will repopulate.

## Verification

1. `curl -X POST .../functions/v1/capture-traffic -d '{"platform":"telegram","utm_ad_id":"x"}'` returns 200 with an `id`.
2. New row appears in `telegram_leads` with `utm_ad_id = 'x'`.
3. Visit `/redirect?fbclid=test&utm_ad_id=123` → row written, Traffic page shows it.
