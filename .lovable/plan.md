

## Diagnosis

For all 3 PDFs from AIRSTAY HOTEL (`db9eb533-…`), the DB row has:
- `message_type = 'document'`
- `document_name = '1111.pdf'`
- `document_mime_type = 'application/pdf'`
- **`document_url = NULL`** ← the cause

The webhook code at `messenger-webhook/index.ts:665-674` does:
```ts
const storedUrl = await downloadAndStoreFile(attachment.payload.url, 'photo');
attDocumentUrl = storedUrl || attachment.payload.url;
```

So `document_url` is null only if **both** the Supabase upload AND the original Facebook CDN URL failed/were absent. In practice this means `downloadAndStoreFile` threw or the storage upload returned an error — most likely the **50 MB Supabase free-tier limit** since it's the only common failure mode for PDFs that doesn't surface to the user.

There are also two secondary bugs in that block:
1. `attDocumentMimeType` is **hardcoded to `'application/octet-stream'`**, ignoring `attachment.payload.mime_type` from FB. That's why even when it works, the chip shows generic "File".
2. The download is logged as `'photo'` folder, so PDFs end up in `messenger-photo/...bin`. Cosmetic but messy.

## Fix Plan

### 1. DB migration — add `document_size` column to `messages`
```
ALTER TABLE messages ADD COLUMN document_size bigint;
```
(nullable, no default — historical rows stay null)

### 2. `supabase/functions/messenger-webhook/index.ts`

**a.** Extend `downloadAndStoreFile` to accept a `'document'` type, capture file size, and **detect oversize before uploading** (>50 MB → return a structured `{ error: 'too_large', size }` instead of null). Also preserve the original filename extension for documents.

**b.** In the `attachment.type === 'file'` branch:
- Use `attachment.payload.mime_type` if present (fallback `application/octet-stream`).
- Capture the file size from `Content-Length` header during download.
- If upload failed because the file is too large, store `document_url = NULL` and set `message_text = '[Document too large to store: 1111.pdf (62.4 MB)]'` and a new column `document_size`.
- Otherwise store the size alongside the URL.

### 3. `src/integrations/supabase/types.ts` will auto-regenerate to include `document_size`.

### 4. `src/components/ChatPanel.tsx` (document bubble around line 706)
- Show formatted size next to mime type: `PDF · 2.3 MB`.
- If `document_url` is null:
  - Show a disabled bubble with an alert icon
  - Caption: "File too large to download" (when `document_size > 50 MB`) or "File unavailable" (otherwise)
  - Tooltip: explains 50 MB Supabase limit and to ask the customer to share via another method.

### 5. Backfill (optional, runtime check)
Add an admin "Retry document download" action later if needed — out of scope for this fix.

## Files touched
- `supabase/migrations/<new>.sql` — add `document_size` column
- `supabase/functions/messenger-webhook/index.ts` — fix mime type, capture size, handle oversize
- `src/components/ChatPanel.tsx` — render size + unavailable state
- `src/hooks/useChatMessages.ts` — add `document_size` to `Message` interface

No frontend behavior change for working documents beyond showing the size.

