-- Create telegram_leads table for tracking ad clicks and Telegram verifications
CREATE TABLE IF NOT EXISTS public.telegram_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  utm_campaign TEXT,
  utm_content TEXT,
  fbclid TEXT,
  device TEXT,
  ip_address INET,
  timestamp TIMESTAMPTZ DEFAULT now(),
  telegram_id BIGINT,
  telegram_username TEXT,
  telegram_first_name TEXT,
  telegram_last_name TEXT,
  telegram_language TEXT,
  telegram_photo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_leads ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert and read their own records (for MVP testing)
CREATE POLICY "Anyone can insert telegram_leads"
  ON public.telegram_leads
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read telegram_leads"
  ON public.telegram_leads
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update telegram_leads by click_id"
  ON public.telegram_leads
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create index on click_id for faster lookups
CREATE INDEX idx_telegram_leads_click_id ON public.telegram_leads(click_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_telegram_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_telegram_leads_updated_at
  BEFORE UPDATE ON public.telegram_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_telegram_leads_updated_at();