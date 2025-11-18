-- Enable realtime for customer table
ALTER TABLE public.customer REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer;