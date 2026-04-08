# NPE Study Club

Private study hub for approved provisional psychologists preparing for the National Psychology Exam.

## What It Does

- Requests access through a manual approval flow.
- Sends approved members to the private app.
- Provides filtered resources with completion tracking and signed-file access.
- Provides channel-based community discussion with thread detail, nested replies, and upvotes.
- Provides quiz browsing, quiz-taking flow, quiz uploads, and personal quiz history.
- Provides study plan onboarding, generated weekly focus, study-time logging, and plan regeneration.
- Shows schedule calendar with NPE window highlights and ad-hoc session creation.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`.
3. Set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Set `NEXT_PUBLIC_SITE_URL` to your local or production URL.
5. Run the schema in order:
	- `supabase/001_npe_schema.sql`
	- `supabase/002_feature_upgrade.sql`
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
- If the domain is registered at Namecheap, set DNS to Namecheap default DNS and add Vercel's records:
	- `A` record for `@` -> `76.76.21.21`
	- `CNAME` record for `www` -> `cname.vercel-dns.com`
	- Remove any conflicting `A`, `CNAME`, or URL redirect records for `@` and `www`
- Set `npestudyclub.online` as the primary domain in Vercel and wait for HTTPS to finish provisioning.

## Main Routes

- `/` public landing page
- `/auth/request` access request form
- `/auth/login` magic-link sign in
- `/auth/request-status` pending approval notice
- `/dashboard` member overview
- `/resources` resource library
- `/add` resource upload form
- `/community` private discussion board
- `/community/[threadId]` thread detail view
- `/schedule` session list
- `/quizzes` quiz browser
- `/quizzes/[id]` quiz-taking route
- `/quizzes/add` add quiz form
- `/quizzes/results` member quiz history
- `/study-plan` study plan onboarding + dashboard
- `/profile` member progress view

## Notes

- Member routes are protected and redirect unauthenticated users to sign in.
- Approved status is checked against the `approved_users` table.
- Resource files are stored in the private `resources` bucket and exposed with signed URLs.