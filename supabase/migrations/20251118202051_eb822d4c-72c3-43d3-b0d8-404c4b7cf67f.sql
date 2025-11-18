-- Add video support to messages table
ALTER TABLE public.messages 
ADD COLUMN video_file_id text,
ADD COLUMN video_url text,
ADD COLUMN video_duration integer,
ADD COLUMN video_mime_type text;