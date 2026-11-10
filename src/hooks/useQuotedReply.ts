import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Message } from '@/hooks/useChatMessages';

export function useQuotedReply(upload: (file: File) => Promise<string>, onConfirmed: (message: Message) => void) {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const pending = useRef<{ signature: string; requestId: string; url?: string } | null>(null);
  const send = async (target: Message, text: string, file?: File, duration?: number): Promise<boolean> => {
    if (inFlight.current) return false;
    const kind = file ? (file.type.startsWith('image/') ? 'photo' : 'voice') : 'text';
    const signature = JSON.stringify([target.id, target.customer_id, kind, text, file?.name, file?.size, file?.lastModified, duration]);
    inFlight.current = true; setBusy(true);
    let response;
    try {
      if (!pending.current || pending.current.signature !== signature) pending.current = { signature, requestId: crypto.randomUUID() };
      const request = pending.current;
      if (file && !request.url) {
        let uploadFile = file;
        if (kind === 'voice' && file.type !== 'audio/mpeg') {
          const { convertBlobToMp3 } = await import('@/lib/audio-conversion');
          uploadFile = await convertBlobToMp3(file);
        }
        request.url = await upload(uploadFile);
      }
      response = await supabase.functions.invoke('send-quoted-reply', { body: {
        request_id: request.requestId, customer_id: target.customer_id, reply_to_message_id: target.id,
        kind, text: text || undefined, media_url: request.url, duration,
      } });
      if (response.error || !response.data?.success) {
        let details = response.data;
        if (!details && response.error?.context instanceof Response) details = await response.error.context.clone().json().catch(() => null);
        throw new Error(details?.error || 'Reply delivery was not confirmed; your draft is kept.');
      }
      if (response.data.message) onConfirmed(response.data.message as Message);
      if (response.data.warning) toast.warning(response.data.warning);
      pending.current = null;
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reply not sent — draft kept for retry', { duration: 10000 });
      return false;
    } finally { inFlight.current = false; setBusy(false); }
  };
  return { send, busy };
}