export const REACTION_CHOICES = [{ emoji: '❤', label: 'Heart' }, { emoji: '👍', label: 'Thumbs up' }] as const;
export interface ReactionTarget {
  id: string; platform: string; sender_type: string; telegram_message_id?: number | null;
  messenger_mid: string | null; media_group_id: string | null; isPending?: boolean;
}
export function canReact(message: ReactionTarget, pageId?: string | null, latestCustomerTimestamp?: string | null, now = Date.now()) {
  if (message.isPending || message.id.startsWith('temp-') || message.sender_type !== 'customer' || message.media_group_id) return false;
  if (message.platform === 'telegram') return Number.isSafeInteger(message.telegram_message_id) && Number(message.telegram_message_id) > 0;
  const timestamp = latestCustomerTimestamp ? Date.parse(latestCustomerTimestamp) : NaN;
  return message.platform === 'messenger' && pageId === '109469038735899' && !!message.messenger_mid && !/-\d+$/.test(message.messenger_mid) && Number.isFinite(timestamp) && now - timestamp < 86400000;
}
export function nextReaction(platform: string, current: string | null, selected: string) {
  return platform === 'telegram' && current === selected ? null : selected;
}
export function movedTooFar(start: { x: number; y: number }, x: number, y: number) {
  return Math.hypot(x - start.x, y - start.y) > 10;
}