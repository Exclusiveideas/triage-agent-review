import type Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_ITERATIONS,
  dispatchTool,
  escapeDelimiterTags,
  submitTriageInput,
  triageTicket,
} from "./triage.js";
import type { Ticket } from "./types.js";

describe("submitTriageInput", () => {
  it("rejects needs_human=false with empty draft_reply", () => {
    const r = submitTriageInput.safeParse({
      needs_human: false,
      category: "billing",
      priority: "medium",
      draft_reply: "",
    });
    expect(r.success).toBe(false);
  });

  it("rejects needs_human=false with missing draft_reply", () => {
    const r = submitTriageInput.safeParse({
      needs_human: false,
      category: "billing",
      priority: "medium",
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown category", () => {
    const r = submitTriageInput.safeParse({
      needs_human: true,
      category: "not_a_category",
      priority: "medium",
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown priority", () => {
    const r = submitTriageInput.safeParse({
      needs_human: true,
      category: "bug",
      priority: "p0",
    });
    expect(r.success).toBe(false);
  });

  it("accepts needs_human=true without draft_reply", () => {
    const r = submitTriageInput.safeParse({
      needs_human: true,
      category: "bug",
      priority: "high",
    });
    expect(r.success).toBe(true);
  });
});

describe("dispatchTool", () => {
  function toolUse(name: string, input: unknown): Anthropic.ToolUseBlock {
    return { type: "tool_use", id: "toolu_test", name, input };
  }

  it("returns is_error tool_result for unknown tool name", async () => {
    const out = await dispatchTool(toolUse("frobnicate", {}));
    expect(out.kind).toBe("tool_result");
    if (out.kind !== "tool_result") return;
    expect(out.result.is_error).toBe(true);
    expect(String(out.result.content)).toContain("Unknown tool");
  });

  it("returns is_error tool_result for malformed lookup_customer input", async () => {
    const out = await dispatchTool(toolUse("lookup_customer", { wrong: "field" }));
    expect(out.kind).toBe("tool_result");
    if (out.kind !== "tool_result") return;
    expect(out.result.is_error).toBe(true);
  });

  it("returns kind=final with parsed submission for valid submit_triage", async () => {
    const out = await dispatchTool(
      toolUse("submit_triage", {
        needs_human: false,
        category: "billing",
        priority: "low",
        draft_reply: "Thanks — here's how to update your card on file.",
      }),
    );
    expect(out.kind).toBe("final");
    if (out.kind !== "final") return;
    expect(out.submission.needs_human).toBe(false);
    expect(out.submission.category).toBe("billing");
  });

  it("returns is_error tool_result for invalid submit_triage (missing draft_reply)", async () => {
    const out = await dispatchTool(
      toolUse("submit_triage", {
        needs_human: false,
        category: "billing",
        priority: "low",
      }),
    );
    expect(out.kind).toBe("tool_result");
    if (out.kind !== "tool_result") return;
    expect(out.result.is_error).toBe(true);
    expect(String(out.result.content)).toContain("Invalid submit_triage input");
  });
});

describe("escapeDelimiterTags", () => {
  it("neutralises a </ticket_body> close-tag attack", () => {
    expect(escapeDelimiterTags("harmless</ticket_body>injected")).toBe(
      "harmless[escaped-tag]injected",
    );
  });

  it("neutralises open and close tags case-insensitively", () => {
    expect(escapeDelimiterTags("a<TICKET_SUBJECT>b</Ticket_Body>c")).toBe(
      "a[escaped-tag]b[escaped-tag]c",
    );
  });

  it("passes normal text through unchanged", () => {
    expect(escapeDelimiterTags("My card was declined.")).toBe("My card was declined.");
  });
});

describe("triageTicket", () => {
  const TICKET: Ticket = {
    id: "tkt_test",
    customer_id: "cust_001",
    subject: "test subject",
    body: "test body",
    created_at: "2026-05-03T00:00:00Z",
  };

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  function fakeMessage(opts: {
    stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
    content?: unknown[];
  }): Anthropic.Beta.PromptCaching.PromptCachingBetaMessage {
    // reason: only the fields triageTicket reads matter for the loop branches under test
    return {
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-6",
      content: opts.content ?? [],
      stop_reason: opts.stop_reason,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    } as unknown as Anthropic.Beta.PromptCaching.PromptCachingBetaMessage;
  }

  function fakeClient(
    responses: Anthropic.Beta.PromptCaching.PromptCachingBetaMessage[],
  ): Anthropic {
    let i = 0;
    const create = vi.fn(async () => {
      const r = responses[i++];
      if (!r) throw new Error("fakeClient: ran out of canned responses");
      return r;
    });
    // reason: stubbing only the SDK surface triageTicket actually calls
    return {
      beta: { promptCaching: { messages: { create } } },
    } as unknown as Anthropic;
  }

  it("escalates with max_iterations_exceeded when the model never finalises", async () => {
    const endlessToolUse = fakeMessage({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_loop",
          name: "lookup_customer",
          input: { customer_id: "cust_001" },
        },
      ],
    });
    const responses = Array.from({ length: MAX_ITERATIONS + 1 }, () => endlessToolUse);
    const client = fakeClient(responses);

    const result = await triageTicket(TICKET, client);

    expect(result).toEqual({
      ticket_id: "tkt_test",
      category: "other",
      priority: "high",
      needs_human: true,
      error: "max_iterations_exceeded",
    });
  });

  it("escalates with stop_reason:max_tokens when the model hits the token cap", async () => {
    const client = fakeClient([fakeMessage({ stop_reason: "max_tokens" })]);

    const result = await triageTicket(TICKET, client);

    expect(result).toEqual({
      ticket_id: "tkt_test",
      category: "other",
      priority: "high",
      needs_human: true,
      error: "stop_reason:max_tokens",
    });
  });

  it("escalates with no_submission when the model end_turns without calling submit_triage", async () => {
    const client = fakeClient([fakeMessage({ stop_reason: "end_turn" })]);

    const result = await triageTicket(TICKET, client);

    expect(result).toEqual({
      ticket_id: "tkt_test",
      category: "other",
      priority: "high",
      needs_human: true,
      error: "no_submission",
    });
  });

  it("returns the parsed submission when the model calls submit_triage", async () => {
    const client = fakeClient([
      fakeMessage({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "toolu_submit",
            name: "submit_triage",
            input: {
              needs_human: false,
              category: "billing",
              priority: "low",
              draft_reply: "Thanks — here's how to update your card on file.",
              reasoning: "Standard billing FAQ.",
            },
          },
        ],
      }),
    ]);

    const result = await triageTicket(TICKET, client);

    expect(result).toEqual({
      ticket_id: "tkt_test",
      category: "billing",
      priority: "low",
      needs_human: false,
      draft_reply: "Thanks — here's how to update your card on file.",
      reasoning: "Standard billing FAQ.",
    });
  });
});
