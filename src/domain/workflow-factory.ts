import { getNodeDefinition } from "./node-definitions";
import type { NodeDefinition, Workflow, WorkflowGroup, WorkflowNode } from "./types";

export const STAGE_COLOR_OPTIONS = [
  { value: "#dbeafe", label: "Source blue" },
  { value: "#cffafe", label: "Ingestion cyan" },
  { value: "#ccfbf1", label: "Preparation teal" },
  { value: "#ede9fe", label: "Model purple" },
  { value: "#fef3c7", label: "Review amber" },
  { value: "#ffedd5", label: "Deployment orange" },
  { value: "#dcfce7", label: "Monitoring green" },
  { value: "#e0e7ff", label: "Output indigo" }
] as const;

export function getDefaultStageColor(index: number) {
  return STAGE_COLOR_OPTIONS[Math.max(0, index) % STAGE_COLOR_OPTIONS.length].value;
}

export function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyWorkflow(name = "Untitled workflow"): Workflow {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1.0",
    id: newId("workflow"),
    name,
    description: "Document an AI or machine learning workflow.",
    flowKind: "ai_workflow",
    approvalChainType: undefined,
    version: "1.0",
    status: "draft",
    owner: "",
    team: "",
    tags: [],
    reviewDocuments: [],
    nodes: [],
    edges: [],
    groups: createDefaultGroups(),
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: now,
    updatedAt: now
  };
}

export function createWorkflowNode(definition: NodeDefinition, position: { x: number; y: number }): WorkflowNode {
  return {
    id: newId("node"),
    definitionId: definition.id,
    type: "workflowNode",
    position,
    data: {
      label: definition.name,
      description: definition.description,
      category: definition.category,
      technology: "",
      status: "not_started",
      configuration: { ...definition.defaultConfiguration },
      tags: [],
      owner: "",
      notes: "",
      documentationUrl: ""
    }
  };
}

export function createNodeFromDefinitionId(definitionId: string, position: { x: number; y: number }) {
  const definition = getNodeDefinition(definitionId);
  if (!definition) {
    throw new Error(`Unknown node definition: ${definitionId}`);
  }
  return createWorkflowNode(definition, position);
}

export function createDefaultGroups(): WorkflowGroup[] {
  const names = ["Source", "Ingestion", "Preparation", "Modeling", "Evaluation", "Deployment", "Monitoring"];
  return names.map((title, index) => ({
    id: newId("group"),
    title,
    description: `${title} stage`,
    position: { x: 80 + index * 320, y: 80 },
    width: 280,
    height: 520,
    color: getDefaultStageColor(index),
    defaultColor: getDefaultStageColor(index),
    collapsed: false
  }));
}

export function touchWorkflow(workflow: Workflow): Workflow {
  return { ...workflow, updatedAt: new Date().toISOString() };
}

export function duplicateWorkflow(workflow: Workflow, name = `${workflow.name} copy`): Workflow {
  const now = new Date().toISOString();
  const idMap = new Map(workflow.nodes.map((node) => [node.id, newId("node")]));
  return {
    ...workflow,
    schemaVersion: "1.0",
    id: newId("workflow"),
    name,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    nodes: workflow.nodes.map((node) => ({
      ...node,
      id: idMap.get(node.id) ?? newId("node"),
      position: { x: node.position.x + 40, y: node.position.y + 40 }
    })),
    edges: workflow.edges.map((edge) => ({
      ...edge,
      id: newId("edge"),
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target
    })),
    groups: workflow.groups.map((group) => ({ ...group, id: newId("group") }))
  };
}
