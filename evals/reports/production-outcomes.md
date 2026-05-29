# LifeOS Production Outcomes Report

- Generated: _(no data yet — first run will overwrite this file)_
- Source: `ai_suggestions` + `suggestion_outcomes` (see migration 0004)
- Window: 14 days
- Kill threshold: agent completion-rate < baseline − 3.0 pp
- Min arm size: 30 suggestions with outcome

## What this report is for

Unlike the synthetic eval suites in `evals/cases/`, this report measures **real user outcomes**: did suggestions the AI produced actually lead to completed routine blocks?

It is the single artefact that answers the kill/keep question for any task with both a `single_shot` and `agent` variant. The hypothesis is documented in `src/db/migrations/0004_ai_suggestions.sql`.

## How to generate

The data source is the on-device SQLite DB (the source of truth for both tables). Production-outcomes generation is therefore not part of the Jest eval run. Pipeline:

1. Export `ai_suggestions` + `suggestion_outcomes` from a user's device (or from an aggregated backend if one is added later) as JSON.
2. Pass the rows through `renderProductionOutcomesMarkdown` in [`src/ai/productionOutcomes.ts`](../../src/ai/productionOutcomes.ts).
3. Write the result to this file.

Until the export path is wired up, this file stays a stub.

## Verdict by task

| Task | Single-shot n / rate | Agent n / rate | Verdict |
|---|---|---|---|
| _(no data)_ | — | — | ⚪ no suggestions logged yet |

## Notes

- `domain_score_delta` is captured in `suggestion_outcomes` for context but is NOT the kill/keep metric — it is too noisy at the individual level.
- Suggestions without a 14-day outcome row are counted in `n` but excluded from `n / rate`.
