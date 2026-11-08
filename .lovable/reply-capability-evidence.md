# Reply capability evidence (Phase 1)
Live effects: six real test messages sent to the approved chats; a temporary Telegram reply capture was deployed to the shared backend. Test messages are retained for phone verification. No reply UI or permanent reply schema has been implemented.
- Telegram staff→customer text: sendMessage reply_parameters.message_id=114945 → HTTP 200, new message 115606, response echoes reply_to_message 114945. Phone: PASS (user confirmed quote on "Test" message, 2026-11-07).
- Explorer Messenger staff→customer text: reply_to.mid=m_HFvBBT…hA → HTTP 200, mid m__P92W…jqQ. Phone: PASS (user confirmed quote on latest message, 2026-11-07).
- Telegram staff→customer photo: sendPhoto reply_parameters.message_id=114945 → ok:true, msg 115608, reply_to 114945. Phone: PASS (user confirmed quote on "Test", 2026-11-07).
- Explorer Messenger staff→customer photo: image attachment + reply_to.mid → HTTP 200, mid m_9E8UGDj…EXw, attachment_id 4551644701716451. (First attempt failed #100 because picsum redirects; resolved final URL succeeded.) Phone: PASS (user confirmed quote, 2026-11-07).
- Telegram staff→customer voice: sendVoice reply_parameters.message_id=114945 → ok:true, 3s voice note with caption. Phone: PASS (user confirmed quote on "Test", 2026-11-08).
- Explorer Messenger staff→customer voice: audio attachment + reply_to.mid → HTTP 200. Phone: PASS (user confirmed quote, 2026-11-08).
- Travel Agency: no approved Huth Sakda chat on that Page → UNAVAILABLE (needs an approved test chat).
- Messenger incoming log stores individual Page entries in `body.messaging`, not an entire `body.entry` envelope. Verification queries check that actual shape.

## Incoming verification — 2026-11-08

- Telegram update 408086199: private chat 803364676, message 115968, text `Hi`, received 02:41:00 UTC (09:41 Phnom Penh). Raw provider event contains no `reply_to_message`. Ordinary message saved successfully. Zero `reply_probe` rows for this chat.
- Explorer by SL Messenger: customer message `m_ePBgqr-MV_g5fNROijcUcPpTTJLtw6WDp_TOK0H2qfSb5TK3oy62yLJny3xBaLmvZv4m3pE7tUq0H1M8TvS2XA`, text `Hi`, received 02:40:49 UTC (09:40:49 Phnom Penh). Raw provider event contains no `reply_to`. Correct-shape query found no quoted events for the approved recipient.
- These are successful ordinary deliveries, not evidence of native quoting. No target ID can be inferred from their text or time.

### Follow-up at 09:44 Phnom Penh

User reports sending a quote, photo and voice. All six new messages arrived and are saved:
- Telegram private chat: update 408086200 / message 115969 (photo), update 408086201 / message 115970 (2-second voice), update 408086202 / message 115971 (`Testing testing`). Complete logged provider messages contain no `reply_to_message` or other quoted-target field.
- Explorer Messenger: photo `m_LBNs-CmqYCsJwyGycO0llPpTTJLtw6WDp_TOK0H2qfSf-skkxXWUtbhiZkTuBQ-ucz6UaMVqoqZfJ0iwktGlEQ` at 09:43:40, audio `m_cy4RVeyHl-Ee1k-fAd8RQvpTTJLtw6WDp_TOK0H2qfSk1er7YdPJ7OZ1K8jWyJ7SAe0gjBp-XNSveFi_EeeWNw` at 09:43:49, text `m_fakoRjiMQp6N1WQLemlqmvpTTJLtw6WDp_TOK0H2qfRvC6dKgSLro2YTZsVmvjJBY5a5xdD5kA7DD2GrgRVuGg` (`Testing`) at 09:44:26. Raw message objects have no `reply_to` field.
- Messenger media rows currently append `-0` to the raw provider MID; a future exact-target implementation must preserve canonical provider IDs separately rather than assume those synthetic row values are valid targets.
- Incoming quoting remains UNTESTED, not a platform FAIL: receiving-phone screenshot of a sent message with a visible quoted original is needed to distinguish a native quote from an ordinary send. No target guessed; no new deployment or provider send performed in this follow-up.

| Channel | Staff→customer text | Staff→customer photo | Staff→customer voice | Customer→staff quote of text | Customer→staff quote of photo | Customer→staff quote of voice |
|---|---|---|---|---|---|---|
| Telegram private chat | PASS: user phone confirmation | PASS: user phone confirmation | PASS: user phone confirmation | UNTESTED: no quote event | UNTESTED: no quote event | UNTESTED: no quote event |
| Explorer by SL Messenger | PASS: user phone confirmation | PASS: user phone confirmation | PASS: user phone confirmation | UNTESTED: no quote event | UNTESTED: no quote event | UNTESTED: no quote event |
| Travel Agency Messenger | UNTESTED: no approved chat | UNTESTED: no approved chat | UNTESTED: no approved chat | UNTESTED: no approved chat | UNTESTED: no approved chat | UNTESTED: no approved chat |

Restoration: temporary Telegram capture removed from source; deployment and verification recorded below. No subscriptions changed in this verification session. No diagnostic rows existed to delete. No additional test messages sent, business data altered or publication performed.

- Restoration deployed successfully on 2026-11-08; submitted source SHA-256 `8800b95b77d69dc1a4eb0625bdf2240077c2e6a5377fc4f31df9382700b4e35c`.
- Post-deployment GET health check: HTTP 200, `ExplorerBySLBot` running. This proves endpoint availability, not incoming-quote capability.
- Existing suite: 59/59 tests passed; preview build log reports `build OK`. No reply UI exists to test on desktop/mobile at this phase.

Gate: Phase 1 remains incomplete; Phase 2 remains unapproved. A fresh bounded Telegram capture will be needed for the next coordinated incoming-quote test. Do not call this feature complete or safe to publish.
