-- OurCity step 6: admins, status history, resolution notes + evidence
-- Run in Supabase: SQL Editor -> New query -> paste -> Run (after 01 to 04)

-- 1. "Is the person asking an admin?"  (used by the rules below)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 2. Every status change is one row here: when, what, a note, optional evidence photo
create table public.post_updates (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  status       text not null check (status in ('reported','under_review','in_progress','resolved')),
  note         text check (note is null or char_length(note) <= 500),
  evidence_url text,
  created_by   uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now()
);
create index post_updates_post_idx on public.post_updates (post_id, created_at);

alter table public.post_updates enable row level security;

create policy "Anyone can read status updates"
  on public.post_updates for select using (true);

create policy "Only admins add status updates"
  on public.post_updates for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());

-- 3. When an admin adds an update, the post's current status follows it.
--    (Normal users still cannot change a post's status themselves.)
create or replace function public.apply_post_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts set status = new.status where id = new.post_id;
  return new;
end;
$$;

create trigger on_post_update_added
  after insert on public.post_updates
  for each row execute function public.apply_post_update();

-- ------------------------------------------------------------------
-- 4. MAKE YOURSELF AN ADMIN (run this ONE line separately, with your own email):
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
--
-- To remove admin rights later: set role = 'citizen' the same way.
-- ------------------------------------------------------------------
