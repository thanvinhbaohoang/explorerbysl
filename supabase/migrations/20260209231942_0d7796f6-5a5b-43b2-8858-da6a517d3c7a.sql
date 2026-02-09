DROP FUNCTION IF EXISTS public.get_latest_messages(uuid[]);

CREATE OR REPLACE FUNCTION public.get_latest_messages(p_customer_ids uuid[])
RETURNS TABLE(customer_id uuid, message_text text, message_type text, "timestamp" timestamptz, sender_type text, sent_by_name text)
LANGUAGE sql STABLE
SET search_path = 'public'
AS $$
  SELECT DISTINCT ON (m.customer_id) 
    m.customer_id, m.message_text, m.message_type, m.timestamp, m.sender_type, m.sent_by_name
  FROM messages m
  WHERE m.customer_id = ANY(p_customer_ids)
  ORDER BY m.customer_id, m.timestamp DESC;
$$;