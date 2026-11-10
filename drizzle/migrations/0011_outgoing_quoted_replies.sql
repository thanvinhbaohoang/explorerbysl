ALTER TABLE public.messages ADD COLUMN reply_to_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL, ADD COLUMN reply_to_provider_id text, ADD COLUMN reply_snapshot jsonb;
CREATE INDEX messages_reply_target_idx ON public.messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE TABLE public.outgoing_reply_requests (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL,
 customer_id uuid NOT NULL REFERENCES public.customer(id),
 target_message_id uuid NOT NULL REFERENCES public.messages(id),
 payload_hash text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed','uncertain')),
 result_message_id uuid REFERENCES public.messages(id),
 provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.outgoing_reply_requests TO authenticated;
GRANT ALL ON public.outgoing_reply_requests TO service_role;
ALTER TABLE public.outgoing_reply_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read own outgoing reply requests" ON public.outgoing_reply_requests FOR SELECT TO authenticated USING (user_id=auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'user')));
CREATE OR REPLACE FUNCTION public.protect_outgoing_reply_metadata() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.reply_to_message_id IS NOT NULL OR NEW.reply_to_provider_id IS NOT NULL OR NEW.reply_snapshot IS NOT NULL THEN RAISE EXCEPTION 'Reply metadata is server owned'; END IF;
  ELSIF NEW.reply_to_message_id IS DISTINCT FROM OLD.reply_to_message_id OR NEW.reply_to_provider_id IS DISTINCT FROM OLD.reply_to_provider_id OR NEW.reply_snapshot IS DISTINCT FROM OLD.reply_snapshot THEN RAISE EXCEPTION 'Reply metadata is server owned'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_outgoing_reply_metadata BEFORE INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.protect_outgoing_reply_metadata();