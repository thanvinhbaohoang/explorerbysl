-- Add last_message_at column to customer table
ALTER TABLE public.customer ADD COLUMN last_message_at TIMESTAMP WITH TIME ZONE;