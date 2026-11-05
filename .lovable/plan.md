# Fix: Saved Reply thumbnail recovery (plus concurrency check)

## Scope
Change only `src/components/SavedReplyThumbnail.tsx`, plus one small unit-test file for the retry logic. Nothing else changes: sending, integrations, sign-in, inbox filters, database structure, migrations, and business replies all stay as they are. Nothing gets published.

## The defect
- Today, a failed image load triggers one silent `refetch()`. If the signed URL comes back the same (it is cached, or identical), the `<img>` never makes a new request. The thumbnail then gets stuck on the placeholder, and there is no way to recover.

## Change
1. State is `failed` (boolean) and `nonce` (number). Both reset when `path` changes, so the existing reset behavior stays.
2. `onError` only sets `failed = true`. The automatic refetch is removed, so no retry loop can happen.
3. When `failed` is true, the current placeholder icon stays visible. A small overlay button appears next to it:
   - It is a `<button type="button">` with `aria-label="Retry loading picture"` and a `RotateCw` icon.
   - It uses `stopPropagation`, so clicking it does not select the reply.
4. The Retry handler:
   - Increments `nonce`.
   - Clears `failed`.
   - Calls `queryClient.invalidateQueries({ queryKey: thumbKey(path) })` to get a fresh signed URL.
5. The image source is `url` when `nonce === 0`. Otherwise it is `url + (url.includes("?") ? "&" : "?") + "r=" + nonce`, and `key={nonce}` remounts the `<img>`. This forces a new network request even when the signed URL is identical.
6. If Retry fails again, `onError` sets `failed` again. The placeholder and the Retry button come back. There is no automatic attempt.
7. Normal loading is unchanged:
   - 600-second (10-minute) signed URL.
   - 8-minute stale time and 10-minute cache time.
   - The query key is still `thumbKey(path)`.
   - The query retries once on non-missing errors.
   - The image loads only once it is visible on screen.

## Verification (Playwright, signed in, test reply `zz-test-multipic-DELETE-ME` only)
- Create the temporary reply with 1–4 pictures through the UI.
- Route the first storage-object GET for its thumbnail to 404. Check that:
  - The placeholder shows.
  - The button is found by its accessible name "Retry loading picture".
- Remove the 404 route and press Retry. Check that:
  - A second image request with `r=1` appears in the request log.
  - The response is 200.
  - `naturalWidth` is greater than 0.
- Run all of this on desktop (1280x1800) and on mobile (390x844), with screenshots of each step.
- Normal-load check: open the panel, wait about 10 seconds, scroll, and close and reopen it within 8 minutes. Count signing requests and image requests per path. The expected count is one each, with no repeats.

## Concurrency check (two separate database connections)
- Connection A: `BEGIN; SELECT ... FROM saved_replies WHERE id = test FOR UPDATE; pg_sleep(2); COMMIT;`
- Connection B starts about 0.3 seconds after A. It runs the `update_saved_reply` RPC through the authenticated client, with an 8-second statement timeout.
- Record the start and end time of each connection. This should show that B waits for A's commit and then succeeds.
- Then check:
  - Text and pictures match B's payload, so no update was lost.
  - Picture positions are continuous starting from 0.
  - The legacy picture columns equal the position-0 picture.
  - The cleanup queue holds only the test reply's own entries, which get drained.
- If two real connections can't be opened from the sandbox (only one SQL runner is available), report it as a deviation rather than claiming a pass.

## Cleanup and final checks
- Delete the test reply through the UI, then drain its own queue entries. Confirm that zero test rows, pictures, and storage objects remain.
- Run all unit tests: the 37 existing tests plus the new retry test.
- Run focused lint on the changed files.
- Confirm the harness build log shows "build OK", which covers the production build and the TypeScript check.
- Reconfirm the fingerprints for the 42 business replies:
  - Text/content
  - Child pictures
  - Storage metadata
  - File bytes (download and hash)
- Report screenshots, network and timing evidence, and a SAFE or NOT SAFE TO PUBLISH verdict. Do not publish.
