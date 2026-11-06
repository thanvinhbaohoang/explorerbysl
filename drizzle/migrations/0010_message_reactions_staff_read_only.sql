REVOKE ALL ON TABLE public.message_reactions FROM anon,authenticated;
GRANT SELECT ON TABLE public.message_reactions TO authenticated;
GRANT ALL ON TABLE public.message_reactions TO service_role;
ALTER POLICY "Approved staff read message reactions" ON public.message_reactions USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'moderator'));