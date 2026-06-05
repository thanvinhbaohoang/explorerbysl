
-- Diagnostic ring buffer for raw Messenger webhook POSTs
CREATE TABLE public.messenger_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  page_id text,
  has_echo boolean DEFAULT false,
  event_kinds text[],
  body jsonb
);

GRANT SELECT ON public.messenger_webhook_events TO authenticated;
GRANT ALL ON public.messenger_webhook_events TO service_role;

ALTER TABLE public.messenger_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read webhook events"
ON public.messenger_webhook_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX messenger_webhook_events_received_at_idx
ON public.messenger_webhook_events (received_at DESC);
