-- Child table: up to 4 ordered pictures per saved reply
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

revoke all on public.saved_reply_images from public, anon, authenticated;
grant select on public.saved_reply_images to authenticated;
grant all on public.saved_reply_images to service_role;
alter table public.saved_reply_images enable row level security;
create policy "Approved staff can view saved reply images" on public.saved_reply_images
  for select to authenticated using (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator'));

-- Storage cleanup queue
create table public.saved_reply_image_cleanup (
  id uuid primary key default gen_random_uuid(),
  image_path text not null unique,
  creator_id uuid not null,
  queued_at timestamptz not null default now()
);
revoke all on public.saved_reply_image_cleanup from public, anon, authenticated;
grant select on public.saved_reply_image_cleanup to authenticated;
grant all on public.saved_reply_image_cleanup to service_role;
alter table public.saved_reply_image_cleanup enable row level security;
create policy "Creator or admin can view cleanup entries" on public.saved_reply_image_cleanup
  for select to authenticated using (
    (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator'))
    and (creator_id = auth.uid() or public.has_role(auth.uid(),'admin')));

-- Backfill existing pictures at position 0 (before triggers exist)
insert into public.saved_reply_images (saved_reply_id, position, image_path, image_name, image_mime_type, image_size)
select r.id, 0, r.image_path, r.image_name, r.image_mime_type, r.image_size
from public.saved_replies r
where r.image_path is not null
  and not exists (select 1 from public.saved_reply_images i where i.saved_reply_id = r.id)
on conflict (image_path) do nothing;

do $$ declare parents int; children int; total_children int; begin
  select count(*) into parents from public.saved_replies where image_path is not null;
  select count(*) into children from public.saved_reply_images i
    join public.saved_replies r on r.id = i.saved_reply_id
   where i.position = 0 and i.image_path = r.image_path and i.image_name = r.image_name
     and i.image_mime_type = r.image_mime_type and i.image_size = r.image_size;
  select count(*) into total_children from public.saved_reply_images;
  if parents <> children or total_children <> parents then
    raise exception 'Backfill mismatch: % picture replies, % matching child rows, % total child rows', parents, children, total_children;
  end if;
end $$;

create function public._saved_reply_path_referenced(p_path text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.saved_reply_images where image_path = p_path)
      or exists (select 1 from public.saved_replies where image_path = p_path)
$$;
revoke execute on function public._saved_reply_path_referenced(text) from public, anon, authenticated;

create function public._saved_reply_queue_path(p_path text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_path is null or public._saved_reply_path_referenced(p_path) then return; end if;
  insert into public.saved_reply_image_cleanup (image_path, creator_id)
  values (p_path, split_part(p_path, '/', 1)::uuid)
  on conflict (image_path) do nothing;
end $$;
revoke execute on function public._saved_reply_queue_path(text) from public, anon, authenticated;

create function public._saved_reply_is_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator'))
$$;
revoke execute on function public._saved_reply_is_staff() from public, anon, authenticated;

create function public._saved_reply_validate_images(p_creator uuid, p_reply_id uuid, p_images jsonb) returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare el jsonb; v_path text; v_prefix text := p_creator::text || '/' || p_reply_id::text || '/';
begin
  if p_images is null or jsonb_typeof(p_images) <> 'array' then raise exception 'Pictures must be a list'; end if;
  if jsonb_array_length(p_images) > 4 then raise exception 'A saved reply can have at most 4 pictures'; end if;
  for el in select value from jsonb_array_elements(p_images) loop
    v_path := el->>'path';
    if v_path is null or el->>'name' is null or el->>'mime_type' is null or el->>'size' is null then
      raise exception 'Picture details are incomplete';
    end if;
    if el->>'mime_type' not in ('image/jpeg','image/png','image/webp') then raise exception 'Unsupported picture type'; end if;
    if (el->>'size')::bigint not between 1 and 10485760 then raise exception 'Picture must be 10 MB or smaller'; end if;
    if left(v_path, length(v_prefix)) <> v_prefix or v_path like '%..%' then raise exception 'Invalid picture location'; end if;
    if exists (select 1 from public.saved_reply_image_cleanup where image_path = v_path) then
      raise exception 'This picture is being removed; please upload it again';
    end if;
  end loop;
  if (select count(distinct value->>'path') from jsonb_array_elements(p_images)) <> jsonb_array_length(p_images) then
    raise exception 'The same picture was added twice';
  end if;
end $$;
revoke execute on function public._saved_reply_validate_images(uuid, uuid, jsonb) from public, anon, authenticated;

create function public._saved_reply_apply_images(p_reply_id uuid, p_images jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text[]; v_new text[]; v_path text; v_first record;
begin
  perform set_config('app.saved_reply_images_sync', 'on', true);
  select coalesce(array_agg(image_path), '{}') into v_old from public.saved_reply_images where saved_reply_id = p_reply_id;
  select v_old || coalesce(array_agg(image_path), '{}') into v_old from public.saved_replies where id = p_reply_id and image_path is not null;
  select coalesce(array_agg(value->>'path'), '{}') into v_new from jsonb_array_elements(p_images);

  delete from public.saved_reply_images where saved_reply_id = p_reply_id;
  insert into public.saved_reply_images (saved_reply_id, position, image_path, image_name, image_mime_type, image_size)
  select p_reply_id, (ord - 1)::smallint, value->>'path', value->>'name', value->>'mime_type', (value->>'size')::bigint
  from jsonb_array_elements(p_images) with ordinality as t(value, ord);

  select image_path, image_name, image_mime_type, image_size into v_first
    from public.saved_reply_images where saved_reply_id = p_reply_id and position = 0;
  update public.saved_replies set
    image_path = v_first.image_path, image_name = v_first.image_name,
    image_mime_type = v_first.image_mime_type, image_size = v_first.image_size
  where id = p_reply_id;

  foreach v_path in array v_old loop
    if not (v_path = any(v_new)) then perform public._saved_reply_queue_path(v_path); end if;
  end loop;
  perform set_config('app.saved_reply_images_sync', 'off', true);
end $$;
revoke execute on function public._saved_reply_apply_images(uuid, jsonb) from public, anon, authenticated;

create function public.create_saved_reply(p_id uuid, p_shortcut text, p_message text, p_keywords text[], p_images jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public._saved_reply_is_staff() then raise exception 'not authorized'; end if;
  if p_id is null then raise exception 'Missing reply id'; end if;
  perform public._saved_reply_validate_images(auth.uid(), p_id, coalesce(p_images, '[]'::jsonb));
  insert into public.saved_replies (id, shortcut, message, keywords, created_by)
  values (p_id, btrim(p_shortcut), p_message, coalesce(p_keywords, '{}'), auth.uid());
  perform public._saved_reply_apply_images(p_id, coalesce(p_images, '[]'::jsonb));
end $$;
revoke execute on function public.create_saved_reply(uuid, text, text, text[], jsonb) from public, anon;
grant execute on function public.create_saved_reply(uuid, text, text, text[], jsonb) to authenticated;

create function public.update_saved_reply(p_id uuid, p_shortcut text, p_message text, p_keywords text[], p_images jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_creator uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public._saved_reply_is_staff() then raise exception 'not authorized'; end if;
  select created_by into v_creator from public.saved_replies where id = p_id for update;
  if not found then raise exception 'This reply was deleted'; end if;
  if v_creator <> auth.uid() and not public.has_role(auth.uid(),'admin') then raise exception 'not authorized'; end if;
  perform public._saved_reply_validate_images(v_creator, p_id, coalesce(p_images, '[]'::jsonb));
  update public.saved_replies set shortcut = btrim(p_shortcut), message = p_message, keywords = coalesce(p_keywords, '{}')
   where id = p_id;
  perform public._saved_reply_apply_images(p_id, coalesce(p_images, '[]'::jsonb));
end $$;
revoke execute on function public.update_saved_reply(uuid, text, text, text[], jsonb) from public, anon;
grant execute on function public.update_saved_reply(uuid, text, text, text[], jsonb) to authenticated;

create function public.delete_saved_reply(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_creator uuid; v_legacy text; v_paths text[]; v_path text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public._saved_reply_is_staff() then raise exception 'not authorized'; end if;
  select created_by, image_path into v_creator, v_legacy from public.saved_replies where id = p_id for update;
  if not found then raise exception 'This reply was already deleted'; end if;
  if v_creator <> auth.uid() and not public.has_role(auth.uid(),'admin') then raise exception 'not authorized'; end if;
  select coalesce(array_agg(image_path), '{}') into v_paths from public.saved_reply_images where saved_reply_id = p_id;
  if v_legacy is not null then v_paths := v_paths || v_legacy; end if;
  perform set_config('app.saved_reply_images_sync', 'on', true);
  delete from public.saved_replies where id = p_id;
  foreach v_path in array v_paths loop perform public._saved_reply_queue_path(v_path); end loop;
  perform set_config('app.saved_reply_images_sync', 'off', true);
end $$;
revoke execute on function public.delete_saved_reply(uuid) from public, anon;
grant execute on function public.delete_saved_reply(uuid) to authenticated;

create function public.claim_saved_reply_cleanup()
returns setof text language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public._saved_reply_is_staff() then raise exception 'not authorized'; end if;
  delete from public.saved_reply_image_cleanup c
   where (c.creator_id = auth.uid() or public.has_role(auth.uid(),'admin'))
     and public._saved_reply_path_referenced(c.image_path);
  return query
    select c.image_path from public.saved_reply_image_cleanup c
     where c.creator_id = auth.uid() or public.has_role(auth.uid(),'admin')
     order by c.queued_at limit 50;
end $$;
revoke execute on function public.claim_saved_reply_cleanup() from public, anon;
grant execute on function public.claim_saved_reply_cleanup() to authenticated;

create function public.complete_saved_reply_cleanup(p_path text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_creator uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public._saved_reply_is_staff() then raise exception 'not authorized'; end if;
  select creator_id into v_creator from public.saved_reply_image_cleanup where image_path = p_path for update;
  if not found then return false; end if;
  if v_creator <> auth.uid() and not public.has_role(auth.uid(),'admin') then raise exception 'not authorized'; end if;
  if public._saved_reply_path_referenced(p_path) then return false; end if;
  delete from public.saved_reply_image_cleanup where image_path = p_path;
  return true;
end $$;
revoke execute on function public.complete_saved_reply_cleanup(text) from public, anon;
grant execute on function public.complete_saved_reply_cleanup(text) to authenticated;

create function public.saved_reply_images_after_delete() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('app.saved_reply_images_sync', true), 'off') = 'on' then return old; end if;
  perform public._saved_reply_queue_path(old.image_path);
  return old;
end $$;
revoke execute on function public.saved_reply_images_after_delete() from public, anon, authenticated;
create trigger saved_reply_images_after_delete after delete on public.saved_reply_images
  for each row execute function public.saved_reply_images_after_delete();

create function public.saved_replies_sync_legacy_image() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_first public.saved_reply_images%rowtype; v_next record;
begin
  if coalesce(current_setting('app.saved_reply_images_sync', true), 'off') = 'on' then return null; end if;
  if tg_op = 'UPDATE' and new.image_path is not distinct from old.image_path
     and new.image_name is not distinct from old.image_name
     and new.image_mime_type is not distinct from old.image_mime_type
     and new.image_size is not distinct from old.image_size then
    return null;
  end if;
  perform set_config('app.saved_reply_images_sync', 'on', true);
  select * into v_first from public.saved_reply_images where saved_reply_id = new.id and position = 0;

  if new.image_path is not null then
    if v_first.id is null then
      insert into public.saved_reply_images (saved_reply_id, position, image_path, image_name, image_mime_type, image_size)
      values (new.id, 0, new.image_path, new.image_name, new.image_mime_type, new.image_size);
    elsif v_first.image_path is distinct from new.image_path or v_first.image_name is distinct from new.image_name
       or v_first.image_mime_type is distinct from new.image_mime_type or v_first.image_size is distinct from new.image_size then
      update public.saved_reply_images set image_path = new.image_path, image_name = new.image_name,
             image_mime_type = new.image_mime_type, image_size = new.image_size
       where id = v_first.id;
      if v_first.image_path <> new.image_path then perform public._saved_reply_queue_path(v_first.image_path); end if;
    end if;
  elsif v_first.id is not null then
    set constraints public.saved_reply_images_reply_position_key deferred;
    delete from public.saved_reply_images where id = v_first.id;
    update public.saved_reply_images set position = position - 1 where saved_reply_id = new.id;
    set constraints public.saved_reply_images_reply_position_key immediate;
    perform public._saved_reply_queue_path(v_first.image_path);
    select image_path, image_name, image_mime_type, image_size into v_next
      from public.saved_reply_images where saved_reply_id = new.id and position = 0;
    if found then
      update public.saved_replies set image_path = v_next.image_path, image_name = v_next.image_name,
             image_mime_type = v_next.image_mime_type, image_size = v_next.image_size
       where id = new.id;
    end if;
  end if;
  perform set_config('app.saved_reply_images_sync', 'off', true);
  return null;
end $$;
revoke execute on function public.saved_replies_sync_legacy_image() from public, anon, authenticated;
create trigger saved_replies_sync_legacy_image
  after insert or update of image_path, image_name, image_mime_type, image_size on public.saved_replies
  for each row execute function public.saved_replies_sync_legacy_image();