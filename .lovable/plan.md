# Saved Replies: 0–4 ordered pictures (backward-compatible upgrade)

Plan only. The applied `0002_add_saved_replies` migration is untouched. Nothing publishes automatically. Telegram/Messenger delivery functions, `sendMediaBatch`, and the Send path are not changed.

## Current state (checked today)
- 32 saved replies exist; all 32 have a picture; 0 have a partial/incomplete picture record (the existing all-or-none CHECK guarantees this).
- Existing storage policies: upload/delete only in the uploader's own folder (or admin); extension allowlist jpg/jpeg/png/webp; read for approved roles. These already cover the new path shape, so no storage policy change is needed.

## 1. Existing-data audit (run read-only before the migration)
```sql
select
  count(*)                                                     as total_replies,
  count(*) filter (where image_path is not null)               as with_picture,
  count(*) filter (where image_path is null)                   as text_only,
  count(*) filter (where (image_path is null) <> (image_name is null)
                      or (image_path is null) <> (image_mime_type is null)
                      or (image_path is null) <> (image_size is null)) as incomplete,
  count(*) filter (where image_path is not null and image_mime_type not in ('image/jpeg','image/png','image/webp')) as bad_mime,
  count(*) filter (where image_path is not null and (image_size < 1 or image_size > 10485760)) as bad_size,
  count(*) - count(distinct image_path) filter (where image_path is not null) - count(*) filter (where image_path is null) as duplicate_paths
from public.saved_replies;
-- plus: list rows whose image_path has no object in storage.objects (bucket saved-reply-media)
```
Any non-zero `incomplete / bad_mime / bad_size / duplicate_paths` is reported and the migration is not applied until reviewed. Missing storage objects are reported (they don't block; the row stays as-is).

## 2. Exact forward migration `add_saved_reply_images` (additive)
```sql
create table public.saved_reply_images (
  id uuid primary key default gen_random_uuid(),
  saved_reply_id uuid not null references public.saved_replies(id) on delete cascade,
  position smallint not null check (position between 0 and 3),
  image_path text not null,
  image_name text not null,
  image_mime_type text not null check (image_mime_type in ('image/jpeg','image/png','image/webp')),
  image_size bigint not null check (image_size between 1 and 10485760),
  created_at timestamptz not null default now(),
  constraint saved_reply_images_reply_position_key unique (saved_reply_id, position) deferrable initially immediate,
  constraint saved_reply_images_path_key unique (image_path)
);
create index saved_reply_images_reply_position_idx on public.saved_reply_images (saved_reply_id, position);

grant select, insert, update, delete on public.saved_reply_images to authenticated;
grant all on public.saved_reply_images to service_role;
-- no anon grant
alter table public.saved_reply_images enable row level security;
```
Max-four rule: `position between 0 and 3` + unique (reply, position) makes a fifth row impossible. A BEFORE INSERT trigger also raises a clear error ("A saved reply can have at most 4 pictures") when 4 rows already exist (search_path = public, pg_temp; execute revoked from public/anon/authenticated).

### RLS (authorization via parent row)
```sql
create policy "Approved staff can view saved reply images" on public.saved_reply_images
  for select to authenticated using (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator'));

create policy "Creator or admin can add saved reply images" on public.saved_reply_images
  for insert to authenticated with check (exists (
    select 1 from public.saved_replies r where r.id = saved_reply_id
      and (r.created_by = auth.uid() or public.has_role(auth.uid(),'admin'))
      and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator'))));
-- same USING/WITH CHECK shape for UPDATE (reorder/replace) and DELETE
```
anon: no grant, no policy. Unapproved signed-in users: every policy requires an approved role → 0 rows, writes denied.

### Atomic save function (one transaction for parent + children)
`public.set_saved_reply_images(p_reply_id uuid, p_images jsonb) returns void`, plpgsql, **SECURITY INVOKER** (RLS applies), search_path = public, pg_temp; revoked from public/anon, granted to authenticated.
- Validates: array of 0–4 items, each with path/name/mime/size; path must start with `{reply creator id}/{reply id}/`.
- Sets a transaction-local flag `app.saved_reply_images_sync = 'on'`.
- Deletes the reply's child rows, inserts the new ordered set at positions 0..n-1.
- Mirrors position 0 into the parent's four legacy columns, or sets all four to null when the set is empty.
- Any failure rolls back everything → never a partial image set.

### Legacy-sync trigger (protects against the old app editing after migration)
AFTER INSERT / AFTER UPDATE OF image_path, image_name, image_mime_type, image_size on `saved_replies`, skipped when the sync flag is on (i.e. when the change came from the new function):
- Old app creates/replaces a picture → position 0 child row is replaced with the legacy values (other positions kept).
- Old app removes the picture → all child rows for that reply are deleted (matches what that user saw: a text-only reply).
Function: security definer only if needed to bypass child RLS — otherwise invoker; search_path fixed; execute revoked.

### Backfill + count check (same migration, idempotent)
```sql
insert into public.saved_reply_images (saved_reply_id, position, image_path, image_name, image_mime_type, image_size)
select r.id, 0, r.image_path, r.image_name, r.image_mime_type, r.image_size
from public.saved_replies r
where r.image_path is not null
  and not exists (select 1 from public.saved_reply_images i where i.saved_reply_id = r.id)
on conflict do nothing;

do $$ declare parents int; children int; begin
  select count(*) into parents from public.saved_replies where image_path is not null;
  select count(*) into children from public.saved_reply_images i
    join public.saved_replies r on r.id = i.saved_reply_id
   where i.position = 0 and i.image_path = r.image_path and i.image_name = r.image_name
     and i.image_mime_type = r.image_mime_type and i.image_size = r.image_size;
  if parents <> children then raise exception 'Backfill mismatch: % picture replies, % matching child rows', parents, children; end if;
end $$;
```
The exception rolls back the whole migration. Parent columns are never modified; object paths are not changed. Expected today: 32 = 32.

## 3. Frontend compatibility
- New app reads child rows ordered by position; if a reply has none, it falls back to the parent's legacy picture.
- Old (published) app keeps reading only the parent columns — unaffected because position 0 is always mirrored.

## 4. Interface
- Edit dialog: thumbnail grid, "2 / 4 pictures" count, Add (disabled at 4), Replace and Remove per picture, "Move left" / "Move right" buttons with aria-labels (disabled at the ends). Text-only replies still allowed.
- List: first picture as thumbnail plus "+N" badge for extras.

## 5. Composer selection
Load images (child rows, else legacy) → download all → convert to Files. If any download fails: toast, draft unchanged. If all succeed: existing draft-replace confirm, set message text, call existing `processFiles(files)` once with the full array. Never sends; Send/`sendMediaBatch` unchanged.

## 6. Atomic edit and cleanup
1. Generate `image_id` per new picture; upload to `{creator}/{reply}/{image_id}.{ext}` (creator folder even when admin edits).
2. Create: insert parent row text fields, then call `set_saved_reply_images`. If either fails → delete the parent (create only) and every newly uploaded object.
3. Edit: update text fields + call `set_saved_reply_images` with the full final ordered set. If it fails → delete only the newly uploaded objects; old set untouched.
4. After success → delete objects that are no longer referenced (removed/replaced). Failures here are logged and shown as a non-blocking warning.
5. Invalidate list and thumbnail queries for changed paths.

## 7. Source files
- New migration (via the migration tool) + regenerated types.
- `src/hooks/useSavedReplies.ts` — fetch images with replies, new create/update flow, multi-download.
- `src/lib/savedReplies.ts` (+ tests) — pure helpers: resolveImages (child vs legacy fallback), reorder, max-4 validation, diff of objects to delete.
- `src/components/SavedReplyDialog.tsx` — picture grid and controls.
- `src/components/SavedRepliesPanel.tsx` — +N badge.
- `src/components/ChatPanel.tsx` — `handleSavedReplySelect` only (all-or-nothing downloads, one `processFiles` call).
- Not touched: edge functions, `useChatMessages.ts`, send code, old migration, storage policies.

## 8. Tests
- Unit (Vitest): fallback, reorder mirroring, 5th rejected, removal shifts first, delete-diff.
- Database (rolled-back block, real role identities): backfill exactly once and rerun adds 0; text-only stay text-only; RLS matrix (staff read, creator/admin write, other staff denied, unapproved/anon 0/denied); 5th row rejected; function mirrors first / clears all; old-app style parent update syncs child row 0; old-app removal clears children; failure leaves set unchanged.
- **Production compatibility test:** after the migration, open the published app signed-in: all 32 replies listed, pictures show, selecting fills the box with the picture, editing text and replacing the picture still work.
- Signed-in Preview: existing 1-picture replies, new 2/3/4-picture replies, reorder, remove first, remove all, partial download failure, desktop and mobile; Telegram album and Messenger Page 1 / Page 2 sends to internal test customers only.
- Build, TypeScript, `bun run test`, security linter/scan.

## 9. Rollback test
In Preview, temporarily load the currently published frontend version against the migrated data: a 3-picture reply made by the new app shows and sends its first picture; text-only replies unchanged. Rollback procedure: republish the previous version; leave the new table and rows in place; no data deleted. Removing the table or legacy columns only via a separately reviewed future migration.

## Deployment order
Bookmark current version → audit (§1) → apply migration + backfill → production compatibility test → types → frontend → Preview tests → rollback test → publish only after your approval.

## One decision to confirm
If someone using the old app removes a reply's picture after this ships, the plan deletes all of that reply's pictures (matching what they saw). Alternative: only remove the first and promote the next one.
