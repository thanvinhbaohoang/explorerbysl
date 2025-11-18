-- Restructure telegram_leads table to be simpler
-- Keep only essential tracking information

-- Drop all redundant columns
ALTER TABLE public.telegram_leads 
  DROP COLUMN IF EXISTS click_id,
  DROP COLUMN IF EXISTS timestamp,
  DROP COLUMN IF EXISTS ip_address,
  DROP COLUMN IF EXISTS utm_campaign,
  DROP COLUMN IF EXISTS utm_content,
  DROP COLUMN IF EXISTS fbclid,
  DROP COLUMN IF EXISTS device,
  DROP COLUMN IF EXISTS telegram_username,
  DROP COLUMN IF EXISTS telegram_first_name,
  DROP COLUMN IF EXISTS telegram_last_name,
  DROP COLUMN IF EXISTS telegram_language,
  DROP COLUMN IF EXISTS telegram_photo,
  DROP COLUMN IF EXISTS telegram_id;

-- Add new columns
ALTER TABLE public.telegram_leads
  ADD COLUMN facebook_click_id text,
  ADD COLUMN user_id uuid REFERENCES public.customer(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_telegram_leads_user_id ON public.telegram_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_leads_facebook_click_id ON public.telegram_leads(facebook_click_id);