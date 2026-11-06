# Two-way message reactions — Phase 1 capability test (then gated Phase 2)

Nothing is published. Saved Replies, Saved Voice, inbox filters, normal messaging and customer data stay untouched. Only the three approved internal chats are used: Telegram Huth Sakda, Explorer by SL Messenger (Huth Sakda), Explorer Travel Agency Messenger (Steven Ly).

## Phase 1 — prove each direction on each channel (no app UI built)

For each of the 3 channels, record PASS / FAIL for:
- A. Customer adds a reaction → we receive it with exact target message ID + emoji
- B. Customer changes / removes it → we receive the change/removal
- C. Staff sets a reaction on a customer message → appears in customer's app
- D. Staff changes / removes it → customer's app updates

### Steps
1. Read-only inspection
   - Telegram: `getWebhookInfo` (current `allowed_updates`), bot's own info. Check whether `message_reaction` is subscribed.
   - Messenger: each Page's subscribed webhook fields (`/{page-id}/subscribed_apps`) and app-level fields; check for `message_reactions`. Confirm granted permissions on the Page tokens.
   - Audit how we store provider message IDs today: incoming Telegram `telegram_message_id`, Messenger `messenger_mid`, and whether outgoing sends store them (needed later for staff-sent messages).
2. Snapshot, then temporary subscription changes (live backend — preview and production share it)
   - First save the exact current Telegram `allowed_updates` and each Page's subscribed fields.
   - Telegram: add `message_reaction` to the existing list only. Same webhook URL, no `drop_pending_updates`, no fields removed. `getWebhookInfo` does not reveal the secret, and the current Telegram handler checks no secret header — so before re-registering I confirm the current registration has no secret in use (e.g. a webhook delivery succeeding with no header present). If a secret might be in use and cannot be reproduced exactly, the Telegram subscription change is skipped and Telegram A/B are reported as untested.
   - Messenger: add `message_reactions` to each Page; no existing fields removed.
   - When testing ends, restore the saved snapshot exactly, whether results are PASS or FAIL, and re-read it to prove restoration.
3. Evidence capture, minimal and bounded
   - Messenger: use the existing `messenger_webhook_events` diagnostic log; no code change.
   - Telegram: if no existing log captures reaction updates, a temporary log-only branch is deployed (deployment time recorded) writing to the existing `telegram_webhook_failures` table (no schema change) with a dedicated `stage = 'reaction_probe'` — the replay tool only picks up `stage = 'insert'`, so these rows are never replayed — storing only chat type, target message ID, action (add/change/remove) and emoji — no names, tokens or text. It is removed and redeployed after evidence is captured, and its rows are deleted within the test session (max 24h).
   - No message rows created; all other update handling unchanged.
4. Telegram chat type: the result records the chat type (private). Bot API documents `message_reaction` delivery as requiring the bot to be an administrator, so in a private chat Telegram A/B passes only if an actual reaction update is received — a successful staff send (C/D) does not prove it.
4. Customer-side tests (you react from the internal accounts on a recent customer message and a staff message): heart → change emoji → remove. I record payloads with tokens and personal IDs redacted.
5. Staff-side tests via official APIs only, on one recent customer message per chat:
   - Telegram `setMessageReaction` (set heart, change, empty list to remove).
   - Messenger: `sender_action: "react"` / `"unreact"` is an untested hypothesis, not an established API. Any provider rejection is recorded as FAIL with the response.
   - You confirm on the receiving phone with screenshots.
6. Report: a 3×4 matrix, redacted payloads, provider responses, limitations (e.g. Telegram may only deliver reactions in some chat types; Messenger may not support Page-sent reactions).

### Stop rule
If any cell fails, stop testing, restore the exact subscription snapshots unconditionally, remove any temporary Telegram logging, verify restoration, and then report the result. A failed cell leads to a channel-specific proposal (e.g. "receive-only reactions on Messenger"), never an attempted full two-way build. No UI is built until you approve.

## Phase 2 — outline only (built only for proved capabilities, after your approval)
- New staff-only `message_reactions` table: platform, chat/page + customer ID, provider message ID, actor (customer/staff), emoji, staff name, provider-confirmed flag, timestamps; unique per (target, actor) so changes replace and removals delete; indexes on target ID.
- Webhooks map reactions by exact provider IDs only (never text/time); duplicates are idempotent; reactions arriving before their message row are kept and attach when it appears; grouped media map to the specific item.
- Reliable capture of outgoing provider message IDs where missing.
- Reaction chip on the specific bubble (customer vs staff clearly marked), accessible picker on eligible messages; UI changes only after provider success, errors restore prior state.
- Full verification: both directions on all 3 channels, heart/change/remove, desktop + mobile, forced provider failure, tests, build, TypeScript, security scan, regression checks, receiving-side screenshots, publish-safety verdict.

## Technical notes
- Phase 1 changes are limited to webhook subscriptions and a log-only branch for reaction events; no schema changes.
- Telegram `allowed_updates` change is made through the existing connector gateway with the same secret token.
