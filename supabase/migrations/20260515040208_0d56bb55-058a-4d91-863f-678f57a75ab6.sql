CREATE OR REPLACE FUNCTION public.preview_unknown_messenger_cleanup()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH targets AS (
    SELECT id FROM public.customer
    WHERE messenger_id IS NOT NULL
      AND (messenger_name IS NULL OR messenger_name = '' OR messenger_name ILIKE 'unknown%')
      AND telegram_id IS NULL
      AND legal_first_name IS NULL
      AND legal_last_name IS NULL
      AND legal_middle_name IS NULL
      AND national_id IS NULL
      AND passport_number IS NULL
  )
  SELECT jsonb_build_object(
    'customers', (SELECT count(*) FROM targets),
    'messages',  (SELECT count(*) FROM public.messages          WHERE customer_id IN (SELECT id FROM targets)),
    'leads',     (SELECT count(*) FROM public.telegram_leads    WHERE user_id     IN (SELECT id FROM targets)),
    'summaries', (SELECT count(*) FROM public.customer_summaries WHERE customer_id IN (SELECT id FROM targets)),
    'notes',     (SELECT count(*) FROM public.customer_notes    WHERE customer_id IN (SELECT id FROM targets)),
    'actions',   (SELECT count(*) FROM public.customer_action_items WHERE customer_id IN (SELECT id FROM targets))
  );
$$;

CREATE OR REPLACE FUNCTION public.execute_unknown_messenger_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customers int := 0;
  v_messages  int := 0;
  v_leads     int := 0;
  v_summaries int := 0;
BEGIN
  CREATE TEMP TABLE _cleanup_ids ON COMMIT DROP AS
    SELECT id FROM public.customer
    WHERE messenger_id IS NOT NULL
      AND (messenger_name IS NULL OR messenger_name = '' OR messenger_name ILIKE 'unknown%')
      AND telegram_id IS NULL
      AND legal_first_name IS NULL
      AND legal_last_name IS NULL
      AND legal_middle_name IS NULL
      AND national_id IS NULL
      AND passport_number IS NULL;

  IF (SELECT count(*) FROM _cleanup_ids) > 10000 THEN
    RAISE EXCEPTION 'Refusing to delete more than 10,000 customers in one batch';
  END IF;

  WITH d AS (DELETE FROM public.customer_summaries WHERE customer_id IN (SELECT id FROM _cleanup_ids) RETURNING 1)
    SELECT count(*) INTO v_summaries FROM d;
  WITH d AS (DELETE FROM public.telegram_leads    WHERE user_id     IN (SELECT id FROM _cleanup_ids) RETURNING 1)
    SELECT count(*) INTO v_leads FROM d;
  WITH d AS (DELETE FROM public.messages          WHERE customer_id IN (SELECT id FROM _cleanup_ids) RETURNING 1)
    SELECT count(*) INTO v_messages FROM d;
  WITH d AS (DELETE FROM public.customer          WHERE id          IN (SELECT id FROM _cleanup_ids) RETURNING 1)
    SELECT count(*) INTO v_customers FROM d;

  RETURN jsonb_build_object(
    'customers', v_customers,
    'messages',  v_messages,
    'leads',     v_leads,
    'summaries', v_summaries
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_unknown_messenger_cleanup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_unknown_messenger_cleanup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_unknown_messenger_cleanup() FROM anon;
REVOKE ALL ON FUNCTION public.execute_unknown_messenger_cleanup() FROM anon;
REVOKE ALL ON FUNCTION public.preview_unknown_messenger_cleanup() FROM authenticated;
REVOKE ALL ON FUNCTION public.execute_unknown_messenger_cleanup() FROM authenticated;