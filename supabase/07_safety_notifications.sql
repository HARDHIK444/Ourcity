-- OurCity stage 8: community reports ("flags"), admin removal, notifications
-- Run in Supabase: SQL Editor -> New query -> paste -> Run (after 01 to 06)

-- 1. FLAGS: any logged-in person can report a post or a comment
create table public.flags (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason     text not null check (reason in
               ('Blames or names a person','Fake or misleading','Abusive or hateful','Spam','Private information','Something else')),
  details    text check (details is null or char_length(details) <= 200),
  created_at timestamptz not null default now(),
  check ((post_id is not null)::int + (comment_id is not null)::int = 1),
  unique (user_id, post_id),
  unique (user_id, comment_id)
);
alter table public.flags enable row level security;

create policy "Users report as themselves"
  on public.flags for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Admins and the reporter can read flags"
  on public.flags for select to authenticated
  using (public.is_admin() or auth.uid() = user_id);

create policy "Admins dismiss flags"
  on public.flags for delete to authenticated
  using (public.is_admin());

-- 2. ADMINS can remove any post or comment (everyone else: only their own, as before)
create policy "Admins delete any post"
  on public.posts for delete to authenticated
  using (public.is_admin());

create policy "Admins delete any comment"
  on public.comments for delete to authenticated
  using (public.is_admin());

-- 3. NOTIFICATIONS: the post owner hears about status changes and comments
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid references public.posts (id) on delete cascade,
  kind       text not null check (kind in ('status','comment')),
  message    text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;

create policy "Read my notifications"
  on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "Mark my notifications read"
  on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete my notifications"
  on public.notifications for delete to authenticated using (auth.uid() = user_id);
-- (no insert policy on purpose: only the triggers below can create notifications)

revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;

-- 4. Triggers that create the notifications
create or replace function public.notify_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record; label text;
begin
  select id, user_id, title into p from public.posts where id = new.post_id;
  label := case new.status when 'under_review' then 'Under review' when 'in_progress' then 'In progress'
                           when 'resolved' then 'Resolved' else 'Reported' end;
  if p.user_id is not null and p.user_id <> new.created_by then
    insert into public.notifications (user_id, post_id, kind, message)
    values (p.user_id, p.id, 'status', 'Your report "' || left(p.title, 60) || '" is now: ' || label);
  end if;
  return new;
end; $$;
drop trigger if exists on_update_notify on public.post_updates;
create trigger on_update_notify after insert on public.post_updates
  for each row execute function public.notify_status_change();

create or replace function public.notify_new_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record; who text;
begin
  select id, user_id, title into p from public.posts where id = new.post_id;
  select display_name into who from public.profiles where id = new.user_id;
  if p.user_id is not null and p.user_id <> new.user_id then
    insert into public.notifications (user_id, post_id, kind, message)
    values (p.user_id, p.id, 'comment', coalesce(who, 'Someone') || ' commented on your report "' || left(p.title, 60) || '"');
  end if;
  return new;
end; $$;
drop trigger if exists on_comment_notify on public.comments;
create trigger on_comment_notify after insert on public.comments
  for each row execute function public.notify_new_comment();
