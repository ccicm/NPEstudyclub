# Launch Checklist

Production deployment steps for NPE Study Club on Vercel + Supabase.

## 1. Local Development Setup

```bash
cd npe-web
cp .env.example .env.local
npm install
npm run dev
```

In `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Project Settings > API
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — from Supabase Project Settings > API
- `NEXT_PUBLIC_SITE_URL` — `http://localhost:3000` for dev

## 2. Supabase Setup

**Database:**
- Run `supabase/001_npe_schema.sql` in SQL Editor
- Run `supabase/002_feature_upgrade.sql` in SQL Editor
- Run `supabase/003_p1_refactor.sql` in SQL Editor
- Run `supabase/004_quiz_pipeline_upgrade.sql` in SQL Editor
- Run `supabase/005_explanation_feedback.sql` in SQL Editor
- Run `supabase/006_explanation_feedback_settings.sql` in SQL Editor
- Run `supabase/007_noticeboard_publish_windows.sql` in SQL Editor
- Run `supabase/008_study_plan_enhancements.sql` in SQL Editor
- Run `supabase/009_resource_schema_guard.sql` in SQL Editor
- Run `supabase/010_resources_policy_cleanup.sql` in SQL Editor
- Optional: Run `supabase/011_bulk_onboard_members.sql` to quickly approve known members
- Verify core tables created:
   - Membership/auth flow: `approved_users`, `access_requests`
   - Resources: `resources`, `user_progress`, `comments`
   - Community: `forum_threads`, `forum_replies`, `forum_upvotes`
   - Sessions: `sessions`, `key_references`
   - Quizzes: `quizzes`, `quiz_questions`, `quiz_results`
   - Study plan: `study_plans`, `study_plan_weeks`, `study_log`

**Storage:**
- Create private bucket named `resources`

**Auth:**
- Enable Email provider (email/password sign-in and password reset)
- URL Configuration:
  - **Site URL:** `https://npestudyclub.online`
  - **Redirect URLs:**
    - `http://localhost:3000/auth/confirm`
    - `http://localhost:3000/auth/update-password`
    - `https://npestudyclub.online/auth/confirm`
    - `https://npestudyclub.online/auth/update-password`

**Seed Data:**
- Add your email to `approved_users` table with `status = 'approved'`

## 3. Local Smoke Test

```bash
npm run dev
```

Test these flows:
- [ ] `/auth/request` — submit request, redirected to `/auth/request-status`
- [ ] `/auth/login` — sign in with approved email + password
- [ ] `/dashboard` — approved user can access
- [ ] `/resources` — member-only page
- [ ] `/community` — member-only page
- [ ] `/community/[threadId]` — thread detail opens with replies
- [ ] `/schedule` — calendar view loads and allows ad-hoc session submission
- [ ] `/quizzes` — browse list loads
- [ ] `/quizzes/add` — quiz submission works with at least 4 questions
- [ ] `/quizzes/results` — results table loads after one attempt
- [ ] `/study-plan` — onboarding saves and creates weekly plan
- [ ] Non-approved email redirects to `/auth/request-status`

## 4. Vercel Deployment

**Project Setup:**
1. Push `npe-web/` to GitHub main branch
2. Import repo into Vercel as new project
3. Select root directory: `npe-web`
4. Application preset: Next.js (auto-detect)

**Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL` = `https://npestudyclub.online`

**Deploy** → Copy production URL

## 5. Domain Setup (Namecheap → Vercel)

1. **Namecheap DNS:**
   - Go to Domain Management > Advanced DNS
   - Add `A` record: Host `@`, Value `76.76.21.21`
   - Add `CNAME` record: Host `www`, Value `cname.vercel-dns.com`
   - Delete any old `A`, `CNAME`, or URL redirect records for `@` and `www`
   - Save (propagation takes 5 min–48 hours)

2. **Vercel Domain:**
   - Go to project Settings > Domains
   - Add domain: `npestudyclub.online`
   - Set as primary domain
   - Wait for SSL certificate to provision (usually 5–10 min after DNS propagates)

## 6. Production Smoke Test

Once DNS propagates and SSL is active:
- [ ] Open https://npestudyclub.online
- [ ] Landing page loads
- [ ] Request access form works
- [ ] Password sign-in flow works for approved member
- [ ] Approved user can access `/dashboard`
- [ ] Resource upload works and file opens via signed URL
- [ ] Community posting, replies, and upvotes work
- [ ] Quiz attempt saves to history
- [ ] Study plan onboarding and log-time flow work

## Emergency Bypass (if Auth Email Flows Rate-Limit)

If Supabase email throttling blocks sign-up/reset or session recovery:

**Quick Fix (8-hour bypass):**
1. Open `https://npestudyclub.online/dashboard?admin=1` once
2. Go to `https://npestudyclub.online/dashboard`
3. Works for 8 hours until cookie expires
4. To disable: open `https://npestudyclub.online/dashboard?admin=0`

**Full Fix (permanent):**
1. In Vercel Environment Variables:
   - Set `ALLOW_MEMBER_BYPASS=true`
   - (Optional) Set `BYPASS_MEMBER_EMAIL=youremail@example.com`
2. Redeploy
3. When email is stable, set `ALLOW_MEMBER_BYPASS=false` and redeploy again

## Post-Launch Tasks

- [ ] Add at least one resource in `/add` to seed the library
- [ ] Create a session in Supabase `sessions` table for schedule visibility
- [ ] Seed at least 2 key references in `key_references`
- [ ] Seed at least 1 quiz set for first-time members
- [ ] Test community posting in `/community`
- [ ] Invite and approve core members
- [ ] Monitor Vercel Analytics and Supabase logs

## Troubleshooting

**Password reset/confirm link says "otp_expired":**
- Recovery and confirmation tokens expire quickly
- Request a fresh reset/confirm email
- Check that Supabase redirect URLs match production domain
- If rate-limited, use emergency bypass above

**Login redirects to `/auth/request-status` even after approval:**
- Check `approved_users` table: email must match exactly and `status = 'approved'`
- Emails are lowercase; verify no typos

**Vercel shows 404:**
- Wait for DNS propagation (check with `dig npestudyclub.online`)
- Verify SSL certificate is active in Vercel Domains
- Check that environment variables are set in Production

**File uploads fail:**
- If using Supabase Storage mode: verify `resources` bucket exists and is private
- If using DigitalOcean Spaces mode: verify `DO_SPACES_*` vars and `RESOURCE_STORAGE_MODE=do-spaces`
- Verify user is authenticated and approved

## Storage

- **App code:** Vercel (serverless)
- **Database:** Supabase PostgreSQL (included)
- **File uploads:** DigitalOcean Spaces (preferred) or Supabase Storage fallback

For DigitalOcean mode, set:
- `DO_SPACES_KEY`
- `DO_SPACES_SECRET`
- `DO_SPACES_REGION`
- `DO_SPACES_BUCKET`
- `DO_SPACES_ENDPOINT`
- `RESOURCE_STORAGE_MODE=do-spaces`
