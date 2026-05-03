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

P1-1: swapped the model from the legacy `claude-opus-4-5` alias to `claude-sonnet-4-6`. The shipped ID still works but the Anthropic docs list it under "Legacy models" as of 2026-05-02, so the agent was quietly running on a non-default tier. Sonnet 4.6 is the docs' recommended speed-and-intelligence default and is roughly 60% the per-token price of Opus, which matters at 5,000/day. Dropping a further tier to Haiku 4.5 is materially cheaper again, but I would not make that quality call unilaterally on a fixture set this small with `tkt_1007` as a known adversarial input; flagged for the team in product questions instead.

P1-2: added an explicit guard for `ANTHROPIC_API_KEY` at startup. The SDK accepts a `string | null | undefined` apiKey and only fails deep inside the first request, which is exactly the kind of slow-failing config bug that wastes time on first run and looks like a network problem in production. A clean `console.error` plus `process.exit(1)` before any network call or file read is the cheap fix the rule (C-6) was asking for.

P1-3: replaced the `while (true)` loop with a counted loop capped at ten iterations. AL-1 calls this out as unshippable and the math at 5,000/day says even a small rate of stuck loops is real money: on Sonnet 4.6 with `max_tokens: 4096`, a stuck ticket can burn ~$0.70 in output before something else kills it, against ~$0.012 for a healthy one. On overflow the function returns a structured `TriageResult` with `needs_human: true` and a new optional `error` field (`"max_iterations_exceeded"`) so the team can grep `results.json` for the failure mode rather than infer it from the absence of a draft reply. The cap value of ten is generous for a triage workload (the healthy path needs three turns at most). The overflow `priority: "high"` is a placeholder I have flagged for the team rather than choose unilaterally.

P1-4: replaced the single `if (end_turn)` check with an explicit `switch` on `stop_reason`, per AL-3. Pre-fix, anything that wasn't `end_turn` (max_tokens, pause_turn, refusal, stop_sequence) fell into the tool-dispatch branch and either looped silently or pushed garbage back to the model. The new `default` branch escalates as `needs_human` with `error: "stop_reason:<value>"`, so the failure mode is visible in `results.json` rather than buried in token spend. I escalate on max_tokens rather than retry with a higher cap because hitting 4096 output on a triage classification means the model has gone off-script (probably drafting a long reply), and a human should look. Same logic as the P1-3 overflow path.

### Phase 2: quality and hygiene

(in progress)

### Phase 3: scale

(in progress)

### Phase 4: tests

(in progress)

## What I'd fix next

Nothing scoped out yet. Items will land here as I make those calls.

## Product / team decisions

Questions I'd want to raise with the team before changing behaviour unilaterally. The ones I expect to surface across Phase 1 are how to handle customer IDs the lookup tool doesn't recognise, the policy when the model returns a malformed final answer (retry, escalate, or both), and whether to default to a smaller model for triage with escalation to a larger one. P1-1 made the latter concrete: Sonnet 4.6 is the safe default but Haiku 4.5 is roughly a third of the cost again, and worth running an offline eval on (including `tkt_1007`) before swapping. P1-3 added one more: when the agent fails to converge within the iteration cap and routes the ticket to a human, what priority should the operations team see it at? `high` is my current placeholder; `urgent` would say look now, `medium` would say do not pollute the urgent queue with infrastructure failures.

## Tools I used

Claude Code as the editor and harness. Context7 was my first choice for verifying the current Anthropic model IDs against the SDK, per CLAUDE.md AL-2. The MCP server was returning network errors on 2026-05-02 when I needed it for P1-1, so I went to the alternative the rule names: the Anthropic docs at platform.claude.com/docs/en/about-claude/models/overview. The verification date is recorded in the commit body for P1-1. I will add anything else here as I use it.
