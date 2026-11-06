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
- `message-reaction` function: per-platform allowlists hold the same exact strings. Validate against the list for the request's platform, replacing the `emoji !== '❤'` check. Redeploy.
- Unit tests:
  - Messenger accepts only its list, and Telegram accepts only its own.
  - A missing or extra variation mark (❤ vs ❤️, for example) is rejected.
  - The picker and server lists match.
- The roadmap gets this task when work starts. This partly resumes the paused reaction work, limited to this scope.
