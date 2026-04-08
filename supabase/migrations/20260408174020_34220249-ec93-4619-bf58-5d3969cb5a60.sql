CREATE POLICY "Admins can delete customer"
ON public.customer
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));