
CREATE OR REPLACE FUNCTION public.get_unanswered_customer_ids()
RETURNS TABLE(customer_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT DISTINCT m.customer_id
  FROM messages m
  WHERE m.customer_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM messages m2
      WHERE m2.customer_id = m.customer_id
        AND m2.sender_type = 'employee'
    );
$$;
