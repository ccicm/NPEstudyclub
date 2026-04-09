# UX Refactor Implementation Status

Last updated: April 9, 2026
Target: Complete UX and platform work from UX_REFACTOR_SPEC_v2.md

---

## Current Blocker

### Production login is blocked by deployment routing, not app auth logic

Status: BLOCKED (infrastructure)

Evidence:
- https://npestudyclub.online/auth/login returns HTTP 404 with header: x-vercel-error: DEPLOYMENT_NOT_FOUND
- https://npestudyclub.online/auth/callback returns HTTP 404 with header: x-vercel-error: DEPLOYMENT_NOT_FOUND

What this means:
- The request is not reaching the Next.js app.
- Supabase auth callback/page code is not the current failure point.
- Domain or Vercel project/deployment mapping must be fixed first.

Immediate recovery steps:
1. In Vercel, open the project that owns this repo and confirm there is an active Production deployment.
2. In Vercel Settings -> Domains, ensure npestudyclub.online is attached to that project.
3. Re-deploy main and verify the domain is assigned to the new deployment.
4. Confirm DNS still points to Vercel:
   - A @ -> 76.76.21.21
   - CNAME www -> cname.vercel-dns.com
5. Re-test /auth/login and /auth/callback after redeploy.

---

## Delivered So Far

### P1: Completed

- Landing page hero copy, tone fix, and jargon cleanup
- Launch badge removal
- Feature cards are clickable
- Access request updates:
  - PSY number capture
  - privacy collection notice
  - consent checkbox and consented_at
- Privacy page added
- Profile page now renders meaningful data
- Account settings added:
  - display name update
  - email update
  - password change link
- Dashboard first-time onboarding banner
- meet_link -> video_link completed in app code + migration support

### P2: Mostly completed

Completed:
- Schedule filter bar (All, Group, Ad-hoc, My study plan, My sessions)
- Schedule color legend
- Session type selector in add-session form
- Study plan blocks rendered on schedule
- .ics export on /schedule and /study-plan
- Quiz performance by domain on profile
- Landing page Quick links section (implemented April 9)
- Community activity summary on profile (implemented April 9)
- Community filter support for /community?author=me (implemented April 9)

Not yet completed:
- Resource edit/delete for uploader

### P3 and beyond: Not started

- Saved resources/bookmarks
- DigitalOcean Spaces migration and bulk upload
- Delete account flow
- Notification system (in-app + preferences + email)
- Expanded admin operations beyond access requests
- AI question generation and moderation pipeline

---

## Code Health

- Branch: main
- Working tree: clean after latest changes
- Build status: PASS (npm run build on April 9, 2026)

---

## Next Implementation Steps (after login unblock)

1. Community activity section on profile
2. Resource metadata edit/delete for uploader
3. Saved resources schema + toggle UI
4. Saved resources section on profile
