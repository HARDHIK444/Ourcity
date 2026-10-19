-- OurCity step 2: posts + photo/video storage
-- Run in Supabase: SQL Editor -> New query -> paste -> Run

-- 1. The posts table (one row per reported problem)
create table public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 10 and 1000),
  category    text not null check (category in (
                'Potholes','Garbage','Illegal dumping','Damaged roads',
                'Unfinished highway or flyover','Dangerous construction site','Unsafe diversion',
                'Accident-prone spot','Streetlights','Drainage','Water pollution','Water leakage','Other')),
  location    text not null check (char_length(location) between 2 and 120),
  media_url   text,
  media_type  text check (media_type in ('image','video')),
  status      text not null default 'reported' check (status in ('reported','under_review','in_progress','resolved')),
  created_at  timestamptz not null default now()
);

create index posts_created_at_idx on public.posts (created_at desc);

-- 2. Security rules
alter table public.posts enable row level security;

create policy "Anyone can read posts"
  on public.posts for select
  using (true);

create policy "Logged-in users can post as themselves"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = user_id and status = 'reported');

create policy "Users can delete their own posts"
  on public.posts for delete
  to authenticated
  using (auth.uid() = user_id);

-- (No update policy on purpose: later only admins will be able to change status.)

-- 3. Storage bucket for photos and videos (max 50 MB each)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', true, 52428800,
        array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

-- Each user may upload and delete only inside a folder named after their own user id.
create policy "Users upload to their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete their own media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
