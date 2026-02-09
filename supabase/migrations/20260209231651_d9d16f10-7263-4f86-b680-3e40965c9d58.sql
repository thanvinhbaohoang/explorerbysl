CREATE OR REPLACE FUNCTION public.get_latest_messages(p_customer_ids uuid[])
RETURNS TABLE(customer_id uuid, message_text text, message_type text, "timestamp" timestamptz)
LANGUAGE sql STABLE
SET search_path = 'public'
AS $$
  SELECT DISTINCT ON (m.customer_id) 
    m.customer_id, m.message_text, m.message_type, m.timestamp
  FROM messages m
  WHERE m.customer_id = ANY(p_customer_ids)
  ORDER BY m.customer_id, m.timestamp DESC;
$$;