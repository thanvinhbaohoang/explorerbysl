# Saved Replies: 0–4 ordered pictures (backward-compatible upgrade) — revised

Plan only. The applied `0002_add_saved_replies` migration is untouched. Nothing publishes automatically. Telegram/Messenger delivery functions, `sendMediaBatch`, and the Send path are not changed.

## Current state (checked today)
- 32 saved replies exist; all 32 have a picture; 0 have a partial picture record (the existing all-or-none CHECK guarantees this).
- Existing storage policies: upload/delete only in the uploader's own folder (or admin); extension allowlist jpg/jpeg/png/webp; read for approved roles. They already cover the new path shape — no storage policy change.

## 1. Existing-data audit (read-only, before the migration)
```sql
select
  count(*) as total_replies,
  count(*) filter (where image_path is not null) as with_picture,
  count(*) filter (where image_path is null) as text_only,
  count(*) filter (where (image_path is null) <> (image_name is null)
                      or (image_path is null) <> (image_mime_type is null)
                      or (image_path is null) <> (image_size is null)) as incomplete,
  count(*) filter (where image_path is not null and image_mime_type not in ('image/jpeg','image/png','image/webp')) as bad_mime,
  count(*) filter (where image_path is not null and (image_size < 1 or image_size > 10485760)) as bad_size,
  count(image_path) - count(distinct image_path) as duplicate_paths
from public.saved_replies;
-- plus: rows whose image_path has no object in storage.objects (bucket saved-reply-media)
```
Any non-zero incomplete / bad_mime / bad_size / duplicate_paths is reported and the migration waits for review. Missing objects are reported, not blocking.

## 2. Forward migration `add_saved_reply_images` (additive)

### Child table + column-level grants
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

grant select, delete on public.saved_reply_images to authenticated;
grant insert (id, saved_reply_id, position, image_path, image_name, image_mime_type, image_size)
  on public.saved_reply_images to authenticated;
grant update (position, image_path, image_name, image_mime_type, image_size)
  on public.saved_reply_images to authenticated;
-- id, saved_reply_id, created_at: never client-updatable; created_at never client-insertable
grant all on public.saved_reply_images to service_role;
-- no anon grant
alter table public.saved_reply_images enable row level security;
```
Max four: position 0–3 + unique (reply, position) makes a fifth row impossible; a BEFORE INSERT trigger also raises a clear "at most 4 pictures" message.

### RLS (authorization via parent row)
- SELECT: approved role (admin/user/moderator).
- INSERT (with check), UPDATE (using + with check), DELETE (using): approved role AND parent `saved_replies` row exists with `created_by = auth.uid()` or caller is admin.
- anon: no grant/policy. Unapproved signed-in: no access.

### Storage cleanup queue (no picture silently orphaned)
```sql
create table public.saved_reply_image_cleanup (
  id uuid primary key default gen_random_uuid(),
  image_path text not null unique,
  creator_id uuid not null,              -- first folder of the path
  queued_at timestamptz not null default now()
);
grant select, delete on public.saved_reply_image_cleanup to authenticated;
grant insert (image_path, creator_id) on public.saved_reply_image_cleanup to authenticated;
grant all on public.saved_reply_image_cleanup to service_role;
alter table public.saved_reply_image_cleanup enable row level security;
-- select / insert / delete: approved role AND (creator_id = auth.uid() OR admin)
```
- AFTER DELETE trigger on `saved_reply_images` (SECURITY INVOKER, `search_path = public, pg_temp`, execute revoked) queues the deleted row's path unless it is still referenced by another child row or a parent's legacy columns. It fires during cascades, so **when the old app deletes a multi-picture reply, all paths are captured before the rows disappear**. Insert uses `on conflict (image_path) do nothing`.
- The old app already deletes the first picture's object itself; that queue entry is harmless (drain treats "not found" as done).
- Drain: the new app, when Saved Replies opens, deletes queued objects the user may delete (own folder; admins all) and removes a queue row **only after Storage confirms deletion**. Failures stay queued and retry next time.
- Admin audit query: queue rows older than 24 hours.

### Atomic save function — concurrency design
`public.set_saved_reply_images(p_reply_id uuid, p_images jsonb) returns void` — plpgsql, **SECURITY INVOKER**, `set search_path = public, pg_temp`; revoked from public/anon, granted to authenticated.
1. `select ... from saved_replies where id = p_reply_id for update` — locks the parent; simultaneous edits of the same reply run one after another.
2. Authorization through RLS: a no-op `update saved_replies set shortcut = shortcut where id = p_reply_id` must affect 1 row (parent UPDATE policy = creator or admin); otherwise raise "not authorized".
3. Validate 0–4 items, required fields, path prefix `{creator}/{reply}/`, no duplicates.
4. `set_config('app.saved_reply_images_sync','on', true)` (transaction-local).
5. Delete current children (removed paths are queued by the trigger), insert the new set at positions 0..n-1.
6. Mirror position 0 into the parent legacy columns, or null all four when empty.
Any error rolls back everything → parent and children always match.

### Legacy-sync trigger (old app editing after release) — SECURITY INVOKER
AFTER INSERT / AFTER UPDATE OF image_path, image_name, image_mime_type, image_size on `saved_replies`; `search_path = public, pg_temp`; execute revoked.
- If the sync flag is on → return immediately (no recursion). Otherwise set the flag, then:
- **Old app adds/replaces the picture** → replace child position 0 with the legacy values; positions 1–3 kept; old path queued if unreferenced.
- **Old app removes the picture** → delete only child position 0, shift remaining children down (deferrable unique makes the one-statement shift safe), promote the new position 0 into the parent legacy columns. Legacy columns stay null only when no children remain.
- Runs as the caller; child RLS (creator/admin) matches who the parent policy already lets edit. The triggering update already holds the parent row lock, so it serialises with `set_saved_reply_images`.

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
  if parents <> children then raise exception 'Backfill mismatch: % vs %', parents, children; end if;
end $$;
```
Backfill runs before the triggers are created, so it queues nothing. Parent columns and object paths are never modified. Expected: 32 = 32; any mismatch rolls back the whole migration.

## 3. Frontend compatibility
- New app reads child rows by position; falls back to parent legacy picture when none exist.
- Old (published) app reads only parent columns — unaffected because position 0 is always mirrored.

## 4. Interface
- Edit dialog: thumbnail grid, "2 / 4 pictures", Add (disabled at 4), Replace/Remove per picture, "Move left"/"Move right" buttons with labels (disabled at the ends). Text-only still allowed.
- List: first picture plus "+N" badge.

## 5. Composer selection
Load images (child rows, else legacy) → download all → Files. Any failure: toast, draft unchanged. All succeed: existing draft-replace confirm, set text, one `processFiles(files)` call. Never sends.

## 6. Atomic edit, delete and cleanup
1. Upload each new picture to `{creator}/{reply}/{image_id}.{ext}` (creator folder even for admin edits).
2. Create: insert parent text row, then `set_saved_reply_images`. Failure → delete the parent and all newly uploaded objects.
3. Edit: update text + `set_saved_reply_images` with the full final set. Failure → delete only newly uploaded objects; old set untouched.
4. Delete (new app): delete the row; the cascade queues every path; then drain.
5. After success, drain the queue (removed/replaced objects). Cleanup failures are logged, stay queued, and show a non-blocking warning.
6. Invalidate list and thumbnail queries for changed paths.

## 7. Source files
- New migration (child table, cleanup queue, triggers, save function, backfill) + regenerated types.
- `src/hooks/useSavedReplies.ts`, `src/lib/savedReplies.ts` (+ tests), `src/components/SavedReplyDialog.tsx`, `src/components/SavedRepliesPanel.tsx`, `src/components/ChatPanel.tsx` (`handleSavedReplySelect` only).
- Not touched: edge functions, `useChatMessages.ts`, send code, old migration, storage policies.

## 8. Tests
- Unit: fallback, reorder mirroring, 5th rejected, removal shifts first, object diff.
- Database (rolled-back blocks, real role identities):
  - Column grants: updating id / saved_reply_id / created_at → denied (42501); inserting created_at → denied; allowed columns succeed.
  - Backfill exactly once; re-run adds 0; text-only stay text-only.
  - RLS matrix: staff read; creator/admin write; other staff, unapproved, anon denied.
  - 5th picture rejected.
  - Save function mirrors first / clears all; non-creator call raises "not authorized".
  - Two concurrent sessions calling the save function → final parent equals child position 0.
  - Old-app style: replace syncs position 0; removing the first promotes picture 2 and keeps 3–4; legacy null only when none left; no recursion.
  - Old-app delete of a 4-picture reply → 4 queue rows; queue rows only removable by creator/admin.
- **Production compatibility:** (a) read-only check of the existing 32 replies in the published app plus SQL check of one matching child row each — no business reply is edited. (b) one temporary reply `zz-test-multipic-DELETE-ME` used for all edit/replace/remove/delete tests (old and new app). (c) afterwards delete it, drain its queue, confirm no objects remain in its folder.
- Signed-in Preview: 1–4 pictures, reorder, remove first, remove all, partial download failure, desktop and mobile; Telegram album and Messenger Page 1/Page 2 to internal test customers only.
- Build, TypeScript, `bun run test`, security scan.

## 9. Rollback test
In Preview, load the currently published version against migrated data using the temporary test reply: its first picture shows and sends; text-only unchanged. Rollback = republish previous version; keep new tables/rows; nothing deleted. Removing tables or legacy columns only via a separately reviewed future migration.

## Deployment order
Bookmark → audit → migration + backfill → production compatibility test → types → frontend → Preview tests → rollback test → publish only after your approval.
