CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS TABLE(customer_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT customer_id, COUNT(*)::bigint AS unread_count
  FROM public.messages
  WHERE sender_type = 'customer'
    AND is_read = false
    AND customer_id IS NOT NULL
  GROUP BY customer_id;
$$;