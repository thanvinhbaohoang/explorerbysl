-- Add unique constraint on customer_id for customer_summaries to enable upsert
ALTER TABLE public.customer_summaries ADD CONSTRAINT customer_summaries_customer_id_key UNIQUE (customer_id);