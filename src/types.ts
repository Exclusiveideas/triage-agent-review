export interface Ticket {
  id: string;
  customer_id: string;
  subject: string;
  body: string;
  created_at: string;
}

export interface TriageResult {
  ticket_id: string;
  category: "billing" | "bug" | "feature_request" | "account" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  needs_human: boolean;
  draft_reply?: string;
  error?: string;
}
