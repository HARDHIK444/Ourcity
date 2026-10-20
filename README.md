# OurCity
**Our City. Our Responsibility.** See it. Snap it. Fix it.

A community platform where citizens post local civic problems (potholes, garbage, broken streetlights...) with photos or videos, and everyone can watch the live status until it is fixed. Citizens only post and watch. They never have to contact the authority. Admins move each report step by step with proof photos and a geotag.

## Stack
- Plain HTML, CSS and JavaScript (no build step)
- Supabase: login, database, file storage and security rules

## Run it on your computer
1. Open the folder in VS Code.
2. Right-click `index.html` and choose **Open with Live Server**.

## Set up the database (once)
In Supabase, open **SQL Editor** and run the files in `supabase/` in order, `01` to `07`.
Then make the first admin with the one-line command at the bottom of `05_admin_status.sql`.

## Keys
`js/supabase.js` holds the Supabase project URL and the **publishable** key. That key is designed to be public: the security rules in the database protect the data.
**Never** put a `secret` or `service_role` key or the database password in this project.

## Rules of the site
Describe problems, never blame or name a person. Admins can remove posts or comments that break this rule.
