ALTER TABLE public.telegram_webhook_failures
  ADD COLUMN IF NOT EXISTS replayed_at timestamptz,
  ADD COLUMN IF NOT EXISTS replay_error text;

CREATE INDEX IF NOT EXISTS telegram_webhook_failures_replayed_idx
  ON public.telegram_webhook_failures (replayed_at)
  WHERE replayed_at IS NULL;