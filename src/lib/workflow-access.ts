"use client";

import type { DemoUser } from "@/domain/fake-users";
import type { Workflow, WorkflowNode } from "@/domain/types";
import { listWorkflowRowsForUser } from "@/lib/local-flow-tables";

export type WorkflowAccessRole = "manager" | "approver" | "reader" | "none";

export function getWorkflowAccessRole(workflow: Workflow, user?: DemoUser | null): WorkflowAccessRole {
  if (!user) return "none";
  if (matchesUser(workflow.owner, user)) return "manager";

  if (workflow.flowKind === "approval_chain") {
    if (workflow.nodes.some((node) => isAssignedApprover(node, user))) return "approver";
  }

  const membership = listWorkflowRowsForUser(user.id).find((row) => row.workflowId === workflow.id);
  if (membership?.accessRole === "manager") return "manager";
  if (membership?.accessRole === "approver") return "approver";
  if (membership) return "reader";

  if (workflow.nodes.some((node) => hasReaderInvite(node, user))) return "reader";
  return "none";
}

export function canUserAccessWorkflow(workflow: Workflow, user?: DemoUser | null) {
  return getWorkflowAccessRole(workflow, user) !== "none";
}

export function canUserManageWorkflow(workflow: Workflow, user?: DemoUser | null) {
  return getWorkflowAccessRole(workflow, user) === "manager";
}

export function getNodeAccessRole(workflow: Workflow, node: WorkflowNode | null, user?: DemoUser | null): WorkflowAccessRole {
  if (!node || !user) return getWorkflowAccessRole(workflow, user);
  const creator = firstText(node.data.configuration.creator, node.data.owner, workflow.owner);
  if (matchesUser(creator, user)) return "manager";
  if (workflow.flowKind === "approval_chain" && isAssignedApprover(node, user)) return "approver";
  if (hasReaderInvite(node, user)) return "reader";
  return getWorkflowAccessRole(workflow, user);
}

function isAssignedApprover(node: WorkflowNode, user: DemoUser) {
  return matchesUser(firstText(node.data.configuration.approver, node.data.configuration.assignee, node.data.configuration.reviewer), user);
}

function hasReaderInvite(node: WorkflowNode, user: DemoUser) {
  return [
    node.data.configuration.readers,
    node.data.configuration.viewers,
    node.data.configuration.invitedReaders,
    node.data.configuration.invitedUsers
  ].some((value) => userListIncludes(value, user));
}

function userListIncludes(value: unknown, user: DemoUser) {
  if (!Array.isArray(value)) return false;
  return value.some((item) => matchesUser(item, user));
}

function matchesUser(value: unknown, user: DemoUser) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return Boolean(normalized) && [user.id, user.name, user.email].some((candidate) => candidate.toLowerCase() === normalized);
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
