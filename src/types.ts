export const CATEGORIES = [
  "billing",
  "bug",
  "feature_request",
  "account",
  "other",
] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];

export interface Ticket {
  id: string;
  customer_id: string;
  subject: string;
  body: string;
  created_at: string;
}

export interface TriageResult {
  ticket_id: string;
  category: Category;
  priority: Priority;
  needs_human: boolean;
  draft_reply?: string;
  reasoning?: string;
  error?: string;
}
