import { normalizeApprovalSquareData, type ApprovalSquareData } from "@/domain/approval-node-presets";
import { CATEGORY_LABELS, getNodeDefinition } from "@/domain/node-definitions";
import { getProviderOption, normalizeProviderIdForNode } from "@/domain/providers";
import type { ReviewDocument, Workflow, WorkflowEdge, WorkflowNode } from "@/domain/types";

export interface NodeLlmExport {
  schemaVersion: "1.0";
  exportType: "workflow_node_llm_context";
  exportedAt: string;
  evaluationPrompt: string;
  workflow: {
    id: string;
    name: string;
    description?: string;
    flowKind: Workflow["flowKind"];
    approvalChainType?: Workflow["approvalChainType"];
    status: Workflow["status"];
    owner?: string;
    team?: string;
    version: string;
    tags: string[];
  };
  node: {
    id: string;
    definitionId: string;
    label: string;
    description?: string;
    category: string;
    position: WorkflowNode["position"];
    status?: WorkflowNode["data"]["status"];
    owner?: string;
    technology?: string;
    provider?: { id: string; name: string; icon: string };
    configuration: WorkflowNode["data"]["configuration"];
    definition?: {
      name: string;
      description: string;
      inputs: string[];
      outputs: string[];
      requiredFields: string[];
    };
    approval?: ApprovalSquareData;
  };
  stage?: {
    id: string;
    title: string;
    description?: string;
    color: string;
  };
  documents: ReviewDocument[];
  connections: {
    incoming: ExportedEdge[];
    outgoing: ExportedEdge[];
  };
  connectedNodes: {
    upstream: ExportedNeighborNode[];
    downstream: ExportedNeighborNode[];
  };
}

interface ExportedEdge {
  id: string;
  type: WorkflowEdge["type"];
  label?: string;
  description?: string;
  source: { id: string; label: string; handle?: string };
  target: { id: string; label: string; handle?: string };
  curvature?: number;
  animated?: boolean;
}

interface ExportedNeighborNode {
  id: string;
  label: string;
  definitionId: string;
  category: string;
  status?: WorkflowNode["data"]["status"];
  description?: string;
}

export function buildNodeLlmExport(workflow: Workflow, nodeId: string, exportedAt = new Date().toISOString()): NodeLlmExport | null {
  const node = workflow.nodes.find((item) => item.id === nodeId);
  if (!node) return null;

  const definition = getNodeDefinition(node.definitionId);
  const providerId = normalizeProviderIdForNode(node.definitionId, String(node.data.configuration.providerId ?? ""));
  const provider = getProviderOption(providerId);
  const incoming = workflow.edges.filter((edge) => edge.target === node.id).map((edge) => toExportedEdge(workflow, edge));
  const outgoing = workflow.edges.filter((edge) => edge.source === node.id).map((edge) => toExportedEdge(workflow, edge));
  const upstreamIds = new Set(incoming.map((edge) => edge.source.id));
  const downstreamIds = new Set(outgoing.map((edge) => edge.target.id));
  const documents = [
    ...getReviewDocuments(node.data.configuration.documents),
    ...(workflow.reviewDocuments ?? []).filter((document) => referencesNode(document, node.id))
  ];

  return {
    schemaVersion: "1.0",
    exportType: "workflow_node_llm_context",
    exportedAt,
    evaluationPrompt:
      "Evaluate this workflow square for purpose clarity, missing inputs or outputs, data and governance risks, operational readiness, approval/document needs, and suggested improvements. Be specific and actionable.",
    workflow: {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      flowKind: workflow.flowKind,
      approvalChainType: workflow.approvalChainType,
      status: workflow.status,
      owner: workflow.owner,
      team: workflow.team,
      version: workflow.version,
      tags: workflow.tags
    },
    node: {
      id: node.id,
      definitionId: node.definitionId,
      label: node.data.label,
      description: node.data.description,
      category: CATEGORY_LABELS[node.data.category],
      position: node.position,
      status: node.data.status,
      owner: node.data.owner,
      technology: node.data.technology,
      provider: provider ? { id: provider.id, name: provider.name, icon: provider.icon } : undefined,
      configuration: node.data.configuration,
      approval:
        workflow.flowKind === "approval_chain"
          ? normalizeApprovalSquareData(node.data.configuration, {
              label: node.data.label,
              description: node.data.description,
              owner: node.data.owner,
              workflowOwner: workflow.owner,
              approvalChainType: workflow.approvalChainType
            })
          : undefined,
      definition: definition
        ? {
            name: definition.name,
            description: definition.description,
            inputs: definition.inputs.map((input) => input.label),
            outputs: definition.outputs.map((output) => output.label),
            requiredFields: definition.fields.filter((field) => field.required).map((field) => field.label)
          }
        : undefined
    },
    stage: findContainingStage(workflow, node),
    documents: dedupeDocuments(documents),
    connections: { incoming, outgoing },
    connectedNodes: {
      upstream: workflow.nodes.filter((item) => upstreamIds.has(item.id)).map(toNeighborNode),
      downstream: workflow.nodes.filter((item) => downstreamIds.has(item.id)).map(toNeighborNode)
    }
  };
}

export function downloadNodeLlmExport(workflow: Workflow, nodeId: string) {
  const payload = buildNodeLlmExport(workflow, nodeId);
  if (!payload) return false;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(workflow.name) || "workflow"}--${slugify(payload.node.label) || "node"}--llm-context.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

function toExportedEdge(workflow: Workflow, edge: WorkflowEdge): ExportedEdge {
  return {
    id: edge.id,
    type: edge.type,
    label: edge.label,
    description: edge.description,
    source: { id: edge.source, label: labelFor(workflow, edge.source), handle: edge.sourceHandle },
    target: { id: edge.target, label: labelFor(workflow, edge.target), handle: edge.targetHandle },
    curvature: edge.curvature,
    animated: edge.animated
  };
}

function toNeighborNode(node: WorkflowNode): ExportedNeighborNode {
  return {
    id: node.id,
    label: node.data.label,
    definitionId: node.definitionId,
    category: CATEGORY_LABELS[node.data.category],
    status: node.data.status,
    description: node.data.description
  };
}

function labelFor(workflow: Workflow, nodeId: string) {
  return workflow.nodes.find((node) => node.id === nodeId)?.data.label ?? nodeId;
}

function findContainingStage(workflow: Workflow, node: WorkflowNode) {
  const explicitGroup = node.parentGroupId ? workflow.groups.find((group) => group.id === node.parentGroupId) : undefined;
  const group =
    explicitGroup ??
    workflow.groups.find(
      (item) =>
        node.position.x >= item.position.x &&
        node.position.x <= item.position.x + item.width &&
        node.position.y >= item.position.y &&
        node.position.y <= item.position.y + item.height
    );
  if (!group) return undefined;
  return {
    id: group.id,
    title: group.title,
    description: group.description,
    color: group.color
  };
}

function getReviewDocuments(value: unknown): ReviewDocument[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isReviewDocument);
}

function isReviewDocument(value: unknown): value is ReviewDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<ReviewDocument>;
  return (
    typeof document.id === "string" &&
    typeof document.title === "string" &&
    typeof document.url === "string" &&
    (document.type === "pdf" || document.type === "doc" || document.type === "text")
  );
}

function referencesNode(document: ReviewDocument, nodeId: string) {
  return document.id.includes(nodeId) || document.url.includes(nodeId);
}

function dedupeDocuments(documents: ReviewDocument[]) {
  return [...new Map(documents.map((document) => [document.id, document])).values()];
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
