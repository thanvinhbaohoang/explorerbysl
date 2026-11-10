import { describe, expect, it } from 'vitest';
import { replyTargetError, replyWindowOpen, VERIFIED_REPLY_PAGE } from '../../supabase/functions/_shared/replyRules';
const target = { id: 'target', customer_id: 'chat', platform: 'telegram', sender_type: 'customer', telegram_message_id: 114945 };
describe('Outgoing reply rules', () => {
  it('accepts an exact Telegram target', () => expect(replyTargetError(target, { id: 'chat' }, 'telegram')).toBeNull());
  it('rejects a different intended conversation', () => expect(replyTargetError(target, { id: 'other' }, 'telegram')).not.toBeNull());
  it('rejects a different platform', () => expect(replyTargetError(target, { id: 'chat' }, 'messenger')).not.toBeNull());
  it('rejects historical Telegram messages without IDs', () => expect(replyTargetError({ ...target, telegram_message_id: null }, { id: 'chat' }, 'telegram')).not.toBeNull());
  it('rejects albums', () => expect(replyTargetError({ ...target, media_group_id: 'album' }, { id: 'chat' }, 'telegram')).not.toBeNull());
  it('accepts only the proven Messenger Page', () => {
    const m = { ...target, platform: 'messenger', messenger_mid: 'm_exact' };
    expect(replyTargetError(m, { id: 'chat', page_id: VERIFIED_REPLY_PAGE }, 'messenger')).toBeNull();
    expect(replyTargetError(m, { id: 'chat', page_id: 'travel' }, 'messenger')).not.toBeNull();
  });
  it('rejects synthetic Messenger attachment IDs', () => expect(replyTargetError({ ...target, platform: 'messenger', messenger_mid: 'm_exact-0' }, { id: 'chat', page_id: VERIFIED_REPLY_PAGE }, 'messenger')).not.toBeNull());
  it('does not apply the 24-hour limit to Telegram', () => expect(replyWindowOpen('telegram', null)).toBe(true));
  it('blocks Messenger at exactly 24 hours', () => {
    const now = Date.parse('2026-11-10T01:16:00Z');
    expect(replyWindowOpen('messenger', '2026-11-09T01:16:00Z', now)).toBe(false);
    expect(replyWindowOpen('messenger', '2026-11-09T01:16:01Z', now)).toBe(true);
    expect(replyWindowOpen('messenger', null, now)).toBe(false);
  });
});