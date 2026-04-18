export type TicketType = "bug" | "feature_request";
export type TicketStatus =
  | "todo"
  | "in_progress"
  | "pending"
  | "in_testing"
  | "done";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketProduct =
  | "vetra"
  | "gym_pocket"
  | "trackit"
  | "aqua"
  | "lumos"
  | "other";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  email_on_assigned: boolean;
  email_on_new_ticket: boolean;
  email_on_mention: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: number;
  title: string;
  description: string | null;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  requester_id: string;
  assignee_id: string | null;
  environment_url: string | null;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  discord_thread_id: string | null;
  discord_message_id: string | null;
  product: TicketProduct;
  created_at: string;
  updated_at: string;
  // Joined fields
  requester?: Profile;
  assignee?: Profile;
  attachments?: TicketAttachment[];
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  filename: string;
  url: string;
  size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  attachments?: { url: string; filename: string }[];
  created_at: string;
  updated_at: string;
  user?: Profile;
}

export interface ActivityLog {
  id: string;
  ticket_id: string;
  user_id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user?: Profile;
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  pending: "Pending",
  in_testing: "In Testing",
  done: "Done",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  bug: "Bug",
  feature_request: "Feature",
};

export const TICKET_STATUS_ORDER: TicketStatus[] = [
  "todo",
  "in_progress",
  "pending",
  "in_testing",
  "done",
];

export const TICKET_PRODUCT_LABELS: Record<TicketProduct, string> = {
  vetra: "Vetra",
  gym_pocket: "Gym Pocket",
  trackit: "TrackIt",
  aqua: "Aqua",
  lumos: "Lumos",
  other: "Other",
};

export const TICKET_PRODUCT_ICON_PATHS: Partial<Record<TicketProduct, string>> =
  {
    vetra: "/products/vetra.svg",
    gym_pocket: "/products/gym-pocket.svg",
    trackit: "/products/trackit.svg",
    aqua: "/products/aqua.svg",
    lumos: "/products/lumos.svg",
  };

// ─── Workflows ────────────────────────────────────────────────────────────────

export type WorkflowStepType = "status" | "priority" | "assignee" | "comment";

export interface WorkflowStep {
  type: WorkflowStepType;
  // status → TicketStatus value, priority → TicketPriority, assignee → profile id or null, comment → text
  value: string | null;
}

export interface TicketWorkflow {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  steps: WorkflowStep[];
  icon: string; // lucide icon name, e.g. 'Zap'
  icon_color: string; // hex color, e.g. '#6366f1'
  created_at: string;
  updated_at: string;
}
