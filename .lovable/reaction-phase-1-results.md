# Reaction capability test — closed without Phase 2 implementation

Recorded: 2026-11-06, 14:40 GMT+7.

## Completed 3×4 result matrix

PASS requires actual incoming event evidence or recipient-side confirmation, not merely a provider-accepted request. UNTESTED means evidence is insufficient; it does not mean the provider rejected the capability.

| Channel | A: customer adds → app receives | B: customer changes/removes → app receives | C: staff adds → recipient sees | D: staff changes/removes → recipient sees |
|---|---|---|---|---|
| Telegram, private chat | UNTESTED | UNTESTED | PASS — supplied screenshot shows bot heart on Test message | UNTESTED |
| Explorer by SL Messenger | UNTESTED — no reaction events in currently retained diagnostic rows | UNTESTED | UNTESTED — earlier emoji request accepted; recipient evidence not supplied | UNTESTED |
| Travel Agency Messenger | UNTESTED | UNTESTED | UNTESTED | UNTESTED |

Earlier Messenger request using `reaction: "love"` was rejected (error 100/2018468): FAIL for that exact request. A separately accepted emoji-heart request does not erase this rejection or prove recipient appearance/change/removal.

## Stop condition
- Travel Agency / Steven Ly last customer message: 2026-11-05 13:01:34.959 GMT+7. Its 24-hour window expired at 2026-11-06 13:01:34.959 GMT+7.
- Explorer by SL / Huth Sakda last customer message: 2026-11-06 14:13:01.524 GMT+7, window still open at inspection.
- Stopped all additional reaction tests. No new reaction or ordinary message was sent during this closeout.
- Telegram registration secret remains unverifiable; no subscription change made. Actual private-chat incoming reaction updates have not been proved. Screenshot of a customer heart in Telegram is not incoming webhook evidence.

## Restoration and cleanup
- Explorer by SL Page had the six original subscriptions plus temporary `message_reactions`. Restored using the existing subscribe-page action, whose field list was read before calling; subsequent subscription-status returned exactly the original six fields.
- Travel Agency Page already had exactly the original six fields, verified by subscription-status; no write required.
- Original fields on both: `messages`, `messaging_postbacks`, `messaging_referrals`, `message_reads`, `messaging_handovers`, `message_echoes`. No existing fields removed; no permanent reaction subscription remains.
- Telegram webhook-info still reports the original URL, no allowed_updates field, max_connections 40. No setWebhook call, URL/secret modification or pending-update drop occurred.
- Removed both temporary Telegram probe blocks from source and redeployed `telegram-bot` successfully at approximately 14:39 GMT+7. Submission SHA-256: `6d2021fde59f8e3de55b89f208aa16b04fab55c89ae1a5b0439fbdf669f0e1dc`. Live health check returned 200 and running status. Deployed-code identity is supported by deployment acknowledgement, not an independent remote source read.
- Deleted only diagnostic row `0455397c-82fb-415a-be29-62e9fb27e54c`, guarded by stage and test message ID. Fresh read confirmed zero `reaction_probe` rows. No customer message deleted.
- An attempted read with the available system token was rejected (401/190); no change occurred. Existing Page-token-backed subscription-status/subscribe-page actions succeeded; no token rotation or new credential provisioning.
- Existing 45 unit tests passed; harness latest build OK at 14:39:30 GMT+7. Telegram Deno runner found no test modules; no function unit-test pass claimed.

## Exact changes this closeout
- `supabase/functions/telegram-bot/index.ts`: removal of temporary probe action/logging only; deployed because backend is shared.
- `roadmap.md`: separate approval gate and test/restoration status.
- `.lovable/reaction-phase-1-results.md`: this evidence report.
- Approved plan archived in `.lovable/plan/message-reactions-desktop-hover-and-mobile-long-press-2026-11-06.md`.
- Project memory records interaction preferences and separate Phase 2 approval requirement.

No reaction UI, migration, permanent reaction function/subscription, sending behavior change or publication was performed.

## Channel-specific proposal and approval boundary
- Telegram: propose outgoing-only controls for new messages with reliable IDs, initially only recipient-confirmed add behavior. Change/removal needs recipient verification before inclusion. No incoming reaction badges promised for private chats.
- Explorer by SL Messenger: withhold permanent send/receive controls pending receiving-side add/change/remove confirmation and exact incoming event evidence.
- Travel Agency Messenger: withhold controls pending a fresh customer message reopening its window and a separately authorized capability test.
- These are proposals, not implementation approval. Stop here for the user's exact channel-by-channel decision. Full two-way support is not established.