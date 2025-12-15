-- Add page_id column to customer table
ALTER TABLE public.customer ADD COLUMN page_id text;

-- Backfill the existing customer with their page_id
UPDATE public.customer 
SET page_id = '561589463698263' 
WHERE messenger_id IS NOT NULL AND page_id IS NULL;