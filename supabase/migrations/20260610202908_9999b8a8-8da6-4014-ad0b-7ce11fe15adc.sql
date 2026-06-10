
-- =========================================================
-- 1. CUSTOMER: tighten SELECT + fix UPDATE role
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can read customer" ON public.customer;
CREATE POLICY "Approved users can read customer"
  ON public.customer FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'user')
    OR public.has_role(auth.uid(), 'moderator')
  );

DROP POLICY IF EXISTS "Authenticated users can update customer identity" ON public.customer;
CREATE POLICY "Authenticated users can update customer identity"
  ON public.customer FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'user')
    OR public.has_role(auth.uid(), 'moderator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'user')
    OR public.has_role(auth.uid(), 'moderator')
  );

-- =========================================================
-- 2. CONNECTED_PAGES: tokens admin-only
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can read connected_pages" ON public.connected_pages;
CREATE POLICY "Admins can read connected_pages"
  ON public.connected_pages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 3. FACEBOOK_PAGES: tokens admin-only; fix role on writes
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can read facebook_pages" ON public.facebook_pages;
CREATE POLICY "Admins can read facebook_pages"
  ON public.facebook_pages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service role can insert facebook_pages" ON public.facebook_pages;
CREATE POLICY "Service role can insert facebook_pages"
  ON public.facebook_pages FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update facebook_pages" ON public.facebook_pages;
CREATE POLICY "Service role can update facebook_pages"
  ON public.facebook_pages FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =========================================================
-- 4. MESSAGES: scope mark-as-read to authenticated
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can mark messages as read" ON public.messages;
CREATE POLICY "Authenticated users can mark messages as read"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'user')
    OR public.has_role(auth.uid(), 'moderator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'user')
    OR public.has_role(auth.uid(), 'moderator')
  );

-- =========================================================
-- 5. USER_ROLES: defense-in-depth against self-elevation
-- =========================================================
CREATE POLICY "Only admins may insert roles (restrictive)"
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 6. STORAGE: chat-attachments writes require auth
-- =========================================================
DROP POLICY IF EXISTS "Allow uploads to chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow updates to chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow deletes from chat attachments" ON storage.objects;

CREATE POLICY "Authenticated can upload chat attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated can update chat attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'chat-attachments')
  WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated can delete chat attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-attachments');

-- =========================================================
-- 7. Revoke anon EXECUTE on internal helper functions
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.get_unanswered_customer_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_unread_counts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_customer_last_message_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_telegram_leads_updated_at() FROM anon, authenticated;
