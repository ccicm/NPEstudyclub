# NPE Study Club

Private study hub for approved provisional psychologists preparing for the National Psychology Exam.

## Deployment

- **App:** Vercel (Next.js)
- **Database:** Supabase PostgreSQL
- **File Storage:** Supabase Storage (private `resources` bucket)
- **Auth:** Supabase Auth (magic-link & password-based)
- **Domain:** https://npestudyclub.online

## Development

See [npe-web/README.md](npe-web/README.md) for local setup and contribution guidelines.

## Quick Links

- **App:** https://npestudyclub.online
- **Launch Checklist:** [npe-web/LAUNCH-TONIGHT.md](npe-web/LAUNCH-TONIGHT.md)
- **Supabase Project:** https://supabase.com (see .env.local for credentials)
- **Vercel Dashboard:** https://vercel.com

## Features

- Requests an access form with manual approval workflow
- Magic-link sign in for approved members
- Private resource library with file uploads to Supabase Storage
- Community discussion board
- Session schedule and progress tracking
- Theme switcher (light/dark mode)

## Architecture

- **Frontend:** Next.js 16+ (App Router) with React 19
- **Styling:** Tailwind CSS + Radix UI components
- **Backend:** Supabase serverless PostgreSQL
- **Deployment:** Vercel (auto-deploys on push to main)

## License

Private repository for authorized members only.
