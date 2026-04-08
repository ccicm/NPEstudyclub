NPE Study Club - Launch Tonight Checklist

1. Environment
- Copy .env.example to .env.local.
- Set NEXT_PUBLIC_SUPABASE_URL.
- Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.

2. Database
- In Supabase SQL Editor, run supabase/001_npe_schema.sql.
- In Supabase Storage, create private bucket resources.
- Add at least one row to approved_users with your email and status='approved'.

3. Auth Settings
- In Supabase Auth providers, enable Email (magic link).
- Set Site URL to your deployment URL.
- Add redirect URLs:
  - http://localhost:3000
  - https://<your-vercel-domain>

4. Local Smoke Test
- Start dev server: npm run dev
- Test flow:
  - /auth/request submits request and redirects to /auth/request-status
  - /auth/login sends magic link
  - Approved user can access /dashboard, /resources, /community
  - Non-approved user is redirected to /auth/request-status

5. Deploy
- Push npe-web to GitHub.
- Import project into Vercel.
- Add the same env vars in Vercel project settings.
- Deploy and repeat smoke test on production URL.

6. Tonight Nice-to-have (if time remains)
- Wire /add to Supabase Storage upload and resources insert.
- Add reply posting in /community via forum_replies.
- Add signed URL View/Download actions for resource cards.
