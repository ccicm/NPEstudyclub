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
* Study plan onboarding, generated weekly timeline, and study-time logging
* Insights from quizzes, logged study hours, etc., to inform targeted insights and user suggestions
* Schedule calendar with NPE exam windows and ad-hoc sessions

## Architecture

* **Frontend:** Next.js 16+ (App Router) with React 19
* **Styling:** Tailwind CSS + Radix UI components
* **Backend:** Supabase serverless PostgreSQL
* **Deployment:** Vercel (auto-deploys on push to main)
* \# NPE Quiz Pipeline
* 
* Automated question generation for the NPE quiz platform. Generates daily (4 questions) and fortnightly (150 questions) sets via GitHub Actions, inserting directly into Supabase.
* 
* \---
* 
* \## Setup walkthrough
* 
* \### Step 1 — Add this folder to your repo
* 
* Copy the contents of this package into your existing quiz repo root. The structure should look like:
* 
* ```
* your-repo/
* &#x20; .github/
* &#x20;   workflows/
* &#x20;     generate-daily.yml
* &#x20;     generate-fortnightly.yml
* &#x20; prompts/
* &#x20;   npe-question-prompt.md
* &#x20; scripts/
* &#x20;   check-fortnightly.js
* &#x20;   generate-questions.js
* &#x20;   package.json
* &#x20;   .last-fortnightly-run
* &#x20; seed/
* &#x20;   staging/        ← generated files land here for review
* &#x20;   daily/          ← approved daily sets
* &#x20;   fortnightly/    ← approved fortnightly exams
* &#x20;   targeted/       ← manually curated targeted sets
* ```
* 
* \### Step 2 — Install dependencies locally (optional, for testing)
* 
* ```bash
* cd scripts
* npm install
* ```
* 
* \### Step 3 — Add GitHub Secrets
* 
* Go to your repo on GitHub → Settings → Secrets and variables → Actions → New repository secret
* 
* Add these three secrets:
* 
* | Secret name | Where to find it |
* |---|---|
* | `ANTHROPIC\_API\_KEY` | console.anthropic.com → API Keys |
* | `SUPABASE\_URL` | Supabase dashboard → Project Settings → API → Project URL |
* | `SUPABASE\_SERVICE\_KEY` | Supabase dashboard → Project Settings → API → service\_role key (not anon key) |
* 
* ⚠️ Use the \*\*service\_role\*\* key for Supabase, not the anon key. The service role key bypasses RLS and is needed for server-side inserts. Never expose it in client-side code.
* 
* \### Step 4 — Test with a dry run
* 
* Before the schedule kicks in, trigger a manual dry run to confirm the pipeline works:
* 
* 1\. Go to your repo → Actions tab
* 2\. Click "Generate Daily NPE Questions"
* 3\. Click "Run workflow"
* 4\. Set dry\_run to `true`
* 5\. Click "Run workflow"
* 
* Check the Action logs. You should see questions generated and a seed file written, but no Supabase insert.
* 
* \### Step 5 — Check the staging file
* 
* After a successful dry run, a file will appear in `seed/staging/` with today's date. Open it and review the questions before approving them for production.
* 
* \### Step 6 — First live run
* 
* Repeat Step 4 with dry\_run set to `false`. This will generate questions AND insert into Supabase.
* 
* \### Step 7 — Let the schedule run
* 
* \- Daily questions: every morning at 7:00am AEDT / 7:00am AEST
* \- Fortnightly exam: every second Friday at midnight AEDT / midnight AEST
* 
* \---
* 
* \## Tuning question generation
* 
* Edit `prompts/npe-question-prompt.md` to adjust:
* \- Subdomain weighting
* \- Difficulty ratios
* \- Citation requirements
* \- Vignette style
* 
* Commit changes to main — the next Action run will pick them up automatically.
* 
* \---
* 
* \## Timezone note
* 
* GitHub Actions runs on UTC. The cron schedules are set for:
* \- Daily: `0 20 \* \* \*` = 7:00am AEDT (UTC+11), active Oct–Apr
* \- Fortnightly: `0 13 \* \* 4` = midnight AEDT Friday (UTC+11)
* 
* During AEST (Apr–Oct, UTC+10), these will fire one hour early (6:00am / 11:00pm Thursday).
* To fix this seasonally, update the cron values in the workflow files:
* \- AEST daily: `0 21 \* \* \*`
* \- AEST fortnightly: `0 14 \* \* 4`
* 
* A future improvement would be a timezone-aware Lambda or Supabase Edge Function to handle DST automatically.
* 
* \---
* 
* \## Fortnightly cadence
* 
* The fortnightly check reads `scripts/.last-fortnightly-run`. On first run this is set to 2026-04-11. After each successful fortnightly generation, the Action updates this file automatically.
* 
* To manually reset or override the cadence, edit `.last-fortnightly-run` with a date in `YYYY-MM-DD` format, or use the `force\_run: true` input when triggering manually.
* 
* \---
* 
* \## Review workflow (recommended)
* 
* Generated files land in `seed/staging/`. Before they go to production:
* 
* 1\. Review the JSON in staging
* 2\. If approved, move to `seed/daily/` or `seed/fortnightly/`
* 3\. Flag any questions for revision before they go live
* 
* The flagging system (>1% of quiz takers) handles post-publication review via the community discussion board — see Supabase migration `004\_quiz\_pipeline\_upgrade.sql`.
* 

## License

Private repository for authorized members only.

