# Next Agent Handoff

This repo is ready for a fresh agent to continue the final polish pass tomorrow.

## What to pick up

- Review the current generator output for repetition across adjacent days.
- Expand the template bank only where the repetition is still obvious.
- Preserve the source registry checks and the current CI flow.
- Keep the work token-free unless a hard blocker appears.

## Test First

- Verify quiz upload accepts five options per question and the template matches that shape.
- Verify study-plan saves do not wipe the current plan before a successful regeneration.
- Verify study-plan logs save hours, topics covered, quiz insight, and notes.
- Verify resource progress is visible on the dashboard and no longer needs the profile page.
- Verify the profile page still links back to the dashboard overview.

## What to leave alone for now

- Do not reintroduce paid API calls.
- Do not broaden the scope beyond generator variety and final polish.
- Do not start another implementation pass without checking the existing plan first.

## Reference docs

- [QUESTION_GENERATOR_PLAN.md](QUESTION_GENERATOR_PLAN.md)
- [REFACTOR_STATUS.md](REFACTOR_STATUS.md)
- [npe-web/README.md](npe-web/README.md)
