# Remove the 1,000-row cap on CSV exports

## Why it happens today
Both export buttons run a single Supabase select:

- `src/pages/Traffic.tsx` → `supabase.from('telegram_leads').select(...).order(...)`
- `src/pages/Customers.tsx` → `supabase.from('customer').select(...).order(...)`

Supabase's Data API caps each response at **1,000 rows by default**, so anything beyond row 1,000 is silently dropped. The CSV utility itself has no limit.

## Plan
Add a small client-side pagination helper and use it from both export buttons. No backend or schema changes.

### 1. New helper: `src/lib/fetch-all-rows.ts`
Generic loop that fetches a Supabase query in 1,000-row pages using `.range(from, to)` until a short page comes back. Signature:

```ts
fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  opts?: { pageSize?: number; onProgress?: (loaded: number) => void }
): Promise<T[]>
```

- Default `pageSize = 1000`.
- Stops when a page returns fewer rows than `pageSize` or `null`.
- Hard safety cap (e.g. 500,000 rows) to avoid runaway loops; logs and throws if exceeded.
- Propagates the first Supabase error.

### 2. Wire it into the two export buttons
- **Traffic export** — replace the single `select` with `fetchAllRows((from,to) => baseQuery.range(from,to))`, keeping the existing filters/joins. Update the toast to show progress: `Exporting… {n} rows so far`.
- **Customers export** — same treatment on the `customer` query.

### 3. UX details
- Disable the Export button while running so it can't be double-clicked.
- Replace the final toast with the true row count returned by `fetchAllRows`.
- No change to column definitions or CSV formatting.

## Out of scope
- No edge function. Pagination is cheap from the browser and avoids new infra.
- No new permissions or RLS changes — existing policies already allow these reads.
- No streaming/zip; CSVs of a few hundred thousand rows are fine in a Blob. If a future table grows past that, we can move to an edge function + Supabase Storage download link.

## Verification
- Seed/confirm >1,000 rows in `telegram_leads`, click **Export CSV** → downloaded file row count matches the on-screen total and exceeds 1,000.
- Same check on Customers export.
- Trigger an error mid-export (e.g. drop network) → toast shows failure, button re-enables.
