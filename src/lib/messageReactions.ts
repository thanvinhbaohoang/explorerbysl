// Per-platform allowlists. Each entry was proven recipient-side on the approved test chat
// before it was listed here, and the code points must match the provider's exact emoji
// representation (no variation selectors). Keep the two lists separate: a reaction that
// works on one channel is not assumed to work on the other.
export const TELEGRAM_REACTION_CHOICES = [
  { emoji: '❤', label: 'Heart' },
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '🙏', label: 'Folded hands' },
] as const;

export const MESSENGER_REACTION_CHOICES = [
  { emoji: '❤', label: 'Heart' },
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '😆', label: 'Laughing' },
  { emoji: '😮', label: 'Surprised' },
  { emoji: '😢', label: 'Crying' },
  { emoji: '😠', label: 'Angry' },
  { emoji: '🙏', label: 'Folded hands' },
] as const;

export const REACTION_CHOICES = MESSENGER_REACTION_CHOICES;

export function reactionChoices(platform: string) {
  if (platform === 'telegram') return TELEGRAM_REACTION_CHOICES;
  if (platform === 'messenger') return MESSENGER_REACTION_CHOICES;
  return [];
}

export function isAllowedReaction(platform: string, emoji: string | null): boolean {
  if (emoji === null) return true;
  return reactionChoices(platform).some(choice => choice.emoji === emoji);
}

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
