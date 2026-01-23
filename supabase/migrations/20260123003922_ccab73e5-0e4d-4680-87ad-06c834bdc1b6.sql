-- Allow authenticated users to mark messages as read
CREATE POLICY "Authenticated users can mark messages as read"
ON public.messages
FOR UPDATE
USING (true)
WITH CHECK (true);