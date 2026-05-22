ALTER TABLE public.telegram_leads
  ADD COLUMN IF NOT EXISTS post_id text,
  ADD COLUMN IF NOT EXISTS ad_title text;

CREATE INDEX IF NOT EXISTS idx_telegram_leads_post_id ON public.telegram_leads(post_id);
CREATE INDEX IF NOT EXISTS idx_telegram_leads_ad_title ON public.telegram_leads(ad_title);
CREATE INDEX IF NOT EXISTS idx_telegram_leads_messenger_ref ON public.telegram_leads(messenger_ref);

UPDATE public.telegram_leads
SET post_id = messenger_ad_context->>'post_id',
    ad_title = messenger_ad_context->>'ad_title'
WHERE messenger_ad_context IS NOT NULL
  AND (post_id IS NULL OR ad_title IS NULL);