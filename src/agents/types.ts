import { z } from "zod";
import type { EdgeKind, ReviewDocument, Workflow, WorkflowNode } from "@/domain/types";

export const agentRoleSchema = z.enum([
  "router",
  "workflow_architect",
  "approval_chain",
  "document",
  "validation",
  "provider",
  "mcp_tool",
  "execution"
]);

export const agentExecutionModeSchema = z.enum(["plan_only", "confirm_each_step", "auto_apply"]);

export const workflowAccessRoleSchema = z.enum(["manager", "approver", "reader", "none"]);

export const agentTargetSchema = z.object({
  type: z.enum(["workflow", "node", "edge", "group", "document", "approval_square"]),
  id: z.string().optional(),
  label: z.string().optional()
});

const baseActionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  agentRole: agentRoleSchema,
  status: z.enum(["proposed", "applied", "rejected", "failed"]).default("proposed"),
  target: agentTargetSchema,
  requiresRole: workflowAccessRoleSchema.optional()
});

export const agentActionSchema = z.discriminatedUnion("kind", [
  baseActionSchema.extend({
    kind: z.literal("node.add"),
    payload: z.object({
      definitionId: z.string().min(1),
      label: z.string().optional(),
      description: z.string().optional(),
      technology: z.string().optional(),
      status: z.enum(["not_started", "in_progress", "ready", "needs_review", "blocked"]).optional(),
      configuration: z.record(z.unknown()).optional(),
      sourceId: z.string().optional(),
      edgeLabel: z.string().optional(),
      edgeType: z.enum(["data", "control", "feedback", "approval", "dependency"]).optional()
    })
  }),
  baseActionSchema.extend({
    kind: z.literal("approval_square.add"),
    payload: z.object({
      definitionId: z.string().min(1).default("human-review"),
      label: z.string().min(1),
      description: z.string().optional(),
      creator: z.string().optional(),
      approver: z.string().optional(),
      status: z.string().optional(),
      dueDate: z.string().optional(),
      instructions: z.string().optional(),
      sourceId: z.string().optional()
    })
  }),
  baseActionSchema.extend({
    kind: z.literal("edge.add"),
    payload: z.object({
      sourceId: z.string().optional(),
      sourceLabel: z.string().optional(),
      targetId: z.string().optional(),
      targetLabel: z.string().optional(),
      type: z.enum(["data", "control", "feedback", "approval", "dependency"]).default("data"),
      label: z.string().optional(),
      sourceHandle: z.string().optional(),
      targetHandle: z.string().optional()
    })
  }),
  baseActionSchema.extend({
    kind: z.literal("edge.update"),
    payload: z.object({
      edgeId: z.string().min(1),
      label: z.string().optional(),
      description: z.string().optional(),
      type: z.enum(["data", "control", "feedback", "approval", "dependency"]).optional(),
      sourceHandle: z.string().optional(),
      targetHandle: z.string().optional(),
      curvature: z.number().min(0).max(1).optional()
    })
  }),
  baseActionSchema.extend({
    kind: z.literal("node.update"),
    payload: z.object({
      nodeId: z.string().optional(),
      nodeLabel: z.string().optional(),
      useSelected: z.boolean().optional(),
      label: z.string().optional(),
      description: z.string().optional(),
      technology: z.string().optional(),
      status: z.enum(["not_started", "in_progress", "ready", "needs_review", "blocked"]).optional(),
      notes: z.string().optional(),
      configuration: z.record(z.unknown()).optional()
    })
  }),
  baseActionSchema.extend({
    kind: z.literal("approval.assignApprover"),
    payload: z.object({
      nodeId: z.string().optional(),
      nodeLabel: z.string().optional(),
      approver: z.string().min(1)
    })
  }),
  baseActionSchema.extend({
    kind: z.literal("approval.setStatus"),
    payload: z.object({
      nodeId: z.string().optional(),
      nodeLabel: z.string().optional(),
      status: z.enum(["not_reviewed", "in_review", "approved", "rejected"]),
      actor: z.string().optional(),
      comments: z.string().optional()
    })
  }),
  baseActionSchema.extend({
    kind: z.literal("document.linkToNode"),
    payload: z.object({
      nodeId: z.string().min(1),
      document: z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        type: z.enum(["pdf", "doc", "text"]),
        url: z.string().min(1),
        owner: z.string().optional(),
        summary: z.string().optional()
      })
    })
  }),
  baseActionSchema.extend({
    kind: z.literal("document.unlinkFromNode"),
    payload: z.object({
      nodeId: z.string().min(1),
      documentId: z.string().min(1)
    })
  }),
  baseActionSchema.extend({
    kind: z.literal("group.add"),
    payload: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      color: z.string().optional()
    })
  }),
  baseActionSchema.extend({
    kind: z.literal("workflow.validate"),
    payload: z.object({})
  }),
  baseActionSchema.extend({
    kind: z.literal("recommendation.generate"),
    payload: z.object({
      recommendation: z.string().min(1)
    })
  }),
  baseActionSchema.extend({
    kind: z.literal("llm.exportNodeContext"),
    payload: z.object({
      nodeId: z.string().min(1)
    })
  })
]);

export const agentToolCallSchema = z.object({
  id: z.string().min(1),
  toolName: z.string().min(1),
  agentRole: agentRoleSchema,
  input: z.record(z.unknown()),
  output: z.unknown().optional(),
  status: z.enum(["proposed", "running", "completed", "failed", "blocked"]).default("proposed"),
  error: z.string().optional(),
  createdAt: z.string()
});

export const agentStepSchema = z.object({
  id: z.string().min(1),
  agentRole: agentRoleSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  actionIds: z.array(z.string()),
  toolCallIds: z.array(z.string()),
  status: z.enum(["planned", "running", "completed", "blocked", "failed"]).default("planned")
});

export const agentPlanSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  prompt: z.string().min(1),
  executionMode: agentExecutionModeSchema,
  selectedAgent: agentRoleSchema,
  agents: z.array(agentRoleSchema),
  message: z.string().min(1),
  steps: z.array(agentStepSchema),
  actions: z.array(agentActionSchema),
  toolCalls: z.array(agentToolCallSchema),
  warnings: z.array(z.string()),
  createdAt: z.string()
});

export interface AgentContext {
  workflow: Workflow;
  prompt: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  selected?: { type: string; id: string };
  executionMode: AgentExecutionMode;
  userRole: WorkflowAccessRole;
  userName?: string;
}

export interface AgentRun {
  id: string;
  workflowId: string;
  userId?: string;
  userName?: string;
  agentName: AgentRole;
  prompt: string;
  status: "planned" | "applied" | "rejected" | "failed";
  proposedActionJson: string;
  appliedActionJson?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface AgentCapability {
  id: string;
  label: string;
  description: string;
}

export type AgentRole = z.infer<typeof agentRoleSchema>;
export type AgentExecutionMode = z.infer<typeof agentExecutionModeSchema>;
export type WorkflowAccessRole = z.infer<typeof workflowAccessRoleSchema>;
export type AgentTarget = z.infer<typeof agentTargetSchema>;
export type AgentAction = z.infer<typeof agentActionSchema>;
export type AgentToolCall = z.infer<typeof agentToolCallSchema>;
export type AgentStep = z.infer<typeof agentStepSchema>;
export type AgentPlan = z.infer<typeof agentPlanSchema>;

export interface AgentStrategy {
  role: AgentRole;
  label: string;
  capabilities: AgentCapability[];
  canHandle: (context: AgentContext) => boolean;
  plan: (context: AgentContext) => AgentStrategyResult;
}

export interface AgentStrategyResult {
  summary: string;
  actions: AgentAction[];
  toolCalls?: AgentToolCall[];
  warnings?: string[];
}

export interface AgentExecutionResult {
  workflow: Workflow;
  actions: AgentAction[];
  auditLog: AgentRun;
  warnings: string[];
}

export type AgentMutableAction = Exclude<AgentAction, Extract<AgentAction, { kind: "workflow.validate" | "recommendation.generate" | "llm.exportNodeContext" }>>;

export function createAgentAction(
  input: Omit<AgentAction, "id" | "status"> & { id?: string; status?: AgentAction["status"] }
): AgentAction {
  return agentActionSchema.parse({
    ...input,
    id: input.id ?? createAgentId("action"),
    status: input.status ?? "proposed"
  });
}

export function createToolCall(input: Omit<AgentToolCall, "id" | "createdAt" | "status"> & Partial<Pick<AgentToolCall, "id" | "createdAt" | "status">>) {
  return agentToolCallSchema.parse({
    ...input,
    id: input.id ?? createAgentId("tool"),
    createdAt: input.createdAt ?? new Date().toISOString(),
    status: input.status ?? "proposed"
  });
}

export function createAgentId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function selectedNode(context: Pick<AgentContext, "workflow" | "selected">): WorkflowNode | null {
  if (context.selected?.type !== "node") return null;
  return context.workflow.nodes.find((node) => node.id === context.selected?.id) ?? null;
}

export function reviewDocument(value: ReviewDocument) {
  return value;
}

export function edgeKind(value?: string): EdgeKind {
  if (value === "control" || value === "feedback" || value === "approval" || value === "dependency") return value;
  return "data";
}
