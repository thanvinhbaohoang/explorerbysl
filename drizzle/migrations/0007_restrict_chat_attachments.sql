DROP POLICY IF EXISTS "Public read access for chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update chat attachments" ON storage.objects;
CREATE POLICY "Approved staff can upload chat attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'moderator')));
CREATE POLICY "Approved staff can update chat attachments" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-attachments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'moderator')))
  WITH CHECK (bucket_id = 'chat-attachments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'moderator')));
CREATE POLICY "Approved staff can delete chat attachments" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'moderator')));