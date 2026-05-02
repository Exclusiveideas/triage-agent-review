# Triage Agent — Code Review & Fix Exercise

## Context

You're joining a small team that built a Claude-powered support ticket triage agent. The first version was shipped quickly to validate the idea — it works on the happy path, but the team knows it's rough. Before they scale it from ~50 tickets/day to ~5,000/day, they want a senior engineer to review it and fix what matters most.

You have **90 minutes**.

## What's in this repo

- `src/triage.ts` — the agent: reads tickets, calls Claude with tool use, writes results.
- `src/types.ts` — type definitions.
- `data/tickets.json` — sample tickets the agent processes.

The agent uses the Anthropic SDK with two tools (`lookup_customer`, `search_knowledge_base`) and runs an agentic loop until Claude returns a final answer.

## Your task

1. **Review the code.** Identify problems — bugs, design issues, missing safeguards, anything that would worry you in production.
2. **Fix what you consider most important.** You probably won't have time to fix everything; that's the point.
3. **Write a short `NOTES.md`** explaining:
   - What you found (briefly)
   - What you fixed and why you prioritized those
   - What you'd fix next, given more time
   - Anything you'd want to discuss with the team before changing (e.g. product decisions, not just code)

We care more about **judgment and reasoning** than about how many lines you change. A small, well-justified set of fixes with a thoughtful NOTES.md beats a sprawling rewrite.

## Ground rules

- You can use any docs, search, or AI assistant you'd normally use. Tell us in `NOTES.md` what you used.
- You don't need to actually run the code against the live API — reasoning about the code is fine. If you do want to run it, set `ANTHROPIC_API_KEY` and use `npm install && npm start`.
- Feel free to add dependencies, restructure files, or add tests if you think it's worth the time.
- If something is genuinely ambiguous (a product decision, not a code decision), note it in `NOTES.md` rather than guessing.

## What we're looking for

- How you prioritize when you can't fix everything
- Whether you catch the non-obvious problems, not just the obvious ones
- How you reason about LLM-specific failure modes
- Code quality on whatever you do change
- Clarity of communication in `NOTES.md`

Good luck.
