-- Add column for voice URL
ALTER TABLE public.messages
ADD COLUMN voice_url text;