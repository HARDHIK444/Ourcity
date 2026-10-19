-- OurCity step 1: user profiles
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run

-- 1. A table for public profile info (one row per user)
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role         text not null default 'citizen' check (role in ('citizen', 'admin')),
  created_at   timestamptz not null default now()
);

-- 2. Turn on Row Level Security (nobody can touch rows unless a policy allows it)
alter table public.profiles enable row level security;

-- 3. Rules (policies)
create policy "Anyone can read profiles"
  on public.profiles for select
  using (true);

create policy "Users can edit only their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 4. Users may change their name, but never their own role
revoke update on public.profiles from anon, authenticated;
grant  update (display_name) on public.profiles to authenticated;

-- 5. When someone signs up, create their profile automatically
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
