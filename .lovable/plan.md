# Message reactions — finish the test, then build the buttons

## Why there is no button yet
Phase 1 only tests whether Telegram and Messenger let us send and receive reactions. No reaction button or reaction display was built, because you said to wait for the test results before approving Phase 2. That is why the "Test" message (14:17) shows no reactions.

## What the test has shown so far
- Messenger (Explorer by SL): sending a staff ❤ worked. Your phone screenshot and the customer-side add/change/remove steps are still pending.
- Telegram: the "Test" message from Huth Sakda did reach the app, but the temporary test step did not record its message number. So the staff reaction test has not run yet.
- The app does not save Telegram message numbers at all today. Without them it can't react to a specific Telegram message, or show which message a customer reacted to.

## Step 1 — Finish Phase 1 (test only, no visible changes)
1. Find out why the temporary Telegram step didn't record the message, fix it and redeploy.
2. You send one more "test". I add ❤ to it, change it to 👍, then remove it. You check your phone each time.
3. For Messenger, read the customer reactions saved in the existing event log, if your add/change/remove steps were done before the chat closed.
4. Remove the temporary Telegram step, restore Messenger subscriptions exactly as they were, and confirm the restore.
5. Report the results as a 3 channels × 4 checks table.

## Step 2 — Phase 2, built only for checks that passed (needs your approval after Step 1)
- A small smile button that appears when you hover over or long-press a message. It opens a few emojis (❤ 👍 😂 😮 😢 🙏). Pick one to react, pick it again to remove it.
- A customer's reaction appears as a small badge under the message they reacted to, and updates live.
- On channels where a check failed, the button stays hidden. You get a separate proposal for each such channel.
- Nothing changes in Send, Saved Replies, Saved Voice or the inbox filters.

## Technical details
- New `message_reactions` table (message_id, actor customer/staff, emoji, timestamps), with RLS for approved staff only and realtime enabled.
- Save `telegram_message_id` on new inbound and outbound Telegram messages. This is an existing column that is currently left empty.
- Telegram's `message_reaction` updates need to be listed in `allowed_updates`. That can only be changed if the webhook registration can be reproduced exactly; otherwise Telegram customer→app stays UNTESTED.
- Messenger: subscribe `message_reactions` permanently only if it passes, and map `reaction.mid` to `messenger_mid`.
- Staff reactions go through a new staff-checked action in the existing functions.
- Nothing is published automatically.
