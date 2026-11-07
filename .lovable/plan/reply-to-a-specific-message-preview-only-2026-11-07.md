# Reply to a specific message — Preview only

Current state (checked): no reply support exists anywhere in the app or its server steps. Telegram message numbers are saved only for messages since the reactions work. Messenger message numbers are saved through the existing Messenger handlers.

## Phase 1 — Capability proof (no app screens; temporary live code, removed afterward)
Approved internal chats only: Huth Sakda on Telegram, on Explorer by SL and on Travel Agency (if a Travel Agency test chat is approved and its 24-hour window is open).
For each channel, record the exact request, the provider's response and your phone screenshot:
1. Staff → customer: a text reply sent with Telegram `reply_parameters.message_id` or Messenger `reply_to.mid`. Then one reply with a photo and one with a voice note.
2. Customer → staff: you quote one of our messages from your phone. I record the raw incoming event (Telegram `reply_to_message`, Messenger `message.reply_to.mid`) using only the existing event logs. No new subscriptions are needed.
   - Log check done: the Messenger event log keeps the full incoming event, and one of its 200 saved events already contains `reply_to`. Telegram only saves the full update when something fails, so it can't capture replies. For Telegram I'll add a bounded temporary capture: it saves only updates from Huth Sakda's chat that contain `reply_to_message`, into the existing failures table as `stage='reply_probe'`, and is removed when the test ends. If that isn't possible, those cells are marked UNAVAILABLE.
   - Customer → staff is tested separately for text, photo and voice quotes. Any cell that isn't tested is marked UNTESTED.
   - Live effects: real messages are sent to the approved chats and kept for checking on your phone. Temporary reply-sending and capture code is deployed live. I record each deployment and its time, then remove the code and redeploy afterward, whatever the results.
3. Gate: I stop and show you the matrix of channel × direction × media type. You approve the exact scope before any UI or migration work starts. Any combination that fails is left out and reported, never sent as a plain unquoted message.

## Phase 2 — Build (after approval)
- **Desktop:** hovering over or tabbing to a customer message shows a Reply button next to the reaction button.
- **Mobile:** a long press opens one menu with Reply and Reactions. There is also a visible tap button. Scrolling, opening photos and playing voice notes keep working.
- **Composer:** a small quote bar sits above the box, showing the sender and a short preview. Cancelling it keeps the draft. Choosing Reply sends nothing on its own. If sending fails, the draft and the quote stay for a retry, and double sends are blocked.
- **Incoming replies:** a customer's bubble shows the message they quoted. Tapping it scrolls to and highlights the original. If the original isn't loaded, the bubble shows the saved preview or "Original message unavailable". The app never guesses which message was quoted.
- **Albums:** Reply is hidden on any item without a real provider message number (for example, made-up numbers like `mid-1`). The reason is shown in a tooltip.

## Technical details
- Additive migration on `messages`: nullable `reply_to_provider_id`, `reply_to_message_id` (a local id matched only by exact provider id within the same customer, Page and platform), and `reply_snapshot` (jsonb with sender, text excerpt and media type). Adds an index and grants. Existing rows are untouched.
- Late linking: if a reply arrives before its original row, a later insert of the original fills in `reply_to_message_id` (idempotent, so duplicate webhooks are safe).
- Send paths (`telegram-bot` and the Messenger send action) gain one optional `reply_to_message_id`, which is a local UUID. Existing customer/Page fields stay as they are. The server confirms the sender is approved staff, loads the row, checks it belongs to the conversation, customer, Page and platform the send is going to, and takes the provider id from the stored row. The 24-hour window applies to Messenger only, not Telegram. Only then does it build the native reply. The browser never supplies provider ids, a Page or a customer.
- Webhooks (`telegram-bot`, `messenger-webhook`) parse the reply target and save the snapshot.
- When no reply is selected, text, photo, voice, Saved Replies and Saved Voice go through the same send path as today. Selecting a saved item only fills the composer.
- Tests: target validation, wrong-chat rejection, synthetic-id rejection, exact matching and snapshot fallback.
- Checks: unit tests, build, lint, security scan, desktop/mobile Playwright, and preservation counts for Saved Replies, pictures and voices.
- Report: supported and unsupported combinations, changed files and migrations, screenshots, and one publish verdict. Nothing is published.
