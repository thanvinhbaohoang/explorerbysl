# Final publish-safety audit: Saved Voice Messages (read-only)

No code edits, data changes, test messages, migrations or publishing. The only writes: report and screenshots saved to Files.

## 1. Recipient-side checks
- Record Telegram, Explorer by SL Messenger and Explorer Travel Agency Messenger as **user-confirmed** (voice-style appearance and playback). I will not claim I inspected the receiving phones myself.

## 2. Changed scope: Preview vs published (app.explorerbysl.com)
- List every changed source file since the last published version, with a one-line purpose for each. Flag anything not related to Saved Voice.
- Migrations 0004, 0005, 0006: read the live definitions (table, RPCs, grants, RLS, storage policies).
- `saved-voice-media` bucket: private, 5 MB limit, policies.
- Deployed functions: confirm only `telegram-bot` changed. Diff it to show that `strict_voice` affects only the Saved Voice path, and that the normal voice fallback and text, photo and video paths are byte-identical.
- Regression review by diff: normal voice recording, Saved Replies, inbox filters, auth, customer data, existing send paths.

## 3. Security (read-only queries plus scans)
- Permission matrix, checked through privilege and policy inspection and existing evidence: approved staff can read and use; only the creator or an admin can edit or delete; signed-out users are denied; direct table writes are blocked; `use_count` can't be tampered with; storage path prefix is validated; no cross-tenant reads (single organization, so this will be noted as not applicable).
- Run the security scan and linter. Split findings into new and pre-existing. Any new exploitable Saved Voice or customer-data finding blocks release.

## 4. Feature behavior
- Use existing test evidence for: file-content validation, 5 MB and 1–120 s limits, MP3 conversion and playback, search, draft replacement, no automatic send, one send per click, keeping the draft on failure for retry, Messenger 24-hour window, mobile layout.
- Mark each item "rerun" or "prior evidence only". No new sends.

## 5. Static checks (exact commands and results)
- `bun run test` (full suite)
- Fresh production build via the build harness log, plus a TypeScript check
- Focused eslint on the Saved Voice files, compared against the baseline

## 6. Leftovers
- Zero test `saved_voices` rows, zero objects in `saved-voice-media` from tests, no cleanup items.
- Confirm the four delivered test messages are the only intentional external test artifacts.

## 7. Saved Replies preservation (read-only)
- Record the current live count; earlier it was 56.
- Fingerprint text, keywords, creator, ordered image rows, storage object metadata and file bytes. Compare against the last captured baseline.
- Report usage-count changes and new staff-created replies separately. Never overwrite live activity.

## 8. Output
- Short pass/fail table with evidence and limitations.
- Exactly one verdict: SAFE TO PUBLISH, or NOT SAFE TO PUBLISH with precise blockers and the smallest fixes.
- No automatic publish. I wait for your approval.
