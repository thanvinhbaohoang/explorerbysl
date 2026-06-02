ALTER TABLE public.telegram_leads
  ADD COLUMN IF NOT EXISTS utm_adset_id text,
  ADD COLUMN IF NOT EXISTS utm_ad_id text,
  ADD COLUMN IF NOT EXISTS utm_campaign_id text;