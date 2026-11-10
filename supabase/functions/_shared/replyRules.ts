export const VERIFIED_REPLY_PAGE = '109469038735899';
export type ReplyTarget = { id: string; customer_id: string | null; platform: string; sender_type: string | null; telegram_message_id?: number | null; messenger_mid?: string | null; media_group_id?: string | null };
export function replyTargetError(target: ReplyTarget, customer: { id: string; page_id?: string | null }, platform: string): string | null {
  if (target.customer_id !== customer.id || target.platform !== platform) return 'The reply target belongs to another conversation';
  if (target.sender_type !== 'customer' || target.media_group_id) return 'Reply to a single customer message instead';
  if (platform === 'telegram') return Number.isSafeInteger(target.telegram_message_id) && Number(target.telegram_message_id) > 0 ? null : 'This message has no verified Telegram ID';
  if (platform === 'messenger') return customer.page_id === VERIFIED_REPLY_PAGE && !!target.messenger_mid && !/-\d+$/.test(target.messenger_mid) ? null : 'This Messenger message is not a verified reply target';
  return 'Unsupported channel';
}
export function replyWindowOpen(platform: string, timestamp: string | null, now = Date.now()): boolean {
  return platform === 'telegram' || (platform === 'messenger' && timestamp !== null && Number.isFinite(Date.parse(timestamp)) && now - Date.parse(timestamp) < 86400000);
}