import type { ApprovalChainType, Approver } from "./types";

export const APPROVAL_CHAIN_TYPE_OPTIONS: Array<{ id: ApprovalChainType; label: string; description: string }> = [
  {
    id: "underwriting",
    label: "Underwriting",
    description: "Business, compliance, legal, and release approvals for underwriting changes."
  },
  {
    id: "data_engineering",
    label: "Data Engineering",
    description: "Data owner, platform, security, and analytics approvals for pipeline changes."
  },
  {
    id: "project_approval",
    label: "Project Approval",
    description: "Sponsor, finance, delivery, and steering approvals for project decisions."
  },
  {
    id: "procurement",
    label: "Procurement",
    description: "Requester, budget owner, security, legal, and vendor approvals."
  },
  {
    id: "model_governance",
    label: "Model Governance",
    description: "Model owner, risk, compliance, and production release approvals."
  }
];

export const DEFAULT_APPROVERS: Approver[] = [
  {
    id: "approver-qiao-jiang",
    name: "Qiao Jiang",
    email: "qiao.jiang@example.com",
    role: "Approval Owner",
    team: "AI Governance",
    approvalChainTypes: ["underwriting", "data_engineering", "model_governance"]
  },
  {
    id: "approver-chad-gordon",
    name: "Chad Gordon",
    email: "chad.gordon@example.com",
    role: "Legal Counsel",
    team: "Legal",
    approvalChainTypes: ["underwriting", "procurement", "project_approval"]
  },
  {
    id: "approver-johann-sun",
    name: "Johann Sun",
    email: "johann.sun@example.com",
    role: "Business Owner",
    team: "Product",
    approvalChainTypes: ["underwriting", "project_approval", "procurement"]
  },
  {
    id: "approver-chae-won-lee",
    name: "Chae Won Lee",
    email: "chae.won.lee@example.com",
    role: "Data Platform Lead",
    team: "Data Engineering",
    approvalChainTypes: ["data_engineering", "procurement", "model_governance"]
  }
];

export function getApprovalChainTypeLabel(type?: ApprovalChainType) {
  return APPROVAL_CHAIN_TYPE_OPTIONS.find((option) => option.id === type)?.label ?? "Approval Chain";
}

export function getApprovalChainTypeDescription(type?: ApprovalChainType) {
  return APPROVAL_CHAIN_TYPE_OPTIONS.find((option) => option.id === type)?.description ?? "Assigned reviewers, approval gates, linked review documents, notifications, and audit records.";
}

export function approverMatchesType(approver: Approver, type?: ApprovalChainType) {
  return !type || approver.approvalChainTypes.includes(type);
}
