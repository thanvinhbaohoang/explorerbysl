/**
 * Fetch all rows from a Supabase query by paginating in fixed-size pages.
 * Works around the PostgREST default max-rows cap (1000) for bulk exports.
 */
export async function fetchAllRows<T>(
  buildQuery: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  opts?: { pageSize?: number; onProgress?: (loaded: number) => void; hardCap?: number }
): Promise<T[]> {
  const pageSize = opts?.pageSize ?? 1000;
  const hardCap = opts?.hardCap ?? 500_000;
  const all: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    opts?.onProgress?.(all.length);

    if (rows.length < pageSize) break;
    if (all.length >= hardCap) {
      throw new Error(`fetchAllRows exceeded hard cap of ${hardCap} rows`);
    }
    from += pageSize;
  }

  return all;
}
