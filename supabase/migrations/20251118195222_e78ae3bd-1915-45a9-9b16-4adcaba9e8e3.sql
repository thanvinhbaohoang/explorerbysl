-- Create messages table to store all telegram messages
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES public.customer(id) ON DELETE CASCADE,
  telegram_id bigint NOT NULL,
  message_text text,
  message_type text DEFAULT 'text',
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert
CREATE POLICY "Anyone can insert messages"
ON public.messages
FOR INSERT
WITH CHECK (true);

-- Create policy to allow anyone to read
CREATE POLICY "Anyone can read messages"
ON public.messages
FOR SELECT
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_messages_customer_id ON public.messages(customer_id);
CREATE INDEX idx_messages_telegram_id ON public.messages(telegram_id);
CREATE INDEX idx_messages_timestamp ON public.messages(timestamp DESC);

-- Enable realtime for messages table
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;