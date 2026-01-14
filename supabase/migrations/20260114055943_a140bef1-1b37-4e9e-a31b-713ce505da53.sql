-- Add detected_language column to customer table
ALTER TABLE public.customer ADD COLUMN detected_language TEXT DEFAULT 'en';