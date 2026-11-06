# Reaction emoji capability evidence

Scope: Explorer by SL Messenger page `109469038735899`, Huth Sakda's chat only.
Target message (exact, never inferred from text or time):
`m_HFvBBTjLcWMD0EzEEM4ZKPpTTJLtw6WDp_TOK0H2qfSXAMq7svcUv0--YUnqA6Bu-XeJX75OJbay53ah07Q2hA`
— Huth Sakda's customer message at 2026-11-06 14:13:01.524 GMT+7, recipient_id `27712528288336766`.
Request shape: `sender_action: react`, `payload: { message_id, reaction }`, Graph API v18.0,
Page token read server-side from `facebook_pages`. Provider acceptance alone is never PASS;
every PASS below needs the user's phone confirmation on the exact message.

| Emoji | Exact code points | Provider response | Recipient-side confirmation | Verdict |
|---|---|---|---|---|
| ❤ | U+2764 | HTTP 200 | confirmed on phone (earlier round) | PASS |
| 👍 | U+1F44D | HTTP 200 | confirmed replaced ❤ | PASS |
| 😆 | U+1F606 | HTTP 200 | confirmed replaced 👍 | PASS |
| 😮 | U+1F62E | HTTP 200 | confirmed replaced 😆 | PASS |
| 😢 | U+1F622 | HTTP 200 | confirmed replaced 😮 | PASS |
| 😠 | U+1F620 | HTTP 200 | confirmed replaced 😢 | PASS |
| 🙏 | U+1F64F | HTTP 200 | confirmed replaced 😠 on exact message, 2026-11-06 09:38 UTC | PASS |

Telegram 🙏 test: exact emoji U+1F64F (no variation selector), `setMessageReaction`
with `chat_id: 803364676`, `message_id: 114945`,
`reaction: [{ type: 'emoji', emoji: '🙏' }]` returned HTTP 200,
`ok: true`, `result: true`. Recipient-side confirmation received 2026-11-06 09:41 UTC:
"🙏 appears on Huth Sakda's exact 'Test' message." → PASS.
No webhook, subscription or deployed code change. Messenger and Telegram allowlists stay separate.

## Telegram confirmed set (recipient-side, Huth Sakda private chat, message 114945)
| Emoji | Exact code points | Provider response | Recipient-side confirmation | Verdict |
|---|---|---|---|---|
| ❤ | U+2764 | HTTP 200, ok:true | confirmed on phone (earlier round) | PASS |
| 👍 | U+1F44D | HTTP 200, ok:true | confirmed replaced ❤ | PASS |
| (removal) | empty reaction list | HTTP 200, ok:true | confirmed badge disappeared | PASS |
| 🙏 | U+1F64F | HTTP 200, ok:true, result:true | confirmed on exact message, 2026-11-06 09:41 UTC | PASS |

## Implementation verification (2026-11-06)
- Picker (desktop): Messenger conversation shows exactly ❤ 👍 😆 😮 😢 😠 🙏 (7); Telegram conversation shows exactly ❤ 👍 🙏 (3).
- Picker (mobile 390x844, touch): the visible react button opens the 7-emoji Messenger picker; holding a customer bubble opens the same 7-emoji picker.
- Server (deployed message-reaction, staff session):
  - Telegram message + 😆 → 400 "That reaction is not verified on this channel"
  - Messenger message + 🎉 → 400 same
  - Messenger message + removal (null) → 400 same
  - Messenger message + 😆 (window expired) → 400 "Reactions are only verified on Explorer by SL Messenger at present" (allowlist passed, later check blocked)
  - Telegram message + 🙏 (no stored provider id) → 400 "This older Telegram message has no verified message ID..." (allowlist passed, later check blocked)
- Platform, Page and customer are taken from the stored message row; the request body carries only message_id and emoji.
- 59 unit tests pass; build OK; the three reaction files are lint-clean.
- Nothing published. Business libraries untouched.
