import { buildApprovalSquareConfiguration } from "@/domain/approval-node-presets";
import { getNodeDefinition } from "@/domain/node-definitions";
import type { EdgeKind, NodeStatus, ReviewDocument, Workflow, WorkflowEdge, WorkflowGroup, WorkflowNode } from "@/domain/types";
import { getDefaultStageColor, createNodeFromDefinitionId, newId, touchWorkflow } from "@/domain/workflow-factory";
import { validateWorkflow } from "@/domain/validation";
import { buildNodeLlmExport } from "@/lib/node-llm-export";
import type { AgentAction, AgentExecutionResult, WorkflowAccessRole } from "./types";
import { agentActionSchema, createAgentId } from "./types";

export interface ExecuteAgentActionsInput {
  workflow: Workflow;
  actions: AgentAction[];
  approvedActionIds?: string[];
  selected?: { type: string; id: string };
  userRole: WorkflowAccessRole;
  userName?: string;
  prompt?: string;
}

export function executeAgentActions(input: ExecuteAgentActionsInput): AgentExecutionResult {
  const approvedIds = new Set(input.approvedActionIds ?? input.actions.map((action) => action.id));
  let workflow = cloneWorkflow(input.workflow);
  const warnings: string[] = [];
  const applied: AgentAction[] = [];
  let previousAddedNodeId = "";

  for (const action of input.actions.map((item) => agentActionSchema.parse(item))) {
    if (!approvedIds.has(action.id)) continue;
    const actionToApply = normalizePreviousSource(action, previousAddedNodeId);
    const permission = canApplyAction(actionToApply, input.userRole);
    if (!permission.allowed) {
      warnings.push(`${actionToApply.title}: ${permission.reason}`);
      applied.push({ ...actionToApply, status: "failed" });
      continue;
    }

    const before = workflow;
    const beforeNodeIds = new Set(workflow.nodes.map((node) => node.id));
    workflow = applyAction(workflow, actionToApply, input.selected, input.userName);
    const newlyAddedNode = workflow.nodes.find((node) => !beforeNodeIds.has(node.id));
    if (newlyAddedNode) previousAddedNodeId = newlyAddedNode.id;
    const changed = JSON.stringify(before) !== JSON.stringify(workflow);
    applied.push({ ...actionToApply, status: changed || isReadOnlyAction(actionToApply) ? "applied" : "failed" });
    if (!changed && !isReadOnlyAction(actionToApply)) warnings.push(`${actionToApply.title}: no matching workflow item was found.`);
  }

  workflow = touchWorkflow(workflow);
  const validationIssues = validateWorkflow(workflow);
  if (validationIssues.some((issue) => issue.severity === "error")) {
    warnings.push(`${validationIssues.filter((issue) => issue.severity === "error").length} validation error(s) remain after agent execution.`);
  }

  const completedAt = new Date().toISOString();
  return {
    workflow,
    actions: applied,
    warnings,
    auditLog: {
      id: createAgentId("agent-run"),
      workflowId: workflow.id,
      userName: input.userName,
      agentName: "execution",
      prompt: input.prompt ?? "",
      status: warnings.some((warning) => warning.includes("not allowed")) ? "failed" : "applied",
      proposedActionJson: JSON.stringify(input.actions),
      appliedActionJson: JSON.stringify(applied),
      createdAt: completedAt,
      completedAt,
      error: warnings.join("\n") || undefined
    }
  };
}

export function applyAction(workflow: Workflow, action: AgentAction, selected?: { type: string; id: string }, userName?: string): Workflow {
  switch (action.kind) {
    case "node.add":
      return addNode(workflow, action.payload);
    case "approval_square.add":
      return addApprovalSquare(workflow, action.payload, userName);
    case "edge.add":
      return addEdge(workflow, action.payload);
    case "edge.update":
      return updateEdge(workflow, action.payload);
    case "node.update":
      return updateNode(workflow, action.payload, selected);
    case "approval.assignApprover":
      return updateApprovalNode(workflow, action.payload.nodeId, action.payload.nodeLabel, { approver: action.payload.approver });
    case "approval.setStatus":
      return setApprovalStatus(workflow, action.payload, userName);
    case "document.linkToNode":
      return linkDocumentToNode(workflow, action.payload.nodeId, action.payload.document);
    case "document.unlinkFromNode":
      return unlinkDocumentFromNode(workflow, action.payload.nodeId, action.payload.documentId);
    case "group.add":
      return addGroup(workflow, action.payload);
    case "workflow.validate":
    case "recommendation.generate":
    case "llm.exportNodeContext":
      return workflow;
  }
}

function addNode(workflow: Workflow, payload: Extract<AgentAction, { kind: "node.add" }>["payload"]) {
  if (!getNodeDefinition(payload.definitionId)) return workflow;
  const node = createNodeFromDefinitionId(payload.definitionId, nextNodePosition(workflow));
  const nextNode: WorkflowNode = {
    ...node,
    data: {
      ...node.data,
      label: payload.label || node.data.label,
      description: payload.description ?? node.data.description,
      technology: payload.technology ?? node.data.technology,
      status: payload.status ?? node.data.status,
      configuration: { ...node.data.configuration, ...(payload.configuration ?? {}) }
    }
  };
  const next = { ...workflow, nodes: [...workflow.nodes, nextNode] };
  if (!payload.sourceId || !workflow.nodes.some((item) => item.id === payload.sourceId)) return next;
  return addEdge(next, {
    sourceId: payload.sourceId,
    targetId: nextNode.id,
    type: payload.edgeType ?? "data",
    label: payload.edgeLabel ?? "Agent connection",
    sourceHandle: "out",
    targetHandle: "in"
  });
}

function addApprovalSquare(workflow: Workflow, payload: Extract<AgentAction, { kind: "approval_square.add" }>["payload"], userName?: string) {
  if (workflow.flowKind !== "approval_chain") return workflow;
  const definitionId = payload.definitionId || "human-review";
  if (!getNodeDefinition(definitionId)) return workflow;
  const node = createNodeFromDefinitionId(definitionId, nextNodePosition(workflow));
  const configuration = buildApprovalSquareConfiguration({
    label: payload.label,
    description: payload.description ?? `${payload.label} approval step.`,
    creator: payload.creator ?? userName ?? workflow.owner,
    approver: payload.approver,
    approvalType: payload.label,
    status: payload.status ?? "not_reviewed",
    dueDate: payload.dueDate,
    instructions: payload.instructions,
    actor: userName
  });
  const nextNode: WorkflowNode = {
    ...node,
    data: {
      ...node.data,
      label: payload.label,
      description: payload.description ?? node.data.description,
      status: approvalStatusToNodeStatus(payload.status),
      configuration: { ...node.data.configuration, ...configuration }
    }
  };
  const next = { ...workflow, nodes: [...workflow.nodes, nextNode] };
  if (!payload.sourceId || !workflow.nodes.some((item) => item.id === payload.sourceId)) return next;
  return addEdge(next, {
    sourceId: payload.sourceId,
    targetId: nextNode.id,
    type: "approval",
    label: "Approval path",
    sourceHandle: "out",
    targetHandle: "in"
  });
}

function addEdge(workflow: Workflow, payload: Extract<AgentAction, { kind: "edge.add" }>["payload"]) {
  const source = payload.sourceId ? workflow.nodes.find((node) => node.id === payload.sourceId) : findNodeByLabel(workflow, payload.sourceLabel);
  const target = payload.targetId ? workflow.nodes.find((node) => node.id === payload.targetId) : findNodeByLabel(workflow, payload.targetLabel);
  if (!source || !target || source.id === target.id) return workflow;
  if (workflow.edges.some((edge) => edge.source === source.id && edge.target === target.id)) return workflow;
  const edge: WorkflowEdge = {
    id: newId("edge"),
    source: source.id,
    target: target.id,
    sourceHandle: payload.sourceHandle ?? "out",
    targetHandle: payload.targetHandle ?? "in",
    type: (payload.type ?? "data") as EdgeKind,
    label: payload.label ?? "Agent connection",
    curvature: 0.42
  };
  return { ...workflow, edges: [...workflow.edges, edge] };
}

function updateEdge(workflow: Workflow, payload: Extract<AgentAction, { kind: "edge.update" }>["payload"]) {
  return {
    ...workflow,
    edges: workflow.edges.map((edge) =>
      edge.id === payload.edgeId
        ? {
            ...edge,
            ...compactPatch({
              label: payload.label,
              description: payload.description,
              type: payload.type,
              sourceHandle: payload.sourceHandle,
              targetHandle: payload.targetHandle,
              curvature: payload.curvature
            })
          }
        : edge
    )
  };
}

function updateNode(workflow: Workflow, payload: Extract<AgentAction, { kind: "node.update" }>["payload"], selected?: { type: string; id: string }) {
  const targetId = payload.nodeId ?? (payload.useSelected && selected?.type === "node" ? selected.id : undefined);
  const target = targetId ? workflow.nodes.find((node) => node.id === targetId) : findNodeByLabel(workflow, payload.nodeLabel);
  if (!target) return workflow;
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node.id === target.id
        ? {
            ...node,
            data: {
              ...node.data,
              ...compactPatch({
                label: payload.label,
                description: payload.description,
                technology: payload.technology,
                status: payload.status,
                notes: payload.notes
              }),
              configuration: { ...node.data.configuration, ...(payload.configuration ?? {}) }
            }
          }
        : node
    )
  };
}

function updateApprovalNode(workflow: Workflow, nodeId?: string, nodeLabel?: string, configurationPatch: Record<string, unknown> = {}) {
  if (workflow.flowKind !== "approval_chain") return workflow;
  const target = nodeId ? workflow.nodes.find((node) => node.id === nodeId) : findNodeByLabel(workflow, nodeLabel);
  if (!target) return workflow;
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node.id === target.id
        ? {
            ...node,
            data: {
              ...node.data,
              configuration: { ...node.data.configuration, ...configurationPatch }
            }
          }
        : node
    )
  };
}

function setApprovalStatus(workflow: Workflow, payload: Extract<AgentAction, { kind: "approval.setStatus" }>["payload"], userName?: string) {
  if (workflow.flowKind !== "approval_chain") return workflow;
  const target = payload.nodeId ? workflow.nodes.find((node) => node.id === payload.nodeId) : findNodeByLabel(workflow, payload.nodeLabel);
  if (!target) return workflow;
  const at = new Date().toISOString();
  const auditTrail = Array.isArray(target.data.configuration.auditTrail) ? target.data.configuration.auditTrail : [];
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node.id === target.id
        ? {
            ...node,
            data: {
              ...node.data,
              status: approvalStatusToNodeStatus(payload.status),
              configuration: {
                ...node.data.configuration,
                status: payload.status,
                approvalStatus: payload.status,
                decision: payload.status,
                comments: payload.comments ?? node.data.configuration.comments,
                auditTrail: [
                  ...auditTrail,
                  {
                    at,
                    actor: payload.actor ?? userName ?? "Agent",
                    action: payload.status,
                    note: payload.comments
                  }
                ]
              }
            }
          }
        : node
    )
  };
}

function linkDocumentToNode(workflow: Workflow, nodeId: string, document: ReviewDocument) {
  if (!workflow.nodes.some((node) => node.id === nodeId)) return workflow;
  return {
    ...workflow,
    reviewDocuments: dedupeDocuments([...(workflow.reviewDocuments ?? []), document]),
    nodes: workflow.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const documents = Array.isArray(node.data.configuration.documents) ? node.data.configuration.documents.filter(isReviewDocument) : [];
      return {
        ...node,
        data: {
          ...node.data,
          configuration: {
            ...node.data.configuration,
            documents: dedupeDocuments([...documents, document])
          }
        }
      };
    })
  };
}

function unlinkDocumentFromNode(workflow: Workflow, nodeId: string, documentId: string) {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const documents = Array.isArray(node.data.configuration.documents) ? node.data.configuration.documents.filter(isReviewDocument) : [];
      return {
        ...node,
        data: {
          ...node.data,
          configuration: {
            ...node.data.configuration,
            documents: documents.filter((document) => document.id !== documentId)
          }
        }
      };
    })
  };
}

function addGroup(workflow: Workflow, payload: Extract<AgentAction, { kind: "group.add" }>["payload"]) {
  const color = payload.color ?? getDefaultStageColor(workflow.groups.length);
  const group: WorkflowGroup = {
    id: newId("group"),
    title: payload.title,
    description: payload.description ?? "",
    position: { x: 100 + workflow.groups.length * 280, y: 80 },
    width: 280,
    height: 520,
    color,
    defaultColor: color
  };
  return { ...workflow, groups: [...workflow.groups, group] };
}

export function canApplyAction(action: AgentAction, userRole: WorkflowAccessRole) {
  if (isReadOnlyAction(action)) return { allowed: true };
  if (userRole === "manager") return { allowed: true };
  if (userRole === "approver" && action.kind === "approval.setStatus") return { allowed: true };
  return { allowed: false, reason: `${userRole} is not allowed to run ${action.kind}` };
}

function normalizePreviousSource(action: AgentAction, previousAddedNodeId: string): AgentAction {
  if ((action.kind === "node.add" || action.kind === "approval_square.add") && action.payload.sourceId === "__previous__") {
    return {
      ...action,
      payload: {
        ...action.payload,
        sourceId: previousAddedNodeId || undefined
      }
    } as AgentAction;
  }
  return action;
}

function isReadOnlyAction(action: AgentAction) {
  return action.kind === "workflow.validate" || action.kind === "recommendation.generate" || action.kind === "llm.exportNodeContext";
}

export function describeAction(action: AgentAction, workflow: Workflow) {
  if (action.kind === "workflow.validate") return `${validateWorkflow(workflow).length} validation finding(s).`;
  if (action.kind === "llm.exportNodeContext") return buildNodeLlmExport(workflow, action.payload.nodeId) ? "LLM context package is ready." : "No matching node to export.";
  return action.description ?? action.title;
}

function nextNodePosition(workflow: Workflow) {
  const maxX = Math.max(80, ...workflow.nodes.map((node) => node.position.x));
  const countAtMax = workflow.nodes.filter((node) => node.position.x === maxX).length;
  return { x: maxX + 250, y: 150 + (countAtMax % 3) * 170 };
}

function findNodeByLabel(workflow: Workflow, label?: string) {
  if (!label) return null;
  const lower = label.toLowerCase();
  return workflow.nodes.find((node) => node.data.label.toLowerCase() === lower) ?? workflow.nodes.find((node) => node.data.label.toLowerCase().includes(lower));
}

function approvalStatusToNodeStatus(status?: string): NodeStatus {
  if (status === "approved") return "ready";
  if (status === "rejected") return "blocked";
  if (status === "in_review") return "in_progress";
  return "not_started";
}

function dedupeDocuments(documents: ReviewDocument[]) {
  return [...new Map(documents.map((document) => [document.id, document])).values()];
}

function isReviewDocument(value: unknown): value is ReviewDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<ReviewDocument>;
  return typeof document.id === "string" && typeof document.title === "string" && typeof document.url === "string" && (document.type === "pdf" || document.type === "doc" || document.type === "text");
}

function compactPatch<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== "")) as Partial<T>;
}

function cloneWorkflow(workflow: Workflow): Workflow {
  return JSON.parse(JSON.stringify(workflow)) as Workflow;
}
