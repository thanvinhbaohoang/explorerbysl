-- 1. Create trigger function to auto-update customer.last_message_at
CREATE OR REPLACE FUNCTION public.update_customer_last_message_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.customer
  SET last_message_at = NEW.timestamp
  WHERE id = NEW.customer_id
    AND (last_message_at IS NULL OR last_message_at < NEW.timestamp);
  RETURN NEW;
END;
$$;

-- 2. Create trigger on messages table
CREATE TRIGGER trg_update_customer_last_message_at
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_last_message_at();

-- 3. Backfill existing data
UPDATE public.customer c
SET last_message_at = sub.latest
FROM (
  SELECT customer_id, MAX(timestamp) as latest
  FROM public.messages
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
) sub
WHERE c.id = sub.customer_id
  AND (c.last_message_at IS NULL OR c.last_message_at < sub.latest);