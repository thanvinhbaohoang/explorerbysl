export const REACTION_CHOICES = [{ emoji: '❤', label: 'Heart' }, { emoji: '👍', label: 'Thumbs up' }] as const;
export interface ReactionTarget {
  id: string; platform: string; sender_type: string; telegram_message_id?: number | null;
  messenger_mid: string | null; media_group_id: string | null; isPending?: boolean;
}
export function canReact(message: ReactionTarget) {
  if (message.isPending || message.id.startsWith('temp-') || message.sender_type !== 'customer' || message.media_group_id) return false;
  return message.platform === 'telegram' ? !!message.telegram_message_id : message.platform === 'messenger' && !!message.messenger_mid && !/-\d+$/.test(message.messenger_mid);
}
export function nextReaction(platform: string, current: string | null, selected: string) {
  return platform === 'telegram' && current === selected ? null : selected;
}
export function movedTooFar(start: { x: number; y: number }, x: number, y: number) {
  return Math.hypot(x - start.x, y - start.y) > 10;
}