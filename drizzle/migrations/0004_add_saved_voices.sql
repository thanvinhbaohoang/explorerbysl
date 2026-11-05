DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'saved-voice-media' AND public = false) THEN
    RAISE EXCEPTION 'saved-voice-media bucket missing or public';
  END IF;
END $$;

CREATE TABLE public.saved_voices (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  keywords text[] NOT NULL DEFAULT '{}',
  audio_path text NOT NULL,
  audio_mime_type text NOT NULL CHECK (audio_mime_type = 'audio/mpeg'),
  audio_size bigint NOT NULL CHECK (audio_size BETWEEN 1 AND 5242880),
  duration_sec integer NOT NULL CHECK (duration_sec BETWEEN 1 AND 120),
  created_by uuid NOT NULL,
  use_count bigint NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.saved_voices TO authenticated;
GRANT ALL ON public.saved_voices TO service_role;
ALTER TABLE public.saved_voices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved staff can read saved voices" ON public.saved_voices
  FOR SELECT TO authenticated USING (public._saved_reply_is_staff());

CREATE OR REPLACE FUNCTION public._saved_voice_validate(p_creator uuid, p_id uuid, p_path text)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE v_prefix text := p_creator::text || '/' || p_id::text || '/';
BEGIN
  IF p_path IS NULL OR left(p_path, length(v_prefix)) <> v_prefix OR p_path LIKE '%..%' OR right(lower(p_path), 4) <> '.mp3' THEN
    RAISE EXCEPTION 'Invalid recording location';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_saved_voice(p_id uuid, p_title text, p_keywords text[], p_path text, p_size bigint, p_duration integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public._saved_reply_is_staff() THEN RAISE EXCEPTION 'not authorized'; END IF;
  PERFORM public._saved_voice_validate(auth.uid(), p_id, p_path);
  INSERT INTO public.saved_voices (id, title, keywords, audio_path, audio_mime_type, audio_size, duration_sec, created_by)
  VALUES (p_id, btrim(p_title), coalesce(p_keywords, '{}'), p_path, 'audio/mpeg', p_size, p_duration, auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.update_saved_voice(p_id uuid, p_title text, p_keywords text[], p_path text, p_size bigint, p_duration integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_creator uuid; v_old text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public._saved_reply_is_staff() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT created_by, audio_path INTO v_creator, v_old FROM public.saved_voices WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This saved voice was deleted'; END IF;
  IF v_creator <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  PERFORM public._saved_voice_validate(v_creator, p_id, p_path);
  UPDATE public.saved_voices SET title = btrim(p_title), keywords = coalesce(p_keywords, '{}'),
    audio_path = p_path, audio_size = p_size, duration_sec = p_duration, updated_at = now()
  WHERE id = p_id;
  RETURN CASE WHEN v_old <> p_path THEN v_old ELSE NULL END;
END $$;

CREATE OR REPLACE FUNCTION public.delete_saved_voice(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_creator uuid; v_path text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public._saved_reply_is_staff() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT created_by, audio_path INTO v_creator, v_path FROM public.saved_voices WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This saved voice was already deleted'; END IF;
  IF v_creator <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM public.saved_voices WHERE id = p_id;
  RETURN v_path;
END $$;

CREATE OR REPLACE FUNCTION public.record_saved_voice_use(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public._saved_reply_is_staff() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.saved_voices SET use_count = use_count + 1, last_used_at = now() WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public._saved_voice_validate(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_saved_voice(uuid, text, text[], text, bigint, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_saved_voice(uuid, text, text[], text, bigint, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_saved_voice(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_saved_voice_use(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_saved_voice(uuid, text, text[], text, bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_saved_voice(uuid, text, text[], text, bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_saved_voice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_saved_voice_use(uuid) TO authenticated;

CREATE POLICY "Approved staff can read saved voice media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'saved-voice-media' AND public._saved_reply_is_staff());
CREATE POLICY "Approved staff can upload saved voice media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'saved-voice-media' AND public._saved_reply_is_staff()
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
    AND lower(storage.extension(name)) = 'mp3');
CREATE POLICY "Owner or admin can delete saved voice media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'saved-voice-media' AND public._saved_reply_is_staff()
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));