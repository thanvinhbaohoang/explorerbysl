import { describe, expect, it } from 'vitest';
import { canReact, isAllowedReaction, movedTooFar, nextReaction, reactionChoices } from './messageReactions';
const target = { id: 'row', platform: 'telegram', sender_type: 'customer', telegram_message_id: 123, messenger_mid: null, media_group_id: null };
describe('verified reaction rules', () => {
  it('requires a real Telegram message ID', () => { expect(canReact(target)).toBe(true); expect(canReact({ ...target, telegram_message_id: null })).toBe(false); });
  it('never targets an album as an individual message', () => expect(canReact({ ...target, media_group_id: 'album' })).toBe(false));
  it('does not react to pending or staff messages', () => { expect(canReact({ ...target, isPending: true })).toBe(false); expect(canReact({ ...target, sender_type: 'employee' })).toBe(false); });
  it('toggles a verified Telegram reaction off', () => expect(nextReaction('telegram', '❤', '❤')).toBe(null));
  it('does not expose unverified Messenger removal', () => expect(nextReaction('messenger', '❤', '❤')).toBe('❤'));
  it('withholds Travel Agency and unknown Messenger pages', () => {
    const message = { ...target, platform: 'messenger', messenger_mid: 'm_real' };
    expect(canReact(message, '103275792431920', '2026-11-06T07:13:01Z', Date.parse('2026-11-06T08:15:00Z'))).toBe(false);
    expect(canReact(message, null, '2026-11-06T07:13:01Z', Date.parse('2026-11-06T08:15:00Z'))).toBe(false);
    expect(canReact(message, '109469038735899', '2026-11-06T07:13:01Z', Date.parse('2026-11-06T08:15:00Z'))).toBe(true);
  });
  it('withholds controls at the exact 24-hour boundary', () => expect(canReact({ ...target, platform: 'messenger', messenger_mid: 'm_real' }, '109469038735899', '2026-11-05T08:15:00Z', Date.parse('2026-11-06T08:15:00Z'))).toBe(false));
  it('rejects synthetic Messenger IDs', () => expect(canReact({ ...target, platform: 'messenger', messenger_mid: 'm_real-1' }, '109469038735899', '2026-11-06T07:13:01Z', Date.parse('2026-11-06T08:15:00Z'))).toBe(false));
  it('cancels long press after touch movement', () => { expect(movedTooFar({ x: 0, y: 0 }, 11, 0)).toBe(true); expect(movedTooFar({ x: 0, y: 0 }, 5, 0)).toBe(false); });
});