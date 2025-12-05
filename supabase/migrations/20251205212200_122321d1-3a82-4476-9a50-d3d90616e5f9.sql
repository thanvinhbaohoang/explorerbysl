-- Add linked_customer_id column to customer table for cross-platform linking
ALTER TABLE public.customer 
ADD COLUMN linked_customer_id uuid REFERENCES public.customer(id);

-- Create index for faster lookups on linked customers
CREATE INDEX idx_customer_linked_customer_id ON public.customer(linked_customer_id);

-- Add RLS policy for updating customer (needed for linking)
CREATE POLICY "Anyone can update customer" 
ON public.customer 
FOR UPDATE 
USING (true)
WITH CHECK (true);