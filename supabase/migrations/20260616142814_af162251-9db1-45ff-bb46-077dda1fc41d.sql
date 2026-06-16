ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS telegram_update_id BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS messages_telegram_update_id_key
  ON public.messages (telegram_update_id)
  WHERE telegram_update_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.telegram_webhook_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id BIGINT,
  chat_id BIGINT,
  customer_id UUID,
  stage TEXT NOT NULL,
  message_type TEXT,
  error TEXT NOT NULL,
  raw_update JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.telegram_webhook_failures TO authenticated;
GRANT ALL ON public.telegram_webhook_failures TO service_role;

ALTER TABLE public.telegram_webhook_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read telegram webhook failures"
  ON public.telegram_webhook_failures
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS telegram_webhook_failures_created_at_idx
  ON public.telegram_webhook_failures (created_at DESC);