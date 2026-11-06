# More reaction emojis (Messenger and Telegram)

## Why only the heart shows now
Messenger currently allows only ❤ because it is the only emoji we've confirmed on Huth Sakda's phone. Telegram allows ❤ and 👍.

## Plan
1. **Messenger tests** (Explorer by SL page, Huth Sakda's chat, only while the 24-hour window is open). Emojis to test, one at a time: 👍 😆 😮 😢 😠 🙏. After each one, you confirm on the receiving phone that it appears on the exact message and replaces the previous reaction.
2. **Telegram test**: try 🙏 on Huth Sakda's Telegram chat the same way.
3. **Evidence**: for each emoji, record the exact characters sent and returned (Unicode code points, including any hidden variation marks), the provider's response, and your phone confirmation. The picker and the server use these exact characters.
4. **Add only what passed**, using separate Messenger and Telegram lists in both the picker and the server. Any emoji that failed is left out and reported.
5. **Checks**: existing tests, new list tests, build, type check, and the picker on desktop and mobile. Nothing gets published.
6. **Release report**: lists the verified emojis per platform and the current limitations (incoming customer reactions aren't shown, removing a reaction isn't available on Messenger, and Travel Agency has no reactions).

## Not changing
Sending, Saved Replies, Saved Voice, and the limitations above.

## Technical
- `src/lib/messageReactions.ts`: replace `REACTION_CHOICES` with per-platform lists `{ telegram: [...], messenger: [...] }`, holding the exact recorded strings. The picker reads the list for the current platform.
- `message-reaction` function: per-platform allowlists hold the same exact strings. The request body stays strictly `{ message_id, emoji }`, and any `platform`, `page_id` or `customer_id` field is rejected. The server loads the stored message, then its customer. From those stored records it determines the platform, the Page and the recipient, then picks the allowlist and route. This replaces the `emoji !== '❤'` check. The approved-staff check and the exact-message checks stay as they are: customer sender, not part of an album, real provider ID, Explorer by SL Page only, and the 24-hour window. Redeploy.
- Unit tests:
  - Messenger accepts only its list, and Telegram accepts only its own.
  - A missing or extra variation mark (❤ vs ❤️, for example) is rejected.
  - The picker and server lists match.
  - A Telegram-only emoji sent to a stored Messenger message is rejected.
  - A request with an extra `platform` field is rejected.
- The roadmap gets this task when work starts. This partly resumes the paused reaction work, limited to this scope.
