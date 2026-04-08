CREATE POLICY "Admins can delete messages"
ON public.messages
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete customer_summaries"
ON public.customer_summaries
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete telegram_leads"
ON public.telegram_leads
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));