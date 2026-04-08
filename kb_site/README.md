# NPE Study Club Member Site (Zero-Cost Starter)

This folder is a starter for a separate member-only site (for example `studyclub.yourdomain.com`) using:
- Static hosting (GitHub Pages / Netlify / Vercel free tier)
- Supabase free tier (auth, database, storage)

## Why this setup

- Users only interact with your website UI
- No separate Apps Script web app UI for members
- Free at small-to-moderate scale

## Folder map

- `public/index.html`: public entry page (request access + sign in)
- `public/member.html`: authenticated member area
- `public/styles.css`: shared styles
- `public/config.example.js`: copy to `config.js` and fill Supabase values
- `public/app.js`: auth + data loading logic
- `supabase-schema.sql`: tables, RLS policies, and storage policy starter

## Setup steps

1. Create a new Supabase project.
2. In Supabase SQL editor, run `supabase-schema.sql`.
3. In Supabase Auth settings:
   - Keep Email sign-in enabled.
   - Add redirect URLs for your member site domain (and localhost if testing).
4. In `public/`, copy `config.example.js` to `config.js` and add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (paste your Supabase **Publishable key**)
5. Upload `public/` to a static host (or connect repo).

## DNS suggestion

- Keep main site on `connorconkeymorrison.com`
- Host member site on `studyclub.connorconkeymorrison.com`

## Notes

- This starter enforces member visibility by checking `approved_users` in SQL/RLS.
- Request submissions are public insert only and require manual approval.
- Replace placeholder branding text once confirmed.
