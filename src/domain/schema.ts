import { z } from "zod";

const workflowStatus = z.enum(["draft", "in_review", "approved", "archived"]);
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
  animated: z.boolean().optional()
});

export const workflowGroupSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  width: z.number().min(160),
  height: z.number().min(120),
  color: z.string().min(1),
  collapsed: z.boolean().optional()
});

export const workflowSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().min(1),
  status: workflowStatus,
  owner: z.string().optional(),
  team: z.string().optional(),
  tags: z.array(z.string()),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  groups: z.array(workflowGroupSchema),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const workflowExportSchema = z.object({
  schemaVersion: z.literal("1.0"),
  workflow: workflowSchema
});
