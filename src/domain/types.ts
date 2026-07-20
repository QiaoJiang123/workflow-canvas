export type WorkflowStatus = "draft" | "in_review" | "approved" | "archived";

export type NodeCategory =
  | "data_sources"
  | "data_processing"
  | "feature_engineering"
  | "machine_learning"
  | "generative_ai"
  | "evaluation"
  | "deployment"
  | "monitoring"
  | "human_review"
  | "outputs"
  | "documentation";

export type NodeStatus = "not_started" | "in_progress" | "ready" | "needs_review" | "blocked";

export type EdgeKind = "data" | "control" | "feedback" | "approval" | "dependency";

export interface WorkflowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WorkflowNode {
  id: string;
  definitionId: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    label: string;
    description?: string;
    category: NodeCategory;
    technology?: string;
    status?: NodeStatus;
    configuration: Record<string, unknown>;
    tags?: string[];
    owner?: string;
    notes?: string;
    documentationUrl?: string;
  };
  parentGroupId?: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: EdgeKind;
  label?: string;
  description?: string;
  animated?: boolean;
}

export interface WorkflowGroup {
  id: string;
  title: string;
  description?: string;
  position: {
    x: number;
    y: number;
  };
  width: number;
  height: number;
  color: string;
  collapsed?: boolean;
}

export interface Workflow {
  schemaVersion: "1.0";
  id: string;
  name: string;
  description?: string;
  version: string;
  status: WorkflowStatus;
  owner?: string;
  team?: string;
  tags: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  groups: WorkflowGroup[];
  viewport?: WorkflowViewport;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  status: WorkflowStatus;
  updatedAt: string;
  nodeCount: number;
  edgeCount: number;
}

export type NodeFieldType = "text" | "textarea" | "select" | "tags" | "url";

export interface NodeFieldDefinition {
  key: string;
  label: string;
  type: NodeFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface PortDefinition {
  id: string;
  label: string;
}

export interface NodeDefinition {
  id: string;
  name: string;
  description: string;
  category: NodeCategory;
  icon: string;
  defaultConfiguration: Record<string, unknown>;
  fields: NodeFieldDefinition[];
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  keywords?: string[];
  frequentlyUsed?: boolean;
}

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  code: string;
  targetType: "workflow" | "node" | "edge";
  targetId?: string;
  nodeId?: string;
  edgeId?: string;
  field?: string;
  title: string;
  message: string;
  suggestion?: string;
}

export interface WorkflowExportEnvelope {
  schemaVersion: "1.0";
  workflow: Workflow;
}
