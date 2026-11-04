# Saved Replies for the Chat Composer — Implementation Plan

Selecting a saved reply only fills the existing message box (and attachment preview). Nothing is sent until the employee presses the existing Send button. No delivery code (sendReply, sendMedia, sendMediaBatch, telegram-bot, messenger-webhook) is touched.

## 1. File-by-file change plan

| File | Change |
|---|---|
| `supabase/migrations/<ts>_add_saved_replies.sql` (new) | Table, constraints, indexes, triggers, RLS, usage function, bucket, storage policies. Additive only. |
| `src/integrations/supabase/types.ts` | Auto-regenerated after migration (not hand-edited). |
| `src/hooks/useSavedReplies.ts` (new) | Fetch, client-side search/sort, create/update/delete, image upload/replace/remove, usage tracking, invalidation, loading/error states. |
| `src/components/SavedRepliesPanel.tsx` (new) | Popover (desktop) / bottom Sheet (mobile) with search, sort, list, states, row actions. Emits `onSelect(reply)` only. |
| `src/components/SavedReplyDialog.tsx` (new) | Create/edit form (Dialog desktop, full-height Sheet mobile). |
| `src/lib/savedReplies.ts` (new) | Pure helpers: normalize shortcut/keywords, validate fields, match search, sort. Unit-testable. |
| `src/components/SavedReplyThumbnail.tsx` (new) | Lazy signed-URL thumbnail, only for visible rows. |
| `src/lib/savedReplies.test.ts`, `vitest.config.ts` (new); `package.json`, `bun.lock` | Vitest dev dep + `test` script. The project has no test runner today; tests cover the pure rules only. |
| `src/components/ChatPanel.tsx` | Add trigger button after Mic; open state; draft-replace confirmation; image-to-File resolution; populate `replyText` and call existing `processFiles`. No change to existing handlers. |

Not touched: messages, customer, existing RPCs/RLS/policies, edge functions, auth, useChatMessages, conversation filters.

## 2. Final database schema

```sql
create table public.saved_replies (
  id uuid primary key default gen_random_uuid(),   -- client supplies it on create
  shortcut text not null,
  message text not null,
  keywords text[] not null default '{}',
  image_path text, image_name text, image_mime_type text, image_size bigint,
  created_by uuid not null default auth.uid(),
  use_count bigint not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_replies_shortcut_len check (shortcut = btrim(shortcut) and char_length(shortcut) between 3 and 50),
  constraint saved_replies_message_len check (char_length(btrim(message)) >= 1 and char_length(message) <= 1000),
  constraint saved_replies_image_all_or_none check (
    (image_path is null and image_name is null and image_mime_type is null and image_size is null)
    or
    (image_path is not null and image_name is not null and image_mime_type in ('image/jpeg','image/png','image/webp')
     and image_size between 1 and 10485760)
  )
);
create unique index saved_replies_shortcut_lower_uidx on public.saved_replies (lower(shortcut));
create index saved_replies_use_count_idx  on public.saved_replies (use_count desc, id);
create index saved_replies_last_used_idx  on public.saved_replies (last_used_at desc nulls last, id);
create index saved_replies_created_idx    on public.saved_replies (created_at desc, id);
```

Trigger `saved_replies_set_updated_at` (BEFORE UPDATE): sets `updated_at = now()` only when shortcut, message, keywords or image fields change (so usage tracking doesn't bump it). No session flags, no created_by logic — protection comes from column privileges below.

### Grants (column-level)

```sql
revoke all on public.saved_replies from public, anon, authenticated;
grant select on public.saved_replies to authenticated;
grant insert (id, shortcut, message, keywords, image_path, image_name, image_mime_type, image_size)
  on public.saved_replies to authenticated;
grant update (shortcut, message, keywords, image_path, image_name, image_mime_type, image_size)
  on public.saved_replies to authenticated;
grant delete on public.saved_replies to authenticated;
grant all on public.saved_replies to service_role;
```
Result: `created_by`, `use_count`, `last_used_at`, `created_at`, `updated_at` always come from defaults/trigger and can't be written by the app.

### Usage function

```sql
create function public.record_saved_reply_use(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user')
          or public.has_role(auth.uid(),'moderator')) then
    raise exception 'not authorized';
  end if;
  update public.saved_replies
     set use_count = use_count + 1, last_used_at = now()
   where id = p_id;
end $$;
revoke all on function public.record_saved_reply_use(uuid) from public, anon;
grant execute on function public.record_saved_reply_use(uuid) to authenticated;
```
Static SQL only; touches only the two usage columns. Only path for usage updates.

## 3. Table RLS policies

```text
SELECT  : has_role admin OR user OR moderator
INSERT  : WITH CHECK (approved role) AND created_by = auth.uid()   -- default, belt-and-braces
UPDATE  : USING / WITH CHECK (approved role) AND (created_by = auth.uid() OR has_role admin)
DELETE  : USING (approved role) AND (created_by = auth.uid() OR has_role admin)
```
anon: no grants, no policies. Unapproved signed-in user: fails role check everywhere.

## 4. Storage bucket policies

Bucket `saved-reply-media`: private, 10 MB limit, allowed types JPEG/PNG/WebP.
Path: `{reply_creator_id}/{saved_reply_id}/{uuid}.{ext}` — every picture of a reply stays in the original creator's folder, including admin replacements.

```text
SELECT : bucket = saved-reply-media AND approved role
INSERT : bucket AND approved role AND ((storage.foldername(name))[1] = auth.uid()::text OR has_role admin)
UPDATE : not granted (replace = upload new object + delete old)
DELETE : bucket AND approved role AND ((storage.foldername(name))[1] = auth.uid()::text OR has_role admin)
```

### How private thumbnails are shown
- `SavedReplyThumbnail` requests a short-lived signed URL (`createSignedUrl`, 10 min) only when its row is visible (IntersectionObserver), cached in memory by path via React Query; never written to the table.
- Fallback placeholder icon on error.
- Selecting a reply always does a fresh authenticated `download()` (not the thumbnail URL); any Blob/object URL created for previews is revoked on unmount/replace.

## 5. Desktop interaction

- Order: `[Attachment] [Voice] [Saved replies] [Input] [Send]`. Same `variant="outline" size="icon"` button, `MessageSquareText` icon, Tooltip "Saved replies", `aria-label`, `aria-haspopup="dialog"`, `aria-expanded`.
- Hidden with other controls while recording / previewing voice (lives inside the "Normal input UI" branch).
- Not disabled when the 24h window is expired (browsing/management allowed).
- Popover above composer, `side="top" align="start"`, width ~420px (`max-w-[calc(100vw-2rem)]`), list `max-h-[360px]` scroll, collision-aware.
- Keyboard: arrow keys move through results, Enter selects, Esc closes; focus returns to the message box.

## 6. Mobile interaction

- Same button (no input squeeze: 40px icon like its neighbours). Opens a bottom Sheet (`h-[80dvh]`), 44px+ row targets.
- Create/edit opens a full-height sheet. Closing returns focus to the composer. Full-screen chat layout unchanged.

## 7. Draft-replacement behavior

Draft exists if `replyText.trim()` OR `selectedFiles.length` OR `recordedAudio`. (Recording-in-progress hides the button, so it can't be triggered.)
- No draft → apply immediately.
- Draft → AlertDialog "Replace the current draft?" / "This will replace the text and attachments currently in your message." [Cancel] [Replace draft]. Cancel leaves everything as-is.
- Replace: resolve image first; only on success clear `selectedFiles`, `filePreviews`, discard recorded audio via existing cancel function, then apply.

## 8. Image loading and composer flow

```text
select reply
 -> window expired? -> blocked (see 9)
 -> draft? -> confirm
 -> if image_path: storage.download (authenticated)
      fail -> toast "Couldn't load this reply's picture", nothing changed, panel stays open
      ok   -> new File([blob], image_name, { type: image_mime_type })
 -> clear draft (if replacing), setReplyText(message), processFiles([file])
 -> close panel, focus input, record_saved_reply_use (ignore errors)
 -> employee edits / removes picture / presses existing Send
```
Text is never applied without its picture when the picture fails (all-or-nothing).

## 9. Error, empty, loading, blocked states

- Loading: 4 skeleton rows (thumb + 2 lines). Search is client-side over loaded data, so no stale-results flash.
- Error: "Unable to load saved replies" + Retry. Never shown as empty.
- Empty library: "No saved replies yet" + Add new. No match: "No saved replies match your search" + Clear search.
- 24h expired: banner "Messaging is unavailable — the 24-hour Messenger window has expired." Rows still browsable/editable; "Use reply" disabled. Existing Send logic untouched.
- Dialog: inline field errors; duplicate shortcut (Postgres 23505) → "This shortcut is already in use"; RLS denial → "You don't have permission to change this reply"; upload failure → keep form open, nothing saved; Save disabled while saving.
- Row deleted by someone else: select/edit of a missing row → toast "This reply was deleted" + refetch.

## 10. Permission matrix

| Action | anon | unapproved | user / moderator | admin |
|---|---|---|---|---|
| View / use | no | no | yes | yes |
| Create | no | no | yes (own) | yes (own) |
| Edit / delete own | no | no | yes | yes |
| Edit / delete others' | no | no | no | yes |
| Upload image | no | no | own folder | any reply's creator folder |
| Delete image | no | no | own folder | any |

UI hides Edit/Delete unless `created_by === me || isAdmin`; the database enforces it regardless.

## 11. Create/edit form rules and atomic save flows

- Shortcut: trimmed, 3–50, unique ignoring case (DB index authoritative).
- Message: required after trim, ≤1000, line breaks kept, counter.
- Keywords: chip input; trim + collapse whitespace, case-insensitive dedupe, Khmer OK.
- Picture: one; JPEG/PNG/WebP; 1 byte–10 MB; checks MIME and magic bytes (FF D8 FF / 89 50 4E 47 / RIFF..WEBP); preview, Replace, Remove.
- Save button disabled from click until the whole flow finishes.

Create (atomic, no text-only leftovers):
```text
id = crypto.randomUUID()
if picture: upload to {me}/{id}/{uuid}.{ext}
   upload fails -> stop, show error, nothing in the table
insert full row {id, shortcut, message, keywords, image_*}
   insert fails -> delete the uploaded object, show error (e.g. duplicate shortcut)
success -> invalidate list
```

Edit with new picture (always in the reply creator's folder, also when an admin edits):
```text
upload to {reply.created_by}/{reply.id}/{uuid}.{ext}
update row (content + new image_*)
   update fails -> delete the new object; old picture untouched
success -> delete old object (failure only logged)
```
Remove picture: update image_* to null → then delete object. Delete reply: delete row → then delete object.

## 12. Search, sort, freshness

- Search (case-insensitive, `toLocaleLowerCase` + NFC normalize for Khmer) over shortcut, message, keywords; live; clear button.
- Sort: Frequently used (default), Recently used, Recently created, Alphabetical (`localeCompare`).
- Freshness: no new realtime channel in v1. `staleTime` 30s, refetch on panel open, invalidate after own mutations. Trade-off: another employee's edit appears next time the panel opens (or within 30s), not instantly. No effect on message channels or conversation list.

## 13. Regression checklist

Unchanged: input typing, Enter send, Shift+Enter, attachment menu, paste, drag-drop, voice record/preview, text/photo/video/document sending, Telegram + Messenger Page 1/2 delivery, 24h restriction, optimistic bubbles, history, All/Unread/Not Replied filters, search, auth, roles, customer and message data. ChatPanel diff is limited to: imports, one button, two state variables, one handler, the panel and confirm dialog.

## 14. Security checklist

RLS enabled; anon no grants; unapproved denied (table + storage); created_by, usage and timestamp columns not writable (column-level grants); usage only via hardened role-checked function; image fields all-or-none; bucket private with size/MIME limits; uploads limited to own folder (admin: any); no orphaned uploads on failed insert; Supabase security linter clean; no service key in client.

## 15. Test plan

Automated (Vitest, pure helpers): shortcut length/trim, duplicate keyword removal, message limit, search by shortcut/message/keyword/Khmer, each sort order, draft detection, file type/size validation.
Database (SQL as different roles via `set local role` + JWT claims): anon denied; unapproved denied; staff view/create; creator edit/delete own; staff cannot edit others; admin manages all; created_by spoof rejected; use_count edit via UPDATE ignored; storage policies match.
Manual signed-in preview (internal test customers only): text-only and picture replies, nothing auto-sent, edit text, remove picture, draft confirm + cancel, send via existing Send on Telegram, Messenger Page 1, Page 2, expired-window block, desktop popover placement, mobile sheet, no overflow, focus return, keyboard-only.
Build, TypeScript, lint (no new issues vs baseline).

## 16. Rollout and rollback

Rollout: bookmark current published version → apply additive migration (shared DB, unused by old app) → types regenerate → build UI → tests + security scan → signed-in preview checks → publish only on your approval.
Rollback: republish previous version; leave table/bucket/function in place unused; remove later only via a reviewed forward migration (History restore doesn't undo migrations).

## 17. Exact objects that change

Database (one additive migration): table `public.saved_replies`; unique index + 3 sort indexes; trigger function `saved_replies_set_updated_at()` + 1 BEFORE UPDATE trigger; function `record_saved_reply_use(uuid)`; table + column grants; 4 table policies; 3 storage policies on `storage.objects` scoped to `saved-reply-media`.
Storage: bucket `saved-reply-media` (private, 10 MB, JPEG/PNG/WebP), created with the storage tool, not SQL.

Files:
- New: `src/hooks/useSavedReplies.ts`, `src/components/SavedRepliesPanel.tsx`, `src/components/SavedReplyDialog.tsx`, `src/components/SavedReplyThumbnail.tsx`, `src/lib/savedReplies.ts`, `src/lib/savedReplies.test.ts`, `vitest.config.ts`
- Modified: `src/components/ChatPanel.tsx`, `package.json` (vitest dev dep + `test` script), `bun.lock` (authoritative lockfile, updated by `bun add -d vitest`)
- Regenerated: `src/integrations/supabase/types.ts`
- Not touched: `bun.lockb`, `package-lock.json` (stale/unrelated lockfiles), all edge functions, `useChatMessages.ts`, conversation-list files.

Out of scope: personalization tokens (phase 2), realtime library sync, per-user private libraries.
