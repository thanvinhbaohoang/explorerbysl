REVOKE ALL ON public.saved_voices FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.saved_voices FROM authenticated;
GRANT SELECT ON public.saved_voices TO authenticated;