-- Add document columns to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS document_url TEXT,
ADD COLUMN IF NOT EXISTS document_name TEXT,
ADD COLUMN IF NOT EXISTS document_mime_type TEXT;