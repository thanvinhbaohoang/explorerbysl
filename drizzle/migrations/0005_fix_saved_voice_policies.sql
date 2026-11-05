DROP POLICY "Approved staff can read saved voices" ON public.saved_voices;
CREATE POLICY "Approved staff can read saved voices" ON public.saved_voices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'moderator'));
DROP POLICY "Approved staff can read saved voice media" ON storage.objects;
DROP POLICY "Approved staff can upload saved voice media" ON storage.objects;
DROP POLICY "Owner or admin can delete saved voice media" ON storage.objects;
CREATE POLICY "Approved staff can read saved voice media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'saved-voice-media' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'moderator')));
CREATE POLICY "Approved staff can upload saved voice media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'saved-voice-media'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'moderator'))
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'))
    AND lower(storage.extension(name)) = 'mp3');
CREATE POLICY "Owner or admin can delete saved voice media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'saved-voice-media'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'moderator'))
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));