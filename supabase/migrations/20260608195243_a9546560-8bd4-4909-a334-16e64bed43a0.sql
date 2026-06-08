ALTER TABLE public.telegram_leads ADD COLUMN IF NOT EXISTS ad_id text;
CREATE INDEX IF NOT EXISTS telegram_leads_ad_id_idx ON public.telegram_leads (ad_id) WHERE ad_id IS NOT NULL;