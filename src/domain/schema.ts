import { z } from "zod";

const workflowStatus = z.enum(["draft", "in_review", "approved", "archived"]);
const flowKind = z.enum(["ai_workflow", "approval_chain"]);
const approvalChainType = z.enum(["underwriting", "data_engineering", "project_approval", "procurement", "model_governance"]);
const nodeCategory = z.enum([
  "data_sources",
  "data_processing",
  "feature_engineering",
  "machine_learning",
  "generative_ai",
  "evaluation",
  "deployment",
  "monitoring",
  "human_review",
  "outputs",
  "documentation"
]);
const nodeStatus = z.enum(["not_started", "in_progress", "ready", "needs_review", "blocked"]).optional();

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  definitionId: z.string().min(1),
  type: z.string().min(1),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    label: z.string(),
    description: z.string().optional(),
    category: nodeCategory,
    technology: z.string().optional(),
    status: nodeStatus,
    configuration: z.record(z.unknown()),
    tags: z.array(z.string()).optional(),
    owner: z.string().optional(),
    notes: z.string().optional(),
    documentationUrl: z.string().optional()
  }),
  parentGroupId: z.string().optional()
});

export const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  type: z.enum(["data", "control", "feedback", "approval", "dependency"]),
  label: z.string().optional(),
  description: z.string().optional(),
  animated: z.boolean().optional(),
  curvature: z.number().min(0).max(1).optional()
});

export const workflowGroupSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  width: z.number().min(160),
  height: z.number().min(120),
  color: z.string().min(1),
  defaultColor: z.string().min(1).optional(),
  collapsed: z.boolean().optional()
});

export const reviewDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["pdf", "text", "doc"]),
  url: z.string().min(1),
  owner: z.string().optional(),
  summary: z.string().optional()
});

export const approverSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
  role: z.string().min(1),
  team: z.string().min(1),
  approvalChainTypes: z.array(approvalChainType)
});

const workflowObjectSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  flowKind,
  approvalChainType: approvalChainType.optional(),
  version: z.string().min(1),
  status: workflowStatus,
  owner: z.string().optional(),
  team: z.string().optional(),
  tags: z.array(z.string()),
  reviewDocuments: z.array(reviewDocumentSchema).optional(),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  groups: z.array(workflowGroupSchema),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
}).superRefine((workflow, ctx) => {
  if (workflow.flowKind === "approval_chain" && !workflow.approvalChainType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["approvalChainType"],
      message: "Approval chains must include an approval chain type."
    });
  }
  if (workflow.flowKind === "ai_workflow" && workflow.approvalChainType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["approvalChainType"],
      message: "AI workflows cannot include an approval chain type."
    });
  }
});

export const workflowSchema = z.preprocess(normalizeWorkflowInput, workflowObjectSchema);

export const workflowExportSchema = z.object({
  schemaVersion: z.literal("1.0"),
  workflow: workflowSchema
});

function normalizeWorkflowInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const workflow = { ...(input as Record<string, unknown>) };
  if (workflow.flowKind !== "approval_chain" && workflow.flowKind !== "ai_workflow") {
    workflow.flowKind = "ai_workflow";
  }
  if (workflow.flowKind === "approval_chain" && !workflow.approvalChainType) {
    workflow.approvalChainType = "underwriting";
  }
  if (workflow.flowKind === "ai_workflow") {
    delete workflow.approvalChainType;
  }
  return workflow;
}
