import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "fs";
import { Ticket, TriageResult } from "./types.js";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY environment variable is required.");
  process.exit(1);
}
const client = new Anthropic({ apiKey });

const SYSTEM_PROMPT = `You are a support ticket triage agent for a B2B SaaS company.

For each ticket, you must:
1. Categorize it (billing, bug, feature_request, account, other)
2. Assign priority (low, medium, high, urgent)
3. Decide if it needs a human or can be auto-resolved
4. If auto-resolvable, draft a reply

Use the lookup_customer tool to check the customer's plan and history before deciding priority.
Enterprise customers should generally get higher priority than free-tier customers.

Return your final answer as JSON.`;

const tools: Anthropic.Tool[] = [
  {
    name: "lookup_customer",
    description: "Look up a customer's plan tier and recent ticket history",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
      },
      required: ["customer_id"],
    },
  },
  {
    name: "search_knowledge_base",
    description: "Search internal docs for solutions to common issues",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
];

// Mocked — in real life these hit a database
function lookupCustomer(customerId: string) {
  const fixtures: Record<string, any> = {
    cust_001: { plan: "enterprise", open_tickets: 2, mrr: 4500 },
    cust_002: { plan: "free", open_tickets: 0, mrr: 0 },
    cust_003: { plan: "pro", open_tickets: 1, mrr: 199 },
  };
  return fixtures[customerId] || { plan: "unknown", open_tickets: 0, mrr: 0 };
}

function searchKnowledgeBase(query: string) {
  return {
    results: [
      { title: "Resetting your password", snippet: "Go to Settings > Account..." },
      { title: "Updating billing info", snippet: "Navigate to Billing > Payment methods..." },
    ],
  };
}

async function triageTicket(ticket: Ticket): Promise<TriageResult> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Triage this ticket:\n\nID: ${ticket.id}\nCustomer: ${ticket.customer_id}\nSubject: ${ticket.subject}\nBody: ${ticket.body}`,
    },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      const text = textBlock && textBlock.type === "text" ? textBlock.text : "";
      const result = JSON.parse(text);
      return {
        ticket_id: ticket.id,
        category: result.category,
        priority: result.priority,
        needs_human: result.needs_human,
        draft_reply: result.draft_reply,
      };
    }

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUses) {
      if (block.type !== "tool_use") continue;
      let result: any;
      if (block.name === "lookup_customer") {
        result = lookupCustomer((block.input as any).customer_id);
      } else if (block.name === "search_knowledge_base") {
        result = searchKnowledgeBase((block.input as any).query);
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }
}

async function main() {
  const tickets: Ticket[] = JSON.parse(
    readFileSync("./data/tickets.json", "utf-8")
  );

  const results: TriageResult[] = [];
  for (const ticket of tickets) {
    console.log(`Processing ${ticket.id}...`);
    const result = await triageTicket(ticket);
    results.push(result);
  }

  writeFileSync("./data/results.json", JSON.stringify(results, null, 2));
  console.log(`Processed ${results.length} tickets.`);
}

main();
