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
    id: "approver-maya-chen",
    name: "Maya Chen",
    email: "maya.chen@example.com",
    role: "Compliance Lead",
    team: "Compliance",
    approvalChainTypes: ["underwriting", "model_governance"]
  },
  {
    id: "approver-jordan-patel",
    name: "Jordan Patel",
    email: "jordan.patel@example.com",
    role: "Legal Counsel",
    team: "Legal",
    approvalChainTypes: ["underwriting", "procurement", "project_approval"]
  },
  {
    id: "approver-nina-alvarez",
    name: "Nina Alvarez",
    email: "nina.alvarez@example.com",
    role: "Business Owner",
    team: "Underwriting Operations",
    approvalChainTypes: ["underwriting", "project_approval"]
  },
  {
    id: "approver-sam-roberts",
    name: "Sam Roberts",
    email: "sam.roberts@example.com",
    role: "Data Platform Lead",
    team: "Data Engineering",
    approvalChainTypes: ["data_engineering"]
  },
  {
    id: "approver-avery-kim",
    name: "Avery Kim",
    email: "avery.kim@example.com",
    role: "Security Reviewer",
    team: "Security",
    approvalChainTypes: ["data_engineering", "procurement", "model_governance"]
  },
  {
    id: "approver-priya-shah",
    name: "Priya Shah",
    email: "priya.shah@example.com",
    role: "Finance Sponsor",
    team: "Finance",
    approvalChainTypes: ["project_approval", "procurement"]
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
