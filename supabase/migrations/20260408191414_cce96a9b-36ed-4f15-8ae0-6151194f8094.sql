
-- connected_pages
CREATE TABLE public.connected_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id text NOT NULL UNIQUE,
  page_name text NOT NULL,
  page_access_token text NOT NULL,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.connected_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read connected_pages" ON public.connected_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can insert connected_pages" ON public.connected_pages FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update connected_pages" ON public.connected_pages FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- fb_contacts
CREATE TABLE public.fb_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  psid text NOT NULL,
  page_id text NOT NULL,
  first_name text,
  last_name text,
  profile_pic text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(psid, page_id)
);
ALTER TABLE public.fb_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read fb_contacts" ON public.fb_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can insert fb_contacts" ON public.fb_contacts FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update fb_contacts" ON public.fb_contacts FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- fb_messages
CREATE TABLE public.fb_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  psid text NOT NULL,
  page_id text NOT NULL,
  message_text text,
  direction text NOT NULL DEFAULT 'inbound',
  created_time timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fb_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read fb_messages" ON public.fb_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can insert fb_messages" ON public.fb_messages FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update fb_messages" ON public.fb_messages FOR UPDATE TO service_role USING (true) WITH CHECK (true);
