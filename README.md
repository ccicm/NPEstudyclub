# NPE Study Club

Private study hub for approved provisional psychologists preparing for the National Psychology Exam.

## Deployment

- **App:** Vercel (Next.js)
- **Database:** Supabase PostgreSQL
- **File Storage - user info:** Supabase Storage (private `resources` bucket) for users
- **File Storage - resources:** Digital Ocean
- **Auth:** Supabase Auth (magic-link & password-based)
- **Domain:** https://npestudyclub.online

## Development

See [npe-web/README.md](npe-web/README.md) for local setup and contribution guidelines.

## Quick Links

- **App:** https://npestudyclub.online
- **Supabase Project:** https://supabase.com (see .env.local for credentials)
- **Vercel Dashboard:** https://vercel.com

## Features

- Access request form with manual approval workflow
- Auth flows for approved members
- Private resource library with advanced filtering and completion tracking
- Community channels with thread detail, nested replies, and upvotes
- Quiz browser, quiz-taking flow, quiz uploads, and quiz history
- Study plan onboarding, generated weekly timeline, and study-time logging
- Schedule calendar with NPE exam windows and ad-hoc sessions

## Architecture

- **Frontend:** Next.js 16+ (App Router) with React 19
- **Styling:** Tailwind CSS + Radix UI components
- **Backend:** Supabase serverless PostgreSQL
- **Deployment:** Vercel (auto-deploys on push to main)

## License

Private repository for authorized members only.
