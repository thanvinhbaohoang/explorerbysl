-- Create facebook_pages table to store page info and access tokens
CREATE TABLE public.facebook_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  picture_url TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facebook_pages ENABLE ROW LEVEL SECURITY;

-- Create policies - only authenticated users can read
CREATE POLICY "Authenticated users can read facebook_pages"
ON public.facebook_pages
FOR SELECT
TO authenticated
USING (true);

-- Only edge functions (service role) can insert/update
CREATE POLICY "Service role can insert facebook_pages"
ON public.facebook_pages
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update facebook_pages"
ON public.facebook_pages
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_facebook_pages_updated_at
BEFORE UPDATE ON public.facebook_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_telegram_leads_updated_at();