import { replyTargetError } from '../../supabase/functions/_shared/replyRules';
import type { Message } from '@/hooks/useChatMessages';
export function canReplyToMessage(message: Message, customerId: string, pageId?: string | null): boolean {
  return !message.isPending && replyTargetError(message, { id: customerId, page_id: pageId }, message.platform) === null;
}
export function replyExcerpt(message: Message): string {
  return message.message_text?.slice(0, 160) || (message.message_type === 'photo' ? 'Photo' : message.message_type === 'voice' ? 'Voice message' : 'Message');
}