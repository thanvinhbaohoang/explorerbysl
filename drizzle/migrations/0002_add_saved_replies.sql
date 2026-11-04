do $$ begin
  if not exists (select 1 from storage.buckets where id = 'saved-reply-media' and public = false) then
    raise exception 'saved-reply-media bucket missing or public';
  end if;
end $$;

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
create index saved_replies_use_count_idx on public.saved_replies (use_count desc, id);
create index saved_replies_last_used_idx on public.saved_replies (last_used_at desc nulls last, id);
create index saved_replies_created_idx on public.saved_replies (created_at desc, id);

create function public.saved_replies_set_updated_at() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.shortcut is distinct from old.shortcut or new.message is distinct from old.message
     or new.keywords is distinct from old.keywords or new.image_path is distinct from old.image_path
     or new.image_name is distinct from old.image_name or new.image_mime_type is distinct from old.image_mime_type
     or new.image_size is distinct from old.image_size then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end $$;
revoke execute on function public.saved_replies_set_updated_at() from public, anon, authenticated;
create trigger saved_replies_set_updated_at before update on public.saved_replies
  for each row execute function public.saved_replies_set_updated_at();

revoke all on public.saved_replies from public, anon, authenticated;
grant select on public.saved_replies to authenticated;
grant insert (id, shortcut, message, keywords, image_path, image_name, image_mime_type, image_size) on public.saved_replies to authenticated;
grant update (shortcut, message, keywords, image_path, image_name, image_mime_type, image_size) on public.saved_replies to authenticated;
grant delete on public.saved_replies to authenticated;
grant all on public.saved_replies to service_role;

alter table public.saved_replies enable row level security;

create policy "Approved staff can view saved replies" on public.saved_replies for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator'));
create policy "Approved staff can create own saved replies" on public.saved_replies for insert to authenticated
  with check ((public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator')) and created_by = auth.uid());
create policy "Creator or admin can update saved replies" on public.saved_replies for update to authenticated
  using ((public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator')) and (created_by = auth.uid() or public.has_role(auth.uid(),'admin')))
  with check ((public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator')) and (created_by = auth.uid() or public.has_role(auth.uid(),'admin')));
create policy "Creator or admin can delete saved replies" on public.saved_replies for delete to authenticated
  using ((public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator')) and (created_by = auth.uid() or public.has_role(auth.uid(),'admin')));

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

create policy "Approved staff can read saved reply media" on storage.objects for select to authenticated
  using (bucket_id = 'saved-reply-media' and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator')));
create policy "Approved staff can upload saved reply media" on storage.objects for insert to authenticated
  with check (bucket_id = 'saved-reply-media'
    and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator'))
    and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(),'admin'))
    and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));
create policy "Owner or admin can delete saved reply media" on storage.objects for delete to authenticated
  using (bucket_id = 'saved-reply-media'
    and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'user') or public.has_role(auth.uid(),'moderator'))
    and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(),'admin')));