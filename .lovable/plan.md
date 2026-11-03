# Publish-safety audit: inbox filters (All / Unread / Not Replied)

Test-and-report only. No code edits, no migrations, no data changes, no publishing, no session minting, no messages sent or marked read.

## Steps
1. **Changeset review** — list changed files and the filter migration; diff against pre-feature versions; flag anything outside the expected scope (ChatConversationList, useCustomersData, Chat page, generated types, one additive migration).
2. **All-tab equivalence** — line-by-line evidence that `filter === "all"` uses the original query, 6-element cache key, count, ordering, pagination, prefetch, page-one refresh, badges, previews, loading and realtime toasts; RPC not called.
3. **Filter definitions** — confirm Unread / Not Replied SQL semantics and deterministic latest-message ordering (timestamp, created_at, id DESC); trace mark-read and reply flows for membership changes.
4. **Migration audit** — read deployed function definition and grants from the database catalog (read-only): SECURITY INVOKER, no writes, revoked from PUBLIC/anon, granted to authenticated, input validation, limit clamp, offset floor, always-shaped JSON, ordering before LIMIT/OFFSET, index additive. Anon/unapproved access checked via policy and privilege analysis only.
5. **RPC correctness (read-only SQL)** — compare RPC output to independent queries: totals, page 1 and a later page for both filters, duplicate checks, stable ordering, out-of-range offset, no-match search, invalid filter, oversized limit, negative offset, platform and Messenger-disabled parity with All. EXPLAIN ANALYZE both filters.
6. **Client data handling** — review cache keys, targeted invalidation, prefetch keys, dependency arrays, error handling (malformed JSON, missing fields), error state text and retry, placeholder flashing, zero-total page reset, loop risk.
7. **UI review** — code inspection plus signed-out-safe rendering where possible; labels, defaults, page reset, tokens, accessibility, empty states, mobile Back persistence, narrow/desktop overflow. Signed-in rendering not possible without a session.
8. **Static verification** — production build, TypeScript check, existing tests, lint; separate pre-existing from new issues; confirm generated types include the RPC.
9. **Manual test status** — mark signed-in checklist as MANUAL VERIFICATION REQUIRED (no authorized session).
10. **Rollback review** — frontend revert path; additive RPC/index remain harmless; history restore does not revert database.

## Output
Structured 13-section report ending with exactly one verdict. Expected unless a defect is found: "AUTOMATED CHECKS PASSED — MANUAL SIGNED-IN TEST REQUIRED". Any discovered problem is reported, not fixed.

## Technical notes
Build/tsc/lint runs only write to temp/build output, not project source. Database access limited to SELECT, catalog reads, and EXPLAIN ANALYZE on read-only statements.
