import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { nextReaction } from '@/lib/messageReactions';
import type { Message } from '@/hooks/useChatMessages';

export function useMessageReactions(customerIds: string[]) {
  const client = useQueryClient();
  const ids = [...new Set(customerIds)].sort().join(',');
  const key = ['message-reactions', ids];
  const locks = useRef(new Set<string>());
  const query = useQuery({ queryKey: key, enabled: !!ids, queryFn: async () => {
    const { data, error } = await supabase.from('message_reactions').select('message_id,actor_type,emoji').in('customer_id', ids.split(','));
    if (error) throw error;
    return data;
  }, refetchInterval: 30000 });
  useEffect(() => {
    if (!ids) return;
    const channel = supabase.channel(`reactions-${crypto.randomUUID()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `customer_id=in.(${ids})` }, () => client.invalidateQueries({ queryKey: ['message-reactions', ids] })).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [ids, client]);
  const react = async (message: Message, emoji: string) => {
    if (locks.current.has(message.id)) return false;
    locks.current.add(message.id);
    const current = query.data?.find(row => row.message_id === message.id && row.actor_type === 'staff')?.emoji ?? null;
    try {
      const { data, error } = await supabase.functions.invoke('message-reaction', { body: { message_id: message.id, emoji: nextReaction(message.platform, current, emoji) } });
      if (error) {
        let detail = error.message;
        if (error.context instanceof Response) { const body = await error.context.json().catch(() => null); detail = body?.error || detail; }
        throw new Error(detail);
      }
      if (!data?.success) throw new Error(data?.error || 'Reaction was not confirmed');
      await client.invalidateQueries({ queryKey: key });
      return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Reaction failed. Please try again.'); return false; }
    finally { locks.current.delete(message.id); }
  };
  return { rows: query.data ?? [], react };
}