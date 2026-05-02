# Triage Agent Review Notes

This is the deliverable for the triage agent code review exercise. The full punch list and the per-item workflow I followed live in `PLAN.md`; this file is the summary the brief asked for.

I'm writing this as I go rather than at the end, so most sections below are still placeholders. The five sections map to the questions in the brief.

## What I found

The full ranked list, with file and line references and the reasoning behind the ordering, is in `PLAN.md`. I'll summarise the items I actually shipped here once Phase 1 is stable. Anything I deliberately skipped will go under "what I'd fix next" with a short reason.

## What I fixed

One or two sentences per item, focused on why I prioritised it rather than restating the diff. I'm appending here per fix, not at the end.

### Phase 0: scaffolding

Before touching the agent itself I added the minimum hygiene the rest of the work needs: `.gitignore`, a strict `tsconfig.json` (with `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`), and `npm install` with the lockfile committed for reproducibility. The only source change in this phase is `src/triage.ts:1`, switching the relative import to `./types.js` because `module: NodeNext` requires the explicit extension. Not a real fix, just the cost of enabling strict typing. After this phase `npx tsc --noEmit` passes cleanly.

### Phase 1: critical correctness

(in progress)

### Phase 2: quality and hygiene

(in progress)

### Phase 3: scale

(in progress)

### Phase 4: tests

(in progress)

## What I'd fix next

Nothing scoped out yet. Items will land here as I make those calls.

## Product / team decisions

Questions I'd want to raise with the team before changing behaviour unilaterally. None yet; I expect a few during Phase 1, for example how to handle customer IDs the lookup tool doesn't recognise, the policy when the model returns a malformed final answer (retry, escalate, or both), and whether to default to a smaller model for triage with escalation to a larger one.

## Tools I used

Claude Code as the editor and harness. I'll add anything else here as I actually use it. I plan to use Context7 to verify current Anthropic model IDs against the SDK rather than guessing from memory.
