-- Add sent_by_name column to track which employee sent the message
ALTER TABLE public.messages
ADD COLUMN sent_by_name TEXT DEFAULT NULL;