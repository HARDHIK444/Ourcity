-- OurCity step 6b: admins move a report ONE step at a time,
-- and every step needs 1 to 3 proof photos plus a geotag.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run (after 05)

-- 1. New columns: up to 3 evidence photos, and where the admin was (the geotag)
alter table public.post_updates add column if not exists evidence_urls text[] not null default '{}';
alter table public.post_updates add column if not exists lat double precision;
alter table public.post_updates add column if not exists lng double precision;

-- 2. Rules for NEW updates (older test rows are left alone: "not valid")
alter table public.post_updates
  add constraint proof_photos_1_to_3 check (cardinality(evidence_urls) between 1 and 3) not valid;
alter table public.post_updates
  add constraint geotag_required check (lat is not null and lng is not null) not valid;

-- 3. Only the NEXT step is allowed: reported -> under_review -> in_progress -> resolved
create or replace function public.enforce_status_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  steps text[] := array['reported','under_review','in_progress','resolved'];
  cur text;
begin
  select status into cur from public.posts where id = new.post_id;
  if array_position(steps, new.status) is distinct from array_position(steps, cur) + 1 then
    raise exception 'A report must move one step at a time. Current status: %, so the next must be: %',
      cur, coalesce(steps[array_position(steps, cur) + 1], 'none (already resolved)');
  end if;
  return new;
end;
$$;

drop trigger if exists check_status_order on public.post_updates;
create trigger check_status_order
  before insert on public.post_updates
  for each row execute function public.enforce_status_order();
