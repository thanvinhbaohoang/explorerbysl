## Fix: read System User token from `bot_settings`, not env

### Root cause
`/system` saves the token to `bot_settings.facebook_system_user_token`. `messenger-webhook` reads DB-first (correct). `backfill-profile-pics` only reads `Deno.env.get("FACEBOOK_SYSTEM_USER_TOKEN")` — so the Refresh button keeps using the stale env-var secret instead of the token you updated in the UI.

### Change

**`supabase/functions/backfill-profile-pics/index.ts`**

1. Remove the module-level `const SYSTEM_USER_TOKEN = Deno.env.get(...)`.
2. Add `async function getSystemUserToken(): Promise<{ token: string | null; source: 'db' | 'env' | null }>`:
   - `SELECT value FROM bot_settings WHERE key = 'facebook_system_user_token'`. If non-empty → return `{ token, source: 'db' }`.
   - Else fall back to `Deno.env.get("FACEBOOK_SYSTEM_USER_TOKEN")` → `{ token, source: 'env' }` (or `null`).
3. `refreshSingleCustomer`: call `getSystemUserToken()` at the top; use the returned token everywhere `SYSTEM_USER_TOKEN` is referenced; include `token_source` (`'db' | 'env'`) and token length/prefix/suffix in the log line + the JSON response so the toast makes it visible which one was used.
4. Bulk Messenger branch in `backfillProfilePics`: same — fetch the token once at the start of the run and use it.

### Out of scope
- No frontend changes; the existing toast/logging will now show `token_source` automatically.
- No schema or secret changes.