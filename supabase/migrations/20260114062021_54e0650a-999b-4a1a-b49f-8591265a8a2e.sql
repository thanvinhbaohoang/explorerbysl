-- Add identity information columns to customer table
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS legal_first_name TEXT;
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS legal_middle_name TEXT;
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS legal_last_name TEXT;
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS passport_number TEXT;
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS national_id TEXT;

-- Add RLS policy for authenticated users to update customer identity fields
CREATE POLICY "Authenticated users can update customer identity"
ON public.customer
FOR UPDATE
USING (true)
WITH CHECK (true);