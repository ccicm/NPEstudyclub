# Migration Steps (Apps Script -> NPE Study Club Site)

## Goal

Move member UX fully onto your own site while keeping costs at zero.

## Phase 1: Stand up Supabase (free)

1. Create Supabase project.
2. Run `supabase-schema.sql`.
3. Keep Email auth enabled.
4. Create private storage bucket `npe-study-club-files`.
5. Add storage RLS policies from SQL comments.

## Phase 2: Deploy member starter

1. Copy `public/config.example.js` to `public/config.js`.
2. Fill Supabase URL + anon key.
3. Deploy `public/` to:
   - GitHub Pages, or
   - Netlify/Vercel free.

Recommended subdomain: `studyclub.connorconkeymorrison.com`.

## Phase 3: Data migration

1. Export Register sheet -> CSV.
2. Map fields into `resources` table.
3. Export Sessions sheet -> CSV.
4. Map fields into `sessions` table.
5. Export Approved Users -> insert into `approved_users` with status.

## Phase 4: File migration

1. Keep source files in private Google Drive initially.
2. Optional: gradually move to Supabase Storage bucket (`npe-study-club-files`).
3. Update `resources.file_path` to new storage paths.

## Phase 5: Cutover

1. Update your Clinical Resources page to point member login to new member site.
2. Keep request form active on your site.
3. Freeze Apps Script uploads once Supabase upload path is ready.
4. Leave Apps Script as rollback for 1-2 weeks.

## Phase 6: Decommission old UI

1. Remove direct user links to Apps Script.
2. Keep Apps Script scripts archived only for fallback.
3. Continue all member operations on the new member site.

## Optional next improvements

1. Add admin dashboard for approvals.
2. Add upload form to `member.html`.
3. Add session calendar view.
4. Add search + filter UX equivalent to old app.
