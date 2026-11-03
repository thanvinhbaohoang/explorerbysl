CREATE OR REPLACE FUNCTION public.get_filtered_customer_ids(
  p_filter text,
  p_search text DEFAULT '',
  p_platform text DEFAULT 'all',
  p_messenger_enabled boolean DEFAULT true,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_filter NOT IN ('unread', 'not_replied') THEN
    RAISE EXCEPTION 'Invalid filter: %. Must be unread or not_replied', p_filter;
  END IF;
  p_limit := GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
  p_offset := GREATEST(0, COALESCE(p_offset, 0));

  RETURN (
    WITH base AS (
      SELECT c.id, c.last_message_at
      FROM public.customer c
      WHERE
        (p_messenger_enabled OR c.messenger_id IS NULL OR c.messenger_name <> 'Unknown')
        AND (p_platform <> 'telegram'  OR (c.telegram_id IS NOT NULL AND c.messenger_id IS NULL))
        AND (p_platform <> 'messenger' OR c.messenger_id IS NOT NULL)
        AND (p_search = '' OR
             c.first_name ILIKE '%' || p_search || '%' OR
             c.last_name  ILIKE '%' || p_search || '%' OR
             c.username   ILIKE '%' || p_search || '%' OR
             c.messenger_name ILIKE '%' || p_search || '%')
        AND (
          (p_filter = 'unread' AND EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.customer_id = c.id AND m.sender_type = 'customer' AND m.is_read = false
          ))
          OR
          (p_filter = 'not_replied' AND (
            SELECT m.sender_type FROM public.messages m
            WHERE m.customer_id = c.id
            ORDER BY m.timestamp DESC, m.created_at DESC, m.id DESC
            LIMIT 1
          ) = 'customer')
        )
    ),
    counted AS (
      SELECT count(*) AS total FROM base
    ),
    paged AS (
      SELECT b.id
      FROM base b
      ORDER BY b.last_message_at DESC NULLS LAST, b.id
      LIMIT p_limit OFFSET p_offset
    )
    SELECT jsonb_build_object(
      'customer_ids', COALESCE(
        (SELECT jsonb_agg(p.id ORDER BY b2.last_message_at DESC NULLS LAST, b2.id)
         FROM paged p JOIN base b2 ON b2.id = p.id),
        '[]'::jsonb
      ),
      'total_count', (SELECT total FROM counted)
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_filtered_customer_ids(text, text, text, boolean, int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_filtered_customer_ids(text, text, text, boolean, int, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_filtered_customer_ids(text, text, text, boolean, int, int) TO authenticated;