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
| `src/lib/savedReplies.test.ts` (new) + minimal Vitest setup (`vitest` dev dep, `test` script) | The project has no test runner today; this adds one for the pure rules only. |
| `src/components/ChatPanel.tsx` | Add trigger button after Mic; open state; draft-replace confirmation; image-to-File resolution; populate `replyText` and call existing `processFiles`. No change to existing handlers. |

Not touched: messages, customer, existing RPCs/RLS/policies, edge functions, auth, useChatMessages, conversation filters.

## 2. Final database schema

```sql
create table public.saved_replies (
  id uuid primary key default gen_random_uuid(),
  shortcut text not null,
  message text not null,
  keywords text[] not null default '{}',
  image_path text, image_name text, image_mime_type text, image_size bigint,
  created_by uuid not null default auth.uid(),
  use_count bigint not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_replies_shortcut_len check (char_length(btrim(shortcut)) between 3 and 50 and shortcut = btrim(shortcut)),
  constraint saved_replies_message_len check (char_length(btrim(message)) >= 1 and char_length(message) <= 1000),
  constraint saved_replies_image_size check (image_size is null or (image_size >= 0 and image_size <= 10485760)),
  constraint saved_replies_image_mime check (image_mime_type is null or image_mime_type in ('image/jpeg','image/png','image/webp')),
  constraint saved_replies_image_consistent check ((image_path is null) = (image_mime_type is null))
);
create unique index saved_replies_shortcut_lower_uidx on public.saved_replies (lower(shortcut));
create index saved_replies_use_count_idx on public.saved_replies (use_count desc, id);
create index saved_replies_last_used_idx on public.saved_replies (last_used_at desc nulls last, id);
create index saved_replies_created_idx on public.saved_replies (created_at desc, id);
```

Triggers (BEFORE UPDATE):
- `updated_at = now()` (only when shortcut/message/keywords/image fields change, so usage tracking doesn't bump it).
- `created_by` immutable: `new.created_by := old.created_by`.
- `use_count`/`last_used_at` can't be changed by a normal UPDATE: reset to old values unless the session flag `app.saved_reply_usage = 'on'` is set (set only inside the usage function).

Grants: `revoke all from anon, public; grant select, insert, update, delete to authenticated`.

### Usage tracking (the one exception)
Any approved staff can use any reply, but only the creator/admin may UPDATE rows. To count uses without loosening UPDATE, one narrow function:

`public.record_saved_reply_use(p_id uuid) returns void` — SECURITY DEFINER, `search_path = public`, first checks `has_role(auth.uid(),'admin'|'user'|'moderator')` (else raises), then only does `use_count = use_count + 1, last_used_at = now()` for that id. Execute revoked from PUBLIC/anon, granted to authenticated. Called fire-and-forget after the draft is filled; failure is ignored.

(Alternative if you reject any SECURITY DEFINER: a separate insert-only `saved_reply_uses` table with counts computed client-side. More moving parts; I recommend the function.)

## 3. Table RLS policies

```text
SELECT  : has_role admin OR user OR moderator
INSERT  : (approved role) AND created_by = auth.uid()
UPDATE  : USING  (approved role) AND (created_by = auth.uid() OR has_role admin)
          CHECK  same, plus created_by unchanged (trigger enforces)
DELETE  : (approved role) AND (created_by = auth.uid() OR has_role admin)
```
anon: no grants, no policies. Unapproved signed-in user: fails role check everywhere.

## 4. Storage bucket policies

Bucket `saved-reply-media`: private, `file_size_limit = 10485760`, `allowed_mime_types = {image/jpeg,image/png,image/webp}`.
Path: `{creator_user_id}/{saved_reply_id}/{uuid}.{ext}`.

```text
SELECT : bucket = saved-reply-media AND approved role
INSERT : bucket AND approved role AND (storage.foldername(name))[1] = auth.uid()::text
UPDATE : not granted (replace = upload new + delete old)
DELETE : bucket AND approved role AND (folder[1] = auth.uid()::text OR has_role admin)
```
Admin editing someone else's reply uploads the new image to the creator's folder? No — admin uploads into their own folder; `image_path` just points to it. Delete policy lets admin remove the old one.

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
| Upload image | no | no | own folder | own folder |
| Delete image | no | no | own folder | any |

UI hides Edit/Delete unless `created_by === me || isAdmin`; the database enforces it regardless.

## 11. Create/edit form rules

- Shortcut: trimmed, 3–50, unique ignoring case (DB index authoritative).
- Message: required after trim, ≤1000, line breaks kept, counter.
- Keywords: chip input; trim + collapse whitespace, case-insensitive dedupe, Khmer OK.
- Picture: one; JPEG/PNG/WebP; ≤10 MB; checks MIME and magic bytes (FF D8 FF / 89 50 4E 47 / RIFF..WEBP); preview, Replace, Remove.
- Save new: insert row → upload to `{me}/{id}/…` → update image fields; if upload fails, row kept text-only and error shown with retry option.
- Replace: upload new → update row → then delete old object. Remove/Delete reply: update/delete row → then delete object (failure only logged).

## 12. Search, sort, freshness

- Search (case-insensitive, `toLocaleLowerCase` + NFC normalize for Khmer) over shortcut, message, keywords; live; clear button.
- Sort: Frequently used (default), Recently used, Recently created, Alphabetical (`localeCompare`).
- Freshness: no new realtime channel in v1. `staleTime` 30s, refetch on panel open, invalidate after own mutations. Trade-off: another employee's edit appears next time the panel opens (or within 30s), not instantly. No effect on message channels or conversation list.

## 13. Regression checklist

Unchanged: input typing, Enter send, Shift+Enter, attachment menu, paste, drag-drop, voice record/preview, text/photo/video/document sending, Telegram + Messenger Page 1/2 delivery, 24h restriction, optimistic bubbles, history, All/Unread/Not Replied filters, search, auth, roles, customer and message data. ChatPanel diff is limited to: imports, one button, two state variables, one handler, the panel and confirm dialog.

## 14. Security checklist

RLS enabled; anon no grants; unapproved denied (table + storage); created_by forced and immutable; usage columns locked except via role-checked function; bucket private with size/MIME limits; folder-scoped uploads; Supabase security linter clean; no service key in client.

## 15. Test plan

Automated (Vitest, pure helpers): shortcut length/trim, duplicate keyword removal, message limit, search by shortcut/message/keyword/Khmer, each sort order, draft detection, file type/size validation.
Database (SQL as different roles via `set local role` + JWT claims): anon denied; unapproved denied; staff view/create; creator edit/delete own; staff cannot edit others; admin manages all; created_by spoof rejected; use_count edit via UPDATE ignored; storage policies match.
Manual signed-in preview (internal test customers only): text-only and picture replies, nothing auto-sent, edit text, remove picture, draft confirm + cancel, send via existing Send on Telegram, Messenger Page 1, Page 2, expired-window block, desktop popover placement, mobile sheet, no overflow, focus return, keyboard-only.
Build, TypeScript, lint (no new issues vs baseline).

## 16. Rollout and rollback

Rollout: bookmark current published version → apply additive migration (shared DB, unused by old app) → types regenerate → build UI → tests + security scan → signed-in preview checks → publish only on your approval.
Rollback: republish previous version; leave table/bucket/function in place unused; remove later only via a reviewed forward migration (History restore doesn't undo migrations).

## 17. Exact objects that change

Database: table `public.saved_replies`; 4 indexes; functions `saved_replies_before_update()` (trigger) and `record_saved_reply_use(uuid)`; 1 trigger; 4 table policies; bucket `saved-reply-media`; 3 storage policies on `storage.objects` scoped to that bucket.
Files: 5 new (hook, panel, dialog, helpers, helper tests), `ChatPanel.tsx` modified, `types.ts` regenerated, `package.json` (vitest dev dep + test script).

Out of scope: personalization tokens (phase 2), realtime library sync, per-user private libraries.
