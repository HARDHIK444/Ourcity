-- OurCity: read-only security check. It changes nothing. Run before going live.

-- 1. Every table below should show rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- 2. All rules (policies). Read them: nothing should let "anyone" write.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 3. Who is an admin? Only people you trust should appear.
select p.id, p.display_name, u.email, p.role
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';
