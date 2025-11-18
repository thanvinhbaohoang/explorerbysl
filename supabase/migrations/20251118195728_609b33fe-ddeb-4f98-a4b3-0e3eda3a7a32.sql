-- Add columns to messages table for media
ALTER TABLE public.messages
ADD COLUMN photo_file_id text,
ADD COLUMN photo_url text,
ADD COLUMN voice_file_id text,
ADD COLUMN voice_duration integer,
ADD COLUMN voice_transcription text;