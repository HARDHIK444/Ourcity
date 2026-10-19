-- OurCity step 3: likes, dislikes and comments
-- Run in Supabase: SQL Editor -> New query -> paste -> Run

-- 1. Reactions: one row per person per post (+1 = like, -1 = dislike)
create table public.reactions (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  value      smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)          -- this is what stops anyone voting twice
);

alter table public.reactions enable row level security;

create policy "Anyone can read reactions"
  on public.reactions for select using (true);

create policy "Users add their own reaction"
  on public.reactions for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users change their own reaction"
  on public.reactions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users remove their own reaction"
  on public.reactions for delete to authenticated
  using (auth.uid() = user_id);

-- 2. Comments
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

alter table public.comments enable row level security;

create policy "Anyone can read comments"
  on public.comments for select using (true);

create policy "Logged-in users comment as themselves"
  on public.comments for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users delete their own comments"
  on public.comments for delete to authenticated
  using (auth.uid() = user_id);

-- 3. A view that counts likes, dislikes and comments for every post
create view public.post_stats with (security_invoker = true) as
select
  p.id as post_id,
  (select count(*) from public.reactions r where r.post_id = p.id and r.value = 1)  as likes,
  (select count(*) from public.reactions r where r.post_id = p.id and r.value = -1) as dislikes,
  (select count(*) from public.comments  c where c.post_id = p.id)                  as comments
from public.posts p;

grant select on public.post_stats to anon, authenticated;
