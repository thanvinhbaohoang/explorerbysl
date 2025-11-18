-- Create customer table for telegram bot users
CREATE TABLE public.customer (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id bigint NOT NULL UNIQUE,
  username text,
  first_name text,
  last_name text,
  language_code text,
  is_premium boolean DEFAULT false,
  first_message_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert (for bot)
CREATE POLICY "Anyone can insert customer"
ON public.customer
FOR INSERT
WITH CHECK (true);

-- Create policy to allow anyone to read
CREATE POLICY "Anyone can read customer"
ON public.customer
FOR SELECT
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_customer_updated_at
BEFORE UPDATE ON public.customer
FOR EACH ROW
EXECUTE FUNCTION public.update_telegram_leads_updated_at();

-- Create index for faster telegram_id lookups
CREATE INDEX idx_customer_telegram_id ON public.customer(telegram_id);