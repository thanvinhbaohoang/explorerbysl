-- Add media_group_id column to group multiple media items in a single album
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS media_group_id TEXT;