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
| 😠 | U+1F620 | HTTP 200 | awaiting phone confirmation | PENDING |
| 🙏 | U+1F64F | — | not started | PENDING |

Telegram 🙏 test: not started. Messenger and Telegram allowlists stay separate.
