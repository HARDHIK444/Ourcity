-- OurCity step 4: many photos/videos per post, music/audio, map location
-- Run in Supabase: SQL Editor -> New query -> paste -> Run (after 02 and 03)

-- 1. Extra columns on posts
alter table public.posts add column if not exists audio_url text;
alter table public.posts add column if not exists lat double precision;
alter table public.posts add column if not exists lng double precision;

-- 2. One row per photo/video of a post (so a post can have several)
create table public.post_media (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  url        text not null,
  kind       text not null check (kind in ('image', 'video')),
  position   smallint not null default 0,
  created_at timestamptz not null default now()
);
create index post_media_post_idx on public.post_media (post_id, position);

alter table public.post_media enable row level security;

create policy "Anyone can read post media"
  on public.post_media for select using (true);

-- you may add media only to a post that is yours
create policy "Owners add media to their post"
  on public.post_media for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));

-- 3. Allow audio files in the storage bucket
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime',
                               'audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/x-wav','audio/ogg','audio/webm']
where id = 'post-media';
