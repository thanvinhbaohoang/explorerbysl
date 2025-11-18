-- Add sender type to messages table
ALTER TABLE public.messages
ADD COLUMN sender_type text DEFAULT 'customer' CHECK (sender_type IN ('customer', 'employee'));