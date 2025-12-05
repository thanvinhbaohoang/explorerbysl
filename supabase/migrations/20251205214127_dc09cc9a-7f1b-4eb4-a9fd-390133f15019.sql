-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view files (since they're shared in chats)
CREATE POLICY "Public read access for chat attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

-- Allow authenticated users to upload files (in this case, we'll use service role from edge functions)
-- Since this is accessed via edge functions with service role, we need a more permissive policy
CREATE POLICY "Allow uploads to chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "Allow updates to chat attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Allow deletes from chat attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-attachments');