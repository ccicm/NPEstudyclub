# NPE Study Club

Private study hub for approved provisional psychologists preparing for the National Psychology Exam.

## Deployment

* **App:** Vercel (Next.js)
* **Database:** Supabase PostgreSQL
* **File Storage:** DigitalOcean Spaces (resource files) + Supabase DB metadata
* **Auth:** Supabase Auth (password-first, with email confirm/reset flows)
* **Domain:** https://npestudyclub.online
* **GitHub:** GitHub Education Package active - prioritise included products where possible

## Development

See [npe-web/README.md](npe-web/README.md) for local setup and contribution guidelines.

## Quick Links

* **App:** https://npestudyclub.online
* **Supabase Project:** https://supabase.com (see .env.local for credentials)
* **Vercel Dashboard:** https://vercel.com

## Features

* Access request form with easy approval workflow
* Auth flows for approved members
* Private resource library with advanced filtering and completion tracking
* Community channels with thread detail, nested replies, and upvotes
* Quiz browser, quiz-taking flow, quiz uploads, and quiz history
* NPE quiz pipeline with seeded JSON question sets, weekday commute-friendly daily availability, result explanations, explanation voting, and delayed moderator review threads
* Question generator improvement plan for reducing repetitive templated content: [QUESTION_GENERATOR_PLAN.md](QUESTION_GENERATOR_PLAN.md)
* Study plan onboarding, generated weekly timeline, and study-time logging
* Insights from quizzes, logged study hours, etc., to inform targeted insights and user suggestions
* Schedule calendar with NPE exam windows and ad-hoc sessions

## Architecture

* **Frontend:** Next.js 16+ (App Router) with React 19
* **Styling:** Tailwind CSS + Radix UI components
* **Backend:** Supabase serverless PostgreSQL
* **Deployment:** Vercel (auto-deploys on push to main)

## License

Private repository for authorized members only.

