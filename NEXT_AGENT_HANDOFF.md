# Next Agent Handoff

Last updated: 2026-04-10 (plan integrated)

Use [MASTER_PLAN.md](MASTER_PLAN.md) as the source of truth. This file is the execution checklist for the next session.

## Current state snapshot

- UX + copy: in progress.
- Auth/member UX completed:
  - Request-status state rendering is complete.
  - Major user-facing technical error copy is simplified across core member/auth/community/admin surfaces.
  - Profile stale progress section is removed.
- Resources + schedule completed:
  - Resource list cap is raised to 1000.
  - Dashboard timeline uses study-plan exam date when available.
  - Schedule prompts users to create a study plan when missing.
- Quizzes completed:
  - Quiz review flow enforces sequential explanation rating before completion.
  - Min-vote escalation guard is implemented in SQL and migration files.
- Migration CI status:
  - Migration workflow exists but rollout is deferred pending verified pooler DB URL secret.

## Next agent plan (ordered)

1. Unblock migration workflow using verified Session pooler `SUPABASE_DB_URL` and run min-vote migration.
2. Verify quiz moderation behavior after migration (single downvote must not escalate).
3. Run targeted regression checks on changed routes.
4. Complete remaining UX P2/P3 cleanup pass.
5. Finish production-facing copy consistency pass.
6. Update docs/status after each completed block.

## 1) Quiz moderation rollout (P1)

- Apply min-vote guard SQL changes in environment(s):
  - `npe-web/supabase/006_explanation_feedback_settings.sql`
  - `npe-web/supabase/007_noticeboard_publish_windows.sql`
  - `supabase/migrations/20260410000015_escalation_min_votes.sql`
- Verify quiz behavior after migration:
  - One downvote cannot escalate.
  - Ratio checks run only after minimum vote count.
  - Existing explanation vote flow still records feedback successfully.

## 2) UX P2/P3 cleanup

- Standardize resource file action verb to `Download` or `View` consistently.
- Simplify resource search placeholder to `Search resources…`.
- Add helper text in add-resource form when category reveals metadata fields.
- Rename PSY label/copy to `AHPRA registration number` on request flow.
- Rename ambiguous community channel label (`Technical`) to a clearer label.
- Clarify admin self-approval helper copy and button label.
- Confirm dashboard/account label tone adjustments if still pending.

## 3) High-priority infra/product follow-up

- `SUPABASE_DB_URL` must be a full Postgres DSN (`postgres://...` or `postgresql://...`), not API URL/key.
- For this runner/network setup, use Session pooler host, not direct `db.<ref>.supabase.co`.
- Keep resources page at limit 1000; add follow-up for server-side pagination/filtering.
- Prepare and execute controlled bulk resource upload once storage verification is green.
- Capture batch upload outcomes (success/failure counts and retry list) in status docs.
- Decide whether non-resource list caps still at 200 (community/quizzes) should be raised or intentionally scoped.
- Prepare migration 014 rollout dependencies (status field + policy changes), but do not apply production SQL from agent unless requested.

## 4) Regression checklist before handoff

- Auth path:
  - Request access submit and validation messaging.
  - Request-status CTA behavior for signed-out, pending, approved.
- Member path:
  - Dashboard renders with and without study plan.
  - Resources empty states (true-empty vs filter-empty).
  - Schedule no-plan prompt visibility.
- Community path:
  - Thread/report feedback messages remain user-safe.
- Admin path:
  - Access request list loads and actions still work in configured environments.

## 5) Documentation update requirements

After implementation/testing, update all three:

- [MASTER_PLAN.md](MASTER_PLAN.md)
- [REFACTOR_STATUS.md](REFACTOR_STATUS.md)
- [docs/UX_AUDIT_NPE_STUDY_CLUB.md](docs/UX_AUDIT_NPE_STUDY_CLUB.md)

## Guardrails

- Do not reintroduce developer diagnostics in member-facing UI.
- Keep technical diagnostics internal (logs/admin), not inline for members.
- Avoid unrelated refactors while finishing this UX block.
- Do not run destructive git commands.

## Integrated notes from prior offline plan

The earlier offline implementation spec has been integrated into the sections above and into `MASTER_PLAN.md` priorities. Treat this handoff + `MASTER_PLAN.md` as canonical for execution order.
