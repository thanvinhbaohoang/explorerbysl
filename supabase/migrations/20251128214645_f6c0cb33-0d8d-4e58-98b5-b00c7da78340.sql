-- Add locale and timezone_offset columns to customer table
ALTER TABLE public.customer 
ADD COLUMN IF NOT EXISTS locale text,
ADD COLUMN IF NOT EXISTS timezone_offset integer;