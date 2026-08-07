import { DEFAULT_APPROVERS } from "@/domain/approval-chain-types";
import type { ApprovalChainType, Approver } from "@/domain/types";

const STORAGE_KEY = "workflow-canvas:litesql:approvers";
const DELETED_KEY = "workflow-canvas:litesql:approvers:deleted";

export const APPROVER_TABLE_NAME = "approvers";

export const APPROVER_TABLE_SQL = `CREATE TABLE approvers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  team TEXT NOT NULL,
  approval_chain_types TEXT NOT NULL
);`;

export function listApprovers() {
  if (typeof window === "undefined") return DEFAULT_APPROVERS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    const stored = Array.isArray(parsed) ? parsed.filter(isApprover) : [];
    const deletedIds = readDeletedApproverIds();
    const byId = new Map([...DEFAULT_APPROVERS, ...stored].map((approver) => [approver.id, approver]));
    const approvers = [...byId.values()].filter((approver) => !deletedIds.has(approver.id)).sort((a, b) => a.name.localeCompare(b.name));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(approvers));
    return approvers;
  } catch {
    return DEFAULT_APPROVERS;
  }
}

export function insertApprover(input: Omit<Approver, "id">) {
  const approver: Approver = {
    ...input,
    id: newApproverId(input.name)
  };
  const next = [
    ...listApprovers().filter(
      (item) => item.email.toLowerCase() !== approver.email.toLowerCase() && item.name.toLowerCase() !== approver.name.toLowerCase()
    ),
    approver
  ].sort((a, b) => a.name.localeCompare(b.name));
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return approver;
}

export function deleteApprover(id: string) {
  if (typeof window === "undefined") return;
  const deletedIds = readDeletedApproverIds();
  deletedIds.add(id);
  window.localStorage.setItem(DELETED_KEY, JSON.stringify([...deletedIds]));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listApprovers().filter((approver) => approver.id !== id)));
}

function isApprover(value: unknown): value is Approver {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Approver>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.email === "string" &&
    typeof item.role === "string" &&
    typeof item.team === "string" &&
    Array.isArray(item.approvalChainTypes) &&
    item.approvalChainTypes.every(isApprovalChainType)
  );
}

function isApprovalChainType(value: unknown): value is ApprovalChainType {
  return typeof value === "string" && ["underwriting", "data_engineering", "project_approval", "procurement", "model_governance"].includes(value);
}

function readDeletedApproverIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DELETED_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function newApproverId(name: string) {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `approver-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "user"}-${suffix}`;
}
