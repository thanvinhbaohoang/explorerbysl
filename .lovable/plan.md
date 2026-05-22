## Goal

Promote ad fields out of the opaque `messenger_ad_context` JSON blob into dedicated, queryable columns on `telegram_leads` so the client can analyze which ad / post tag drives traffic.

## Current state

- Facebook Messenger referrals return `ads_context_data` shaped like:
  ```
  { "post_id": "964872316538029", "ad_title": "KORTC01* | #K01-K_Group_1", "video_url": "..." }
  ```
  Note: Facebook does **not** include a real `ad_id` in this payload — only `post_id` and `ad_title`. The existing `ad_id` column is unrelated (Marketing API ad id) and stays empty for these.
- All of this is currently dumped into `telegram_leads.messenger_ad_context` (jsonb), making it hard to filter, group, or chart.
- `messenger_ref` (post tag) is already correctly populated — no change needed there.
- 4 existing rows have ad context that should be backfilled.

## Plan

### 1. Schema (migration)

Add dedicated columns on `telegram_leads`:
- `post_id text` — Facebook post/creative id from `ads_context_data.post_id`
- `ad_title text` — human-readable ad name from `ads_context_data.ad_title`
- Indexes on `post_id`, `ad_title`, and `messenger_ref` to support filtering/aggregation.

Backfill existing 4 rows from `messenger_ad_context->>'post_id'` and `->>'ad_title'`.

Keep `messenger_ad_context` column as-is (raw fallback, video_url, future fields).

### 2. Webhook (`supabase/functions/messenger-webhook/index.ts`)

In `handleReferral`, when inserting into `telegram_leads`, also write:
```
post_id:  referral.ads_context_data?.post_id ?? null,
ad_title: referral.ads_context_data?.ad_title ?? null,
```

### 3. Traffic page (`src/pages/Traffic.tsx` + `src/hooks/useTrafficData.ts`)

- Add `post_id`, `ad_title` to the `TrafficData` interface and to the select list.
- Add two new filter dropdowns: **Ad Title** and **Post ID** (populated from distinct values, alongside the existing Post Tag filter).
- Add **Ad Title** and **Post ID** columns to the table (compact, with tooltips for long titles).
- Update `getTrafficSourceInfo` to prefer `ad_title` over digging into `messenger_ad_context`.
- Include both new fields in the CSV export and global search.
- Extend `useTrafficFilterOptions` to also return distinct `ad_title` and `post_id` lists.

### Out of scope

- No change to `messenger_ref` capture (already correct).
- No fetching of real Marketing API `ad_id` (would require ad lookup via Graph API — separate request).
- No changes to other pages that read `messenger_ad_context`.
