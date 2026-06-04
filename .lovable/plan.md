## Why your new traffic isn't showing

Your test **did** land in the database — lead `5e4ad7c1…` (messenger_ref `HAROLDTESTING`, user_id `acd24eb7…`) was created at 21:46:16 UTC and the Telegram bot successfully linked it to your customer. So the capture pipeline is healthy.

The reason it isn't on the `/traffic` page in your browser:

- `useTrafficData` in `src/hooks/useTrafficData.ts` uses React Query with `staleTime: 5 * 60 * 1000` (5 minutes) and no realtime subscription / no `refetchOnWindowFocus`.
- You loaded `/traffic` before the test, so React Query is serving the cached page. It will not refetch until 5 minutes pass or the page is hard-reloaded.

A manual refresh of the browser tab right now will already show the row. The plan below fixes it so you never have to.

## Plan

1. **Add a Postgres realtime subscription** to `telegram_leads` inside `useTrafficData` (and `useTrafficFilterOptions`):
   - Subscribe to `INSERT` and `UPDATE` events on `public.telegram_leads`.
   - On any event, call `queryClient.invalidateQueries({ queryKey: ["traffic"] })` and `["traffic-filter-options"]`.
   - Clean up the channel on unmount.

2. **Enable realtime on the table** via a migration:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_leads;
   ```
   (No-op if already added.)

3. **Tighten freshness defaults** on the traffic query:
   - Drop `staleTime` from 5 min to 30 s.
   - Add `refetchOnWindowFocus: true` so switching back to the tab also refreshes.

4. **Add a manual "Refresh" button** next to the existing filters in `Traffic.tsx` that calls `refetch()` — useful belt-and-suspenders for the admin.

No changes to the capture pipeline, edge functions, or RLS — those are all working.

### Files touched
- `src/hooks/useTrafficData.ts` — realtime channel + lower staleTime + refetchOnWindowFocus
- `src/pages/Traffic.tsx` — small Refresh button
- New migration enabling realtime on `telegram_leads`
