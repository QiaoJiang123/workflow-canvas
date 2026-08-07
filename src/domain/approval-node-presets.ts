import type { ApprovalChainType, NodeStatus } from "./types";

export type ApprovalSquareGroup = "Intake" | "Review" | "Approval" | "Exception" | "Notification" | "Audit";

export interface ApprovalSquareData extends Record<string, unknown> {
  creator: string;
  approver: string;
  approvalType: string;
  description: string;
  status: string;
  dueDate: string;
  decision: string;
  comments: string;
  auditTrail: Array<{ at: string; actor: string; action: string; note?: string }>;
  documents: unknown[];
  instructions: string;
}

export interface ApprovalSquarePreset {
  id: string;
  group: ApprovalSquareGroup;
  label: string;
  description: string;
  definitionId: string;
  status?: NodeStatus;
  configuration: Record<string, unknown>;
}

export const APPROVAL_SQUARE_PRESETS: ApprovalSquarePreset[] = [
  {
    id: "request-intake",
    group: "Intake",
    label: "Request Intake",
    description: "Capture the approval request, requester, business reason, and decision needed.",
    definitionId: "review-document",
    status: "not_started",
    configuration: {
      approvalType: "Request Intake",
      documentType: "request",
      summary: "Initial request package and business context."
    }
  },
  {
    id: "evidence-packet",
    group: "Intake",
    label: "Evidence Packet",
    description: "Collect PDFs, SOPs, checklists, contracts, or other review documents.",
    definitionId: "review-document",
    status: "not_started",
    configuration: {
      approvalType: "Evidence Packet",
      documentType: "packet",
      summary: "Documents the approver needs before review."
    }
  },
  {
    id: "completeness-check",
    group: "Intake",
    label: "Completeness Check",
    description: "Validate the request has owner, due date, documents, risk, and approver path.",
    definitionId: "data-validation",
    status: "not_started",
    configuration: {
      approvalType: "Completeness Check",
      rules: "Owner, due date, evidence packet, risk level, and approver path are present."
    }
  },
  {
    id: "data-owner-review",
    group: "Review",
    label: "Data Owner Review",
    description: "Data owner verifies data use, lineage, classification, and downstream impact.",
    definitionId: "human-review",
    status: "not_started",
    configuration: {
      approvalType: "Data Owner Review",
      reviewer: "",
      reviewCriteria: "Review data ownership, lineage, quality impact, access, and retention."
    }
  },
  {
    id: "engineering-review",
    group: "Review",
    label: "Engineering Review",
    description: "Technical reviewer checks implementation, deployment, rollback, and support readiness.",
    definitionId: "human-review",
    status: "not_started",
    configuration: {
      approvalType: "Engineering Review",
      reviewer: "",
      reviewCriteria: "Review design, dependencies, rollout plan, observability, and rollback."
    }
  },
  {
    id: "security-review",
    group: "Review",
    label: "Security Review",
    description: "Security reviewer checks access, secrets, data handling, vendor risk, and residual risk.",
    definitionId: "human-review",
    status: "not_started",
    configuration: {
      approvalType: "Security Review",
      reviewer: "",
      reviewCriteria: "Review access control, secrets, data exposure, vendor risk, and logging."
    }
  },
  {
    id: "compliance-review",
    group: "Review",
    label: "Compliance Review",
    description: "Compliance reviewer checks policy evidence, controls, audit trail, and obligations.",
    definitionId: "human-review",
    status: "not_started",
    configuration: {
      approvalType: "Compliance Review",
      reviewer: "",
      reviewCriteria: "Review policy fit, required evidence, controls, auditability, and obligations."
    }
  },
  {
    id: "legal-review",
    group: "Review",
    label: "Legal Review",
    description: "Legal reviewer checks contract language, notices, retention, and approval conditions.",
    definitionId: "human-review",
    status: "not_started",
    configuration: {
      approvalType: "Legal Review",
      reviewer: "",
      reviewCriteria: "Review legal wording, contract terms, retention, notice, and conditions."
    }
  },
  {
    id: "finance-review",
    group: "Review",
    label: "Finance Review",
    description: "Finance reviewer checks budget, business value, cost center, and approval threshold.",
    definitionId: "human-review",
    status: "not_started",
    configuration: {
      approvalType: "Finance Review",
      reviewer: "",
      reviewCriteria: "Review budget, cost center, value, funding source, and threshold."
    }
  },
  {
    id: "executive-approval",
    group: "Approval",
    label: "Executive Approval",
    description: "Final business owner or executive approval before release or purchase.",
    definitionId: "approval",
    status: "not_started",
    configuration: {
      approvalType: "Executive Approval",
      approver: "",
      approvalCriteria: "Prior reviews are complete and residual risks are accepted."
    }
  },
  {
    id: "conditional-approval",
    group: "Approval",
    label: "Conditional Approval",
    description: "Approve with conditions, follow-up actions, or required mitigations.",
    definitionId: "approval",
    status: "needs_review",
    configuration: {
      approvalType: "Conditional Approval",
      approver: "",
      approvalCriteria: "Required conditions are documented with owners and due dates."
    }
  },
  {
    id: "rework-required",
    group: "Exception",
    label: "Rework Required",
    description: "Send the request back for changes before approval can continue.",
    definitionId: "escalation",
    status: "blocked",
    configuration: {
      approvalType: "Rework Required",
      escalationPolicy: "Return to creator with specific missing evidence or required changes."
    }
  },
  {
    id: "notify-requester",
    group: "Notification",
    label: "Notify Requester",
    description: "Notify the creator, requester, or team about approval status.",
    definitionId: "notification",
    status: "not_started",
    configuration: {
      approvalType: "Notification",
      channel: "Email or Teams"
    }
  },
  {
    id: "audit-record",
    group: "Audit",
    label: "Audit Record",
    description: "Store the approval decision, documents, reviewers, and timestamps.",
    definitionId: "report",
    status: "not_started",
    configuration: {
      approvalType: "Audit Record",
      cadence: "On approval decision"
    }
  }
];

export function getApprovalSquarePreset(id: string) {
  return APPROVAL_SQUARE_PRESETS.find((preset) => preset.id === id);
}

export function getApprovalSquareGroups() {
  return APPROVAL_SQUARE_PRESETS.reduce<Record<ApprovalSquareGroup, ApprovalSquarePreset[]>>(
    (groups, preset) => ({ ...groups, [preset.group]: [...groups[preset.group], preset] }),
    {
      Intake: [],
      Review: [],
      Approval: [],
      Exception: [],
      Notification: [],
      Audit: []
    }
  );
}

export function buildApprovalSquareConfiguration(input: {
  label: string;
  description: string;
  creator?: string;
  approver?: string;
  approvalType?: string;
  status?: string;
  dueDate?: string;
  decision?: string;
  comments?: string;
  instructions?: string;
  documents?: unknown[];
  actor?: string;
}): ApprovalSquareData {
  const now = new Date().toISOString();
  return {
    creator: input.creator ?? "",
    approver: input.approver ?? "",
    approvalType: input.approvalType || input.label,
    description: input.description,
    status: input.status ?? "not_reviewed",
    dueDate: input.dueDate ?? "",
    decision: input.decision ?? "",
    comments: input.comments ?? "",
    auditTrail: [{ at: now, actor: input.actor || input.creator || "System", action: "created", note: input.label }],
    documents: input.documents ?? [],
    instructions: input.instructions ?? input.description
  };
}

export function normalizeApprovalSquareData(
  configuration: Record<string, unknown>,
  fallback: { label: string; description?: string; owner?: string; workflowOwner?: string; approvalChainType?: ApprovalChainType }
): ApprovalSquareData {
  const label = firstText(configuration.approvalType, configuration.documentType, fallback.label);
  const description = firstText(
    configuration.description,
    fallback.description,
    configuration.instructions,
    configuration.reviewCriteria,
    configuration.approvalCriteria,
    configuration.summary,
    label
  );
  return {
    creator: firstText(configuration.creator, fallback.owner, fallback.workflowOwner),
    approver: firstText(configuration.approver, configuration.assignee, configuration.reviewer),
    approvalType: label,
    description,
    status: firstText(configuration.status, configuration.approvalStatus, "not_reviewed"),
    dueDate: firstText(configuration.dueDate),
    decision: firstText(configuration.decision),
    comments: firstText(configuration.comments),
    auditTrail: Array.isArray(configuration.auditTrail) ? configuration.auditTrail.filter(isAuditEntry) : [],
    documents: Array.isArray(configuration.documents) ? configuration.documents : [],
    instructions: firstText(configuration.instructions, configuration.reviewCriteria, configuration.approvalCriteria, description)
  };
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function isAuditEntry(value: unknown): value is ApprovalSquareData["auditTrail"][number] {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<ApprovalSquareData["auditTrail"][number]>;
  return typeof entry.at === "string" && typeof entry.actor === "string" && typeof entry.action === "string";
}
