-- Add UTM tracking columns to telegram_leads table
ALTER TABLE public.telegram_leads 
ADD COLUMN IF NOT EXISTS utm_source text,
ADD COLUMN IF NOT EXISTS utm_medium text,
ADD COLUMN IF NOT EXISTS utm_campaign text,
ADD COLUMN IF NOT EXISTS utm_content text,
ADD COLUMN IF NOT EXISTS utm_term text,
ADD COLUMN IF NOT EXISTS utm_adset_id text,
ADD COLUMN IF NOT EXISTS utm_ad_id text,
ADD COLUMN IF NOT EXISTS utm_campaign_id text,
ADD COLUMN IF NOT EXISTS referrer text;