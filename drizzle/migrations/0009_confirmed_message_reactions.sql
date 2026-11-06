CREATE TABLE public.message_reactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
 customer_id uuid NOT NULL REFERENCES public.customer(id) ON DELETE CASCADE,
 actor_type text NOT NULL DEFAULT 'staff' CHECK (actor_type IN ('staff','customer')),
 emoji text,
 updated_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now(),
 lease_id uuid,
 lease_until timestamptz,
 UNIQUE(message_id, actor_type)
);
GRANT SELECT ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved staff read message reactions" ON public.message_reactions FOR SELECT TO authenticated USING (public._saved_reply_is_staff());
CREATE INDEX message_reactions_customer_idx ON public.message_reactions(customer_id);
CREATE FUNCTION public.claim_message_reaction(p_message_id uuid, p_customer_id uuid, p_lease_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.message_reactions(message_id,customer_id,actor_type,lease_id,lease_until)
 VALUES(p_message_id,p_customer_id,'staff',p_lease_id,now()+interval '90 seconds')
 ON CONFLICT(message_id,actor_type) DO UPDATE SET lease_id=excluded.lease_id,lease_until=excluded.lease_until
 WHERE message_reactions.lease_until IS NULL OR message_reactions.lease_until < now();
 RETURN FOUND;
END;
$$;
CREATE FUNCTION public.finish_message_reaction(p_message_id uuid,p_lease_id uuid,p_success boolean,p_emoji text,p_user_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 UPDATE public.message_reactions SET emoji=CASE WHEN p_success THEN p_emoji ELSE emoji END, updated_by=CASE WHEN p_success THEN p_user_id ELSE updated_by END,updated_at=CASE WHEN p_success THEN now() ELSE updated_at END,lease_id=NULL,lease_until=NULL WHERE message_id=p_message_id AND actor_type='staff' AND lease_id=p_lease_id;
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_message_reaction(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_message_reaction(uuid,uuid,boolean,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_message_reaction(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_message_reaction(uuid,uuid,boolean,text,uuid) TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;