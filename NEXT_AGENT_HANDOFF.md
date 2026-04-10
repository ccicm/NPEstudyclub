# Next Agent Handoff

Last updated: 2026-04-10

Use [MASTER_PLAN.md](MASTER_PLAN.md) as the source of truth. This file is a quick execution plan for the next session.

## Current state snapshot

- UX audit is in progress.
- Request-status state rendering is complete.
- Major user-facing technical error copy has been simplified on core member/auth/community/admin surfaces.
- Resource list cap is raised to 1000 on resources page.
- Dashboard timeline now uses study-plan exam date when available.
- Profile stale progress section is removed.
- Schedule now prompts users to create a study plan when missing.

## Next agent plan (ordered)

1. Complete remaining UX P2/P3 cleanup pass.
2. Finish production-facing copy consistency pass.
3. Run targeted regression checks on changed routes.
4. Update docs/status after each completed block.

## 1) UX P2/P3 cleanup (implementation)

- Standardize resource file action verb to `Download` or `View` consistently.
- Simplify resource search placeholder to `Search resources…`.
- Add helper text in add-resource form when category changes and reveals different metadata fields.
- Rename PSY label/copy to `AHPRA registration number` on request flow.
- Rename ambiguous community channel label (`Technical`) to a clearer label.
- Clarify admin self-approval helper copy and button label.
- Confirm dashboard/account label tone adjustments if still pending.

## 2) High-priority infra/product follow-up

- Keep resources page at limit 1000 for now; add follow-up task for server-side pagination/filtering.
- Decide whether to raise non-resource list caps still at 200 (community/quizzes) or leave intentionally scoped.
- Prepare for migration 014 rollout dependencies (status field + policy changes), but do not apply production SQL from agent unless requested.

## 3) Regression checklist before handoff

- Auth path:
	- Request access submit and validation messaging.
	- Request-status CTA state behavior for signed-out, pending, approved.
- Member path:
	- Dashboard renders with and without study plan.
	- Resources empty states (true-empty vs filter-empty).
	- Schedule no-plan prompt visibility.
- Community path:
	- Thread and report feedback messages remain user-safe.
- Admin path:
	- Access request list still loads and actions still work in configured environments.

## 4) Documentation update requirements

After implementation/testing, update all three:

- [MASTER_PLAN.md](MASTER_PLAN.md)
- [REFACTOR_STATUS.md](REFACTOR_STATUS.md)
- [docs/UX_AUDIT_NPE_STUDY_CLUB.md](docs/UX_AUDIT_NPE_STUDY_CLUB.md)

## Guardrails

- Do not reintroduce developer diagnostics in member-facing UI.
- Keep technical diagnostics internal (logs/admin), not inline for members.
- Avoid unrelated refactors while finishing this UX block.
- Do not run destructive git commands.
