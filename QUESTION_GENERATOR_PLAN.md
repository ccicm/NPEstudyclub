# Question Generator Improvement Plan

## Why this exists

The current question generator is stable and token-free, but it still leans on a small bank of hardcoded templates. That makes the daily sets too repetitive and risks the same clinical shape, wording, and distractors showing up too often.

## Goals

- Increase variation without reintroducing paid API calls.
- Keep every question anchored to the local source registry.
- Preserve the current CI flow and seed-file output shape.
- Make daily and fortnightly sets feel noticeably different from each other.

## Immediate next steps

1. Expand each domain bank with more stems, scenarios, and distractor patterns.
2. Add rotation rules so the same template cannot repeat too often across adjacent daily sets.
3. Add scenario metadata, so the generator can balance risk, privacy, supervision, telehealth, and communication across runs.
4. Introduce a lightweight review score for template diversity and flag repetitive output before it is written.
5. Keep the source bank curated, but add more clause-level citations so anchors stay specific.

## Nice-to-have follow-ups

- Move from single-template questions to small scenario blueprints with interchangeable details.
- Add a generator test that checks for repeated stems, repeated correct-answer placement, and repeated distractor language.
- Capture set-level summaries in the seed file so review is easier.
- Create a simple change log for new template additions.

## Working rule

If a change improves variety but weakens traceability to the source registry, it should be rejected.

## Tomorrow handoff for the next agent

Pick this up with a fresh agent and finish the polish pass only after reviewing the current generator outputs end to end.

1. Run the generator against a few adjacent days and compare stems, distractors, and answer positions.
2. Add more domain-specific scenario blueprints where repetition is still obvious.
3. Keep the source registry checks intact while widening template variety.
4. Update the plan if any new repetition patterns show up during review.
5. Stop short of any paid API integration unless the local bank work clearly stalls.
