# More Messenger reaction emojis

## Why only the heart shows now
Messenger currently allows only ❤ because it is the only emoji we've confirmed on Huth Sakda's phone. Telegram already allows ❤ and 👍. This keeps the earlier rule: we only offer what we've confirmed works.

## Plan
1. **Test each new emoji on Messenger first** (Explorer by SL page, Huth Sakda's chat, while the 24-hour reply window is open). Emojis to test: 👍 😆 😮 😢 😠, the standard Messenger set. I send one at a time. You confirm on the phone that each one appears and replaces the previous one.
2. **Add only the confirmed emojis** to the Messenger picker and the server's allowed list. Any emoji Messenger rejects or that doesn't show up is left out, and I'll tell you which.
3. **Add the same emojis to Telegram** if you want. Telegram supports them, but I'd test each on Huth Sakda's Telegram the same way.
4. Run all tests and the build, and check the picker on desktop and mobile. Nothing gets published.

## Not changing
Removing reactions on Messenger, showing customers' reactions, the Travel Agency page, sending, Saved Replies and Saved Voice.

## Technical
- `REACTION_CHOICES` becomes per-platform in `src/lib/messageReactions.ts`. Update the picker to match.
- `message-reaction` function: widen the zod enum and replace the Messenger `emoji !== '❤'` check with a verified-list check. Redeploy.
- Add unit tests: Messenger accepts only the verified list, and an unlisted emoji is rejected.
- This partly resumes the paused reaction work, limited to this scope.
