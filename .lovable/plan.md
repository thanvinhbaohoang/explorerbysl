# Saved Replies: 0–4 ordered pictures (backward-compatible upgrade) — revision 3

Plan only. The applied `0002_add_saved_replies` migration is untouched. Nothing publishes automatically. Telegram/Messenger delivery functions, `sendMediaBatch`, and the Send path are not changed.

## Current state (checked today)
- 32 saved replies exist; all 32 have a picture; 0 have a partial picture record.
- Existing storage policies (own folder or admin for upload/delete; jpg/jpeg/png/webp; approved-role read) already fit the new paths — no storage policy change.

## Design change in this revision (please note)
Because clients can no longer write the picture table directly (item 3), the save functions and the old-app sync trigger must be able to write it on the caller's behalf. They therefore run as **SECURITY DEFINER** with explicit, hardened checks (non-null `auth.uid()`, approved role, creator-or-admin on the locked parent row, fixed `search_path = public, pg_temp`, static SQL only, execution granted only to `authenticated`, internal trigger functions with no execution grant at all). This replaces the earlier SECURITY INVOKER choice, which only works while clients hold direct write grants. Authorization is unchanged in effect: only the reply's creator or an admin can change its pictures.

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
Any non-zero incomplete / bad_mime / bad_size / duplicate_paths is reported and the migration waits for review.

## 2. Forward migration `add_saved_reply_images` (additive)

### Child table and grants
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

grant select on public.saved_reply_images to authenticated;      -- read only
revoke insert, update, delete on public.saved_reply_images from authenticated, anon, public;
grant all on public.saved_reply_images to service_role;
alter table public.saved_reply_images enable row level security;
create policy "Approved staff can view saved reply images" on public.saved_reply_images
  for select to authenticated using (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator'));
```
No client insert/update/delete grants or policies exist, so every picture change goes through the functions below. Fifth picture impossible (position 0–3 + unique), and the functions reject arrays longer than 4 with a clear message.

### Cleanup queue
```sql
create table public.saved_reply_image_cleanup (
  id uuid primary key default gen_random_uuid(),
  image_path text not null unique,
  creator_id uuid not null,
  queued_at timestamptz not null default now()
);
grant select on public.saved_reply_image_cleanup to authenticated;
revoke insert, update, delete on public.saved_reply_image_cleanup from authenticated, anon, public;
grant all on public.saved_reply_image_cleanup to service_role;
alter table public.saved_reply_image_cleanup enable row level security;
-- select: approved role AND (creator_id = auth.uid() OR admin)
```

### Shared internal helper `_saved_reply_apply_images(p_reply_id, p_images jsonb)`
SECURITY DEFINER, fixed search_path, **no execute grant to anyone** (only called by the functions below). Caller must already hold the parent lock.
1. `set_config('app.saved_reply_images_sync','on', true)` — set **before** any child delete.
2. Capture `old_paths` = current child paths ∪ parent legacy path.
3. Delete children; insert the complete final set at positions 0..n-1.
4. Mirror position 0 into the parent's four legacy columns (or null all four when empty).
5. Queue only `old_paths − final_paths` (`on conflict do nothing`).

### Public functions (all SECURITY DEFINER, `search_path = public, pg_temp`, static SQL, revoked from public/anon, granted to authenticated)
**`create_saved_reply(p_id uuid, p_shortcut text, p_message text, p_keywords text[], p_images jsonb)`**
- `auth.uid()` not null; approved role.
- Validates shortcut (3–50, normalised), message (≤1000), keywords, 0–4 images (fields, mime, size, path prefix `{auth.uid()}/{p_id}/`, no duplicates).
- Inserts the parent (created_by = auth.uid()), then the helper. One transaction.

**`update_saved_reply(p_id uuid, p_shortcut text, p_message text, p_keywords text[], p_images jsonb)`**
1. `auth.uid()` not null; approved role.
2. `select ... from saved_replies where id = p_id for update` — locks the parent; concurrent edits wait.
3. Creator (`created_by = auth.uid()`) or admin, else raise "not authorized".
4. Validates text fields and the full 0–4 image array (path prefix uses the reply's creator id, so admin edits keep pictures in the creator folder).
5. Updates text fields; calls the helper (replace set, mirror, queue removed only).
6. Any error rolls back text and pictures together.

**`delete_saved_reply(p_id uuid)`** — same lock + checks; queues every child and legacy path; deletes the row (cascade). Used by the new app.

**`claim_saved_reply_cleanup()` returns setof text** — approved role; for queue rows the caller may delete (own creator_id, or admin): **rechecks** `saved_reply_images.image_path` and `saved_replies.image_path`; still-referenced rows are deleted from the queue as stale and **not returned**; returns only unreferenced paths.
**`complete_saved_reply_cleanup(p_path text)`** — removes the queue row only if the path is still unreferenced; called after Storage confirms deletion (or "not found").

### Child-delete cleanup trigger (internal)
AFTER DELETE on `saved_reply_images`; SECURITY DEFINER, fixed search_path, no execute grant.
- If the sync flag is on → skip (controlled replacement queues its own diff).
- Otherwise (e.g. the old app deleting the parent → cascade) → queue the path if unreferenced. This captures pictures 2–4 when the old app deletes a multi-picture reply.

### Legacy-sync trigger (old app editing after release)
AFTER INSERT / AFTER UPDATE OF image_path, image_name, image_mime_type, image_size on `saved_replies`; SECURITY DEFINER, fixed search_path, no execute grant. The old app's own parent update already passed the parent RLS (creator/admin) and holds the row lock.
- Sync flag on → return (no recursion). Otherwise set the flag, then:
- **Old app adds/replaces the picture** → replace child position 0 with the legacy values; positions 1–3 kept; the replaced path queued.
- **Old app removes the picture** → delete only child position 0 and queue it; shift remaining children down; promote the new position 0 into the legacy columns. Legacy columns stay null only when no pictures remain.

### Backfill + count check (same migration, before triggers are created)
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
Idempotent; parent columns and object paths unchanged; mismatch rolls back the whole migration. Expected 32 = 32.

## 3. Frontend compatibility
- New app reads child rows by position; falls back to the legacy picture when none exist.
- Old (published) app reads/writes only parent columns — still works; its edits are synced by the trigger.

## 4. Interface
Edit dialog: thumbnail grid, "2 / 4 pictures", Add (disabled at 4), Replace/Remove, labelled "Move left"/"Move right". List: first picture plus "+N" badge. Text-only still allowed.

## 5. Composer selection
Load images (child rows, else legacy) → download all → Files. Any failure: toast, draft unchanged. All succeed: existing draft-replace confirm, set text, one `processFiles(files)` call. Never sends.

## 6. Client save flow
1. Upload only new pictures to `{creator}/{reply}/{image_id}.{ext}`.
2. One call: `create_saved_reply` or `update_saved_reply` with text + full ordered image list.
3. Failure → delete only the newly uploaded objects; nothing in the database changed.
4. Success → drain: `claim_saved_reply_cleanup()` → delete each returned object → `complete_saved_reply_cleanup(path)`. Failures stay queued; non-blocking warning. Drain also runs when the panel opens.
5. Delete → `delete_saved_reply`, then drain.

## 7. Source files
- New migration + regenerated types.
- `src/hooks/useSavedReplies.ts`, `src/lib/savedReplies.ts` (+ tests), `src/components/SavedReplyDialog.tsx`, `src/components/SavedRepliesPanel.tsx`, `src/components/ChatPanel.tsx` (`handleSavedReplySelect` only).
- Not touched: edge functions, `useChatMessages.ts`, send code, old migration, storage policies.

## 8. Failure and permission tests (database, rolled-back blocks with real role identities)
- Direct child insert / update / delete by authenticated → denied (42501); direct queue writes → denied.
- Reorder four existing pictures → all 4 paths still referenced, **0 queued, 0 claimed, 0 deleted**.
- Replace one → only the replaced path queued.
- Remove one → only that path queued.
- Remove all → every removed path queued; legacy columns null.
- Drain safety: manually queued path that is still referenced → `claim` returns nothing and removes the stale row; `complete` refuses to remove a referenced path.
- Forced image failure (bad mime / 5 items / wrong path prefix) in `update_saved_reply` → text **and** pictures unchanged.
- Concurrency: two sessions run `update_saved_reply` on one reply; second waits on the lock; final parent legacy = child position 0, no mismatch.
- Authorization: null uid, unapproved, other staff → rejected; creator and admin succeed; admin edit keeps creator folder.
- Old-app behaviour: replace syncs position 0; removing the first promotes picture 2 and keeps 3–4; legacy null only when none left; no recursion; deleting a 4-picture reply queues all 4.
- Backfill exactly once; re-run adds 0; text-only stay text-only.
- Unit tests: fallback, reorder, 5th rejected, diff of removed paths.
- **Production compatibility:** read-only check of the existing 32 replies (published app + SQL one child row each) — no business reply edited. All edit/replace/remove/delete tests (old and new app) use one temporary reply `zz-test-multipic-DELETE-ME`, deleted afterwards with its objects and queue rows verified gone.
- Signed-in Preview: 1–4 pictures, desktop and mobile; Telegram album and Messenger Page 1/Page 2 to internal test customers only.
- Build, TypeScript, `bun run test`, security scan.

## 9. Rollback test
Using the temporary test reply, load the currently published version against migrated data: first picture shows and sends; text-only unchanged. Rollback = republish previous version; keep new tables/rows; nothing deleted. Removing tables or legacy columns only via a separately reviewed future migration.

## Deployment order
Bookmark → audit → migration + backfill → production compatibility test → types → frontend → Preview tests → rollback test → publish only after your approval.
