# Message Reactions — separate partial-scope approval

## Status
The current feature is partial and was implemented before the required capability gate was completed. It is not complete or safe to publish. The audit is recorded in `.lovable/message-reactions-release-audit.md`.

## Capability matrix
| Channel | Customer add | Customer change/remove | Staff add | Staff change/remove |
|---|---|---|---|---|
| Telegram private chat | UNTESTED | UNTESTED | PASS | PASS |
| Explorer by SL Messenger | UNTESTED | UNTESTED | PASS: heart | UNTESTED |
| Travel Agency Messenger | UNTESTED | UNTESTED | UNTESTED | UNTESTED |

## Exact partial feature proposed for approval
- Telegram outbound-only heart/thumbs-up add, change and removal on new individually identified customer messages.
- Explorer by SL Messenger outbound heart-add only, inside its reply window.
- Desktop hover/focus picker, mobile long press and accessible touch button.
- Exact-message Team badges persisted only after provider acceptance; receiving-side evidence remains required for capability claims.
- No incoming customer reactions, Travel reactions, Messenger change/removal, album reactions, guessed historical IDs or new subscriptions.
- Keep the current partial Preview feature pending your decision; do not publish.

## Unresolved prerequisites
Approval of this partial scope is not a release approval. Provider-origin authentication, lease expiry/reconciliation risks, deep security review and genuine new-message Telegram end-to-end verification remain unresolved. Full two-way testing requires coordinated incoming reactions and safe subscription authorization; Travel requires a fresh inbound message and approved recipient testing.

## Technical boundaries
Existing shared migrations and deployed sending/Telegram ID-capture functions remain in place. This audit corrected only Preview eligibility, loading-failure visibility and long-press handling. Any further backend change requires a separately described corrective scope.