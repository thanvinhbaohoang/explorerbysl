

## Summary for the user

- File was **never uploaded** to our storage. The size check happens in-memory before upload, so nothing is in the bucket.
- 50 MB is a **hardcoded constant** in `messenger-webhook/index.ts` and `telegram-bot/index.ts`, not an actual storage limit.
- The bucket has no size cap configured; the real ceiling is the Lovable Cloud (Supabase) plan tier.

## Plan: raise the upload ceiling

### 1. Bump `MAX_UPLOAD_SIZE` in both edge functions

- `supabase/functions/messenger-webhook/index.ts` — change `50 * 1024 * 1024` to the new ceiling
- `supabase/functions/telegram-bot/index.ts` — same

**Important Telegram caveat**: The Telegram **Bot API itself caps file downloads at 20 MB** regardless of our limit. Files larger than 20 MB sent through a bot return an error from `getFile`. This limit is on Telegram's side and cannot be bypassed without using the MTProto API (not possible from an edge function). So Telegram uploads will effectively still cap at ~20 MB no matter what we set.

Messenger has no such bot-side cap — it'll work up to whatever Facebook itself accepts (~25 MB images, ~25 MB files via Send API on their end, but inbound attachments from users can be larger).

### 2. Optionally enforce at the bucket level

Set `file_size_limit` on the `chat-attachments` bucket via migration so direct uploads from the frontend (voice clips, staff-attached files) are also bounded:

```sql
UPDATE storage.buckets SET file_size_limit = <new_limit_bytes> WHERE id = 'chat-attachments';
```

### 3. Update frontend copy in `ChatPanel.tsx`

The tooltip currently says "50 MB Supabase storage limit" — update to the new number.

### Recommended ceiling

- **100 MB**: safe headroom, well within free tier per-file allowance, covers 99% of customer PDFs/videos.
- **500 MB**: requires Supabase Pro on the Cloud project; good for large video files.
- **5 GB**: hard ceiling on Supabase Pro.

### Decision needed from you

What number should I set? And do you want me to also apply it to the bucket itself (option 2)?

I'd recommend **100 MB** as a sensible default — it's 2× your test file, doesn't require any plan upgrade, and avoids edge cases with very large videos hitting edge-function memory/timeout limits (edge functions have ~256 MB RAM and 150s wall time).

