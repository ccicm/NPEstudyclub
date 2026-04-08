# NPE Study Club

Private study hub for approved provisional psychologists preparing for the National Psychology Exam.

## What It Does

- Requests access through a manual approval flow.
- Sends approved members to the private app.
- Lists private resources from Supabase Storage.
- Lets approved members add resources and post community replies.
- Shows upcoming sessions and the latest uploads on the dashboard.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`.
3. Set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Set `NEXT_PUBLIC_SITE_URL` to your local or production URL.
5. Run the schema in `supabase/001_npe_schema.sql`.
6. Create a private Supabase Storage bucket named `resources`.
7. Add your email to `approved_users` with `status = 'approved'`.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Launch Checklist

- Enable Supabase Email auth for magic links.
- Set the Supabase Site URL to `https://npestudyclub.online`.
- Add redirect URLs for local dev and production:
	- `http://localhost:3000`
	- `https://npestudyclub.online`
- Add at least one approved user.
- Upload at least one resource and create at least one session entry.

## Domain Setup

- Connect the domain in Vercel and set it as the production domain.
- Set `NEXT_PUBLIC_SITE_URL=https://npestudyclub.online` in Vercel project settings.
- Point the Supabase auth Site URL and redirect URLs at the same domain.

## Main Routes

- `/` public landing page
- `/auth/request` access request form
- `/auth/login` magic-link sign in
- `/auth/request-status` pending approval notice
- `/dashboard` member overview
- `/resources` resource library
- `/add` resource upload form
- `/community` private discussion board
- `/schedule` session list
- `/profile` member progress view

## Notes

- Member routes are protected and redirect unauthenticated users to sign in.
- Approved status is checked against the `approved_users` table.
- Resource files are stored in the private `resources` bucket and exposed with signed URLs.