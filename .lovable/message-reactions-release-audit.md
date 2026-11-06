# Message Reactions release audit — 2026-11-06

## Verdict
NOT COMPLETE. NOT SAFE TO PUBLISH. No publication occurred. Full two-way support on all three channels is not established. Stop for exact partial-scope approval.

## Shared backend already changed in the preceding implementation turn
- Applied `drizzle/migrations/0009_confirmed_message_reactions.sql`: public reaction table, message/customer references, actor/emoji/audit/lease fields, unique message+actor key, customer index, staff read policy, service-only claim/finish RPCs, realtime publication membership.
- Applied `0010_message_reactions_staff_read_only.sql`: removed anonymous/client write grants; authenticated SELECT with approved-role policy; service access retained.
- Deployed new `message-reaction`: JWT and approved-role validation; exact database-row lookup; Telegram heart/thumbs-up/removal; Explorer by SL Messenger heart only; active Page and server-side 24-hour check; server-resolved recipients/credentials; lease and provider-confirmed persistence.
- Deployed `telegram-bot`: six incoming insert paths now capture actual Telegram message IDs; outgoing text/media/albums capture returned IDs. Ordinary provider send choices and strict Saved Voice behavior were retained.
- Last deployment acknowledgements: message-reaction SHA-256 `272642c8b6b83101918c5751f875340374a068017a413d9f6f6c83d9a0ac6e6f`; telegram-bot `601b38dabe00ab7efadcfc45c5a18147e76dd459ba102e3ec6ac36f70bc1ed31`. These are submission acknowledgements, not an independent remote source download.
- Current database has one staff heart for Huth Sakda's Explorer message `248b5e8d-72ea-4a90-ae74-b6ab38f818b5`, provider MID `m_HFvBBTjLcWMD0EzEEM4ZKPpTTJLtw6WDp_TOK0H2qfSXAMq7svcUv0--YUnqA6Bu-XeJX75OJbay53ah07Q2hA`. It was persisted after a provider-successful call, not fabricated locally; lease is cleared. It is preserved rather than deleting genuine confirmed state.
- No permanent incoming reaction handler, new provider subscription, Messenger webhook deployment, authentication setting change or publication accompanied that turn.

## Preview changes
- Added helper/tests, conversation-scoped reaction query/live updates and picker/badge component.
- ChatPanel wraps single messages; Message typing includes optional Telegram provider ID.
- Desktop hover/focus button, mobile 500ms hold and touch alternative; staff badges below exact messages.
- Albums are excluded. Older Telegram rows without IDs are excluded. No customer reactions are displayed because none are ingested.
- Documentation rules/roadmap and generated database types changed.

## Completed evidence inventory: 3×4 matrix
PASS requires recipient confirmation for outbound and actual provider event evidence for inbound. UNTESTED means missing evidence, not an API rejection.

| Channel | Customer add → app | Customer change/remove → app | Staff add → recipient | Staff change/remove → recipient |
|---|---|---|---|---|
| Telegram private chat, Huth Sakda | UNTESTED | UNTESTED | PASS | PASS |
| Explorer by SL Messenger, Huth Sakda | UNTESTED | UNTESTED | PASS, heart only | UNTESTED |
| Travel Agency Messenger | UNTESTED | UNTESTED | UNTESTED | UNTESTED |

- Telegram target: Test, provider message ID 114945. Staff heart was accepted and shown in the user's supplied phone screenshot. Change to thumbs-up returned HTTP 200/ok:true, recipient confirmed at 14:44 GMT+7. Removal returned HTTP 200/ok:true around 14:59; user confirmed disappearance at 15:00.
- Explorer target: customer Hello test at 14:13:01.524 GMT+7, internal/provider IDs above. Heart request returned HTTP 200, no provider error; user explicitly confirmed receiving-side appearance at 15:03 GMT+7. Later app action returned success and exact badge read-back. No customer reaction payload or change/remove recipient evidence exists.
- Earlier Messenger `reaction: "love"` request: FAIL for that exact payload, error 100/2018468. The separately verified Unicode-heart payload is distinct and does not erase that failure.
- Retained Messenger diagnostic search has zero reaction payloads. The supplied current logs contain ordinary photo messages, not reaction events. A phone screenshot of a customer Telegram heart is not evidence of a delivered incoming update.
- Travel Agency approved test recipient Steven Ly last inbound was 2026-11-05 13:01:34.959 GMT+7; window expired 2026-11-06 13:01:34.959. No send test was attempted. The latest renewed testing restriction also excluded that recipient.
- No additional recipient-confirmed matrix cells can honestly be supplied without coordinated customer actions, safe subscriptions and the appropriate approved internal test scope.

## Restoration verified during this audit
- Both Messenger Pages return exactly original fields: messages, messaging_postbacks, messaging_referrals, message_reads, messaging_handovers, message_echoes. Neither includes message_reactions.
- Telegram registration still points at the original function, max_connections 40, pending updates 0, no explicit allowed_updates field. Secret cannot be established from getWebhookInfo; no registration write occurred.
- Telegram source contains no reaction_probe blocks; database reaction_probe diagnostic rows: 0.
- No temporary subscription or test code was installed during this audit. Browser interception was local only. There is nothing additional to restore. The permanent partial feature is not silently treated as temporary or removed without authorization.

## Narrow corrections in this audit (Preview only)
- Restrict Messenger controls to the verified Explorer Page and an unexpired exact-customer message window. Unknown/Travel Pages fail closed.
- Require positive safe-integer Telegram IDs.
- Hide controls while reaction state is loading or failed; add visible loading-error Retry; refuse mutation while state is unknown.
- Prevent completed long press from swallowing a subsequent picker click; cancel timers on touch movement/release/cancel/leave.
- Added three concrete eligibility tests. No backend deployment, migration or subscription write during this audit.

## Checks
- 54/54 Vitest tests pass, including 9 reaction helper rules; focused lint clean.
- Latest harness build entry: build OK at 08:16:52 UTC. No separate manual production build or TypeScript command was run, per the environment's harness-only restriction; do not represent these as independent fresh passes.
- Edge test runner: no test modules found (not a PASS).
- Signed-in Chromium: Enter opens picker; Escape dismisses; forced rejected request retains previous confirmed badge; rapid double-click makes one intercepted invocation; touch movement cancels hold; long press opens and subsequent selection is not swallowed; no runtime errors.
- All reaction mutations during browser audit were intercepted with a forced error. Zero real provider sends during this audit.
- Unknown/Travel eligibility unit tests pass. Browser navigation to Steven Ly did not render the target conversation, so its empty-screen control count is NOT an end-to-end PASS.
- Saved Replies and Saved Voice browsing preserves a typed unsent draft. Cleanup claims intercepted to protect existing library media; no business selection or usage increment. Send code path reviewed, not re-sent. Full recipient delivery regressions NOT re-run.
- Live malformed/forged request: 400. Invalid token: 401. Unsupported Explorer removal: 400. Client table INSERT/UPDATE/DELETE and claim/finish EXECUTE all false; anonymous SELECT false. Actual unapproved-account JWT test not run, so not claimed verified.
- Preservation: 56 replies fingerprint c58ed7454de573ac071469c74cc09b5b; 82 picture rows 33b61f80432079d1f69a4234a6d68e3d; 7 voices b259413751c258ff99e53176bbf19c3c. Exact row fingerprints unchanged before/after. No media objects were uploaded/deleted; independent binary storage fingerprint check not run.

## Outstanding audit risks
- No two-way provider event ingest on any channel. No verified Travel direction. No verified Messenger change/remove.
- Telegram existing webhook does not authenticate provider origin, so captured IDs alone cannot independently prove authenticity. Existing Messenger webhook also accepts unsigned requests and logs secret fragments. Do not reproduce those fragments. These are release-relevant pre-existing risks, not corrected under this narrow audit.
- A provider fetch can outlast its 90-second lease; an expired lease does not fence external writes. Provider-rejection lease-release errors are unchecked. Accepted-but-unsaved/ambiguous results have no provider-state reconciliation; badges can become stale. These remain explicit blockers, not silently expanded fixes.
- Messenger suffix rejection is heuristic and may hide a legitimate MID. Albums are entirely withheld rather than falsely claiming exact-item reactions.
- Basic accessibility verified; removal-specific accessible label is not present. No DOM/unit suite for hooks or edge behavior; browser forced failures do not establish genuine provider rejection/lease release.

## Security
Quick database scan: 10 existing findings, eight errors and two warnings; none names the new reaction table. Errors cover customer_action_items, customer_notes, customer_summaries, fb_contacts, fb_messages, messages, roles and telegram_leads access rules. Warnings: bot_settings broad authenticated reading and leaked-password protection disabled. None ignored or marked fixed.
Deep code security scan started before corrections and remains pending; it scans the last saved snapshot, so these Preview corrections are not certified by that pending scan.

## Proposed exact partial scope, not approved
Telegram outbound only: heart/thumbs-up/add/change/remove on new, individually identified customer messages. Explorer by SL Messenger outbound heart-add only. Exact-message Team badges only after provider success. No incoming customer badges, Travel reactions, Messenger change/remove, albums, historical ID guesses, subscription changes or automatic publication. Remaining security/lease risks and final genuine end-to-end checks must be addressed separately before any release verdict.