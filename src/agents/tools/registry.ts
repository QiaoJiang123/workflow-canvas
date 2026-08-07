import { z } from "zod";
import { NODE_DEFINITIONS, getNodeDefinition } from "@/domain/node-definitions";
import { getProviderOptionsForNode, PROVIDER_ICON_LIBRARY } from "@/domain/providers";
import type { ReviewDocument, Workflow } from "@/domain/types";
import { validateWorkflow } from "@/domain/validation";
import { agentActionSchema, createAgentAction, type AgentAction, type AgentContext, type WorkflowAccessRole } from "../types";
import { executeAgentActions } from "../executor";

export interface AgentToolDefinition<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<Input>;
  outputSchema: z.ZodType<Output>;
  permission: WorkflowAccessRole | "any";
  run: (input: Input, context: AgentContext) => Output;
}

const nodePatchSchema = z.object({
  nodeId: z.string().optional(),
  nodeLabel: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  technology: z.string().optional(),
  notes: z.string().optional(),
  configuration: z.record(z.unknown()).optional()
});

export const agentToolRegistry = [
  tool({
    name: "workflow.inspect",
    description: "Summarize the current workflow graph, selected item, and counts.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      workflowId: z.string(),
      name: z.string(),
      flowKind: z.string(),
      nodeCount: z.number(),
      edgeCount: z.number(),
      groupCount: z.number(),
      selected: z.string()
    }),
    permission: "any",
    run: (_input, context) => ({
      workflowId: context.workflow.id,
      name: context.workflow.name,
      flowKind: context.workflow.flowKind,
      nodeCount: context.workflow.nodes.length,
      edgeCount: context.workflow.edges.length,
      groupCount: context.workflow.groups.length,
      selected: context.selected?.id ?? "workflow"
    })
  }),
  tool({
    name: "workflow.validate",
    description: "Run workflow validation and return findings.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      issueCount: z.number(),
      errors: z.number(),
      warnings: z.number(),
      messages: z.array(z.string())
    }),
    permission: "any",
    run: (_input, context) => {
      const issues = validateWorkflow(context.workflow);
      return {
        issueCount: issues.length,
        errors: issues.filter((issue) => issue.severity === "error").length,
        warnings: issues.filter((issue) => issue.severity === "warning").length,
        messages: issues.slice(0, 8).map((issue) => `${issue.severity}: ${issue.title} - ${issue.message}`)
      };
    }
  }),
  tool({
    name: "workflow.proposePatch",
    description: "Return typed proposed actions for the user to approve.",
    inputSchema: z.object({ actions: z.array(agentActionSchema) }),
    outputSchema: z.object({ actions: z.array(agentActionSchema) }),
    permission: "any",
    run: (input) => ({ actions: input.actions })
  }),
  tool({
    name: "workflow.applyPatch",
    description: "Apply already approved typed actions to a workflow.",
    inputSchema: z.object({ actions: z.array(agentActionSchema), approvedActionIds: z.array(z.string()).optional() }),
    outputSchema: z.object({ workflow: z.unknown(), warnings: z.array(z.string()) }),
    permission: "manager",
    run: (input, context) => {
      const result = executeAgentActions({
        workflow: context.workflow,
        actions: input.actions as AgentAction[],
        approvedActionIds: input.approvedActionIds,
        selected: context.selected,
        userRole: context.userRole,
        userName: context.userName,
        prompt: context.prompt
      });
      return { workflow: result.workflow, warnings: result.warnings };
    }
  }),
  tool({
    name: "node.add",
    description: "Create a proposed node.add action.",
    inputSchema: z.object({ definitionId: z.string(), label: z.string().optional(), sourceId: z.string().optional() }),
    outputSchema: z.object({ action: agentActionSchema }),
    permission: "manager",
    run: (input) => ({
      action: createAgentAction({
        kind: "node.add",
        title: `Add ${getNodeDefinition(input.definitionId)?.name ?? input.definitionId}`,
        agentRole: "workflow_architect",
        target: { type: "node", label: input.label },
        requiresRole: "manager",
        payload: input
      })
    })
  }),
  tool({
    name: "node.update",
    description: "Create a proposed node.update action.",
    inputSchema: nodePatchSchema,
    outputSchema: z.object({ action: agentActionSchema }),
    permission: "manager",
    run: (input) => ({
      action: createAgentAction({
        kind: "node.update",
        title: "Update node content",
        agentRole: "workflow_architect",
        target: { type: "node", id: input.nodeId, label: input.nodeLabel },
        requiresRole: "manager",
        payload: input
      })
    })
  }),
  tool({
    name: "edge.add",
    description: "Create a proposed edge.add action.",
    inputSchema: z.object({ sourceId: z.string().optional(), sourceLabel: z.string().optional(), targetId: z.string().optional(), targetLabel: z.string().optional(), type: z.enum(["data", "control", "feedback", "approval", "dependency"]).default("data"), label: z.string().optional() }),
    outputSchema: z.object({ action: agentActionSchema }),
    permission: "manager",
    run: (input) => ({
      action: createAgentAction({
        kind: "edge.add",
        title: "Add connection",
        agentRole: "workflow_architect",
        target: { type: "edge" },
        requiresRole: "manager",
        payload: input
      })
    })
  }),
  tool({
    name: "edge.update",
    description: "Create a proposed edge.update action.",
    inputSchema: z.object({ edgeId: z.string(), label: z.string().optional(), description: z.string().optional(), curvature: z.number().min(0).max(1).optional() }),
    outputSchema: z.object({ action: agentActionSchema }),
    permission: "manager",
    run: (input) => ({
      action: createAgentAction({
        kind: "edge.update",
        title: "Update connection",
        agentRole: "workflow_architect",
        target: { type: "edge", id: input.edgeId },
        requiresRole: "manager",
        payload: input
      })
    })
  }),
  tool({
    name: "document.list",
    description: "List workflow-level and square-linked documents.",
    inputSchema: z.object({ nodeId: z.string().optional() }),
    outputSchema: z.object({ documents: z.array(z.unknown()) }),
    permission: "any",
    run: (input, context) => ({
      documents: input.nodeId ? getNodeDocuments(context.workflow, input.nodeId) : context.workflow.reviewDocuments ?? []
    })
  }),
  tool({
    name: "document.linkToNode",
    description: "Create a proposed document.linkToNode action.",
    inputSchema: z.object({ nodeId: z.string(), document: z.object({ id: z.string(), title: z.string(), type: z.enum(["pdf", "doc", "text"]), url: z.string(), owner: z.string().optional(), summary: z.string().optional() }) }),
    outputSchema: z.object({ action: agentActionSchema }),
    permission: "manager",
    run: (input) => ({
      action: createAgentAction({
        kind: "document.linkToNode",
        title: `Link ${input.document.title}`,
        agentRole: "document",
        target: { type: "document", id: input.document.id },
        requiresRole: "manager",
        payload: input
      })
    })
  }),
  tool({
    name: "approval.assignApprover",
    description: "Create a proposed approver assignment action.",
    inputSchema: z.object({ nodeId: z.string().optional(), nodeLabel: z.string().optional(), approver: z.string() }),
    outputSchema: z.object({ action: agentActionSchema }),
    permission: "manager",
    run: (input) => ({
      action: createAgentAction({
        kind: "approval.assignApprover",
        title: `Assign ${input.approver}`,
        agentRole: "approval_chain",
        target: { type: "approval_square", id: input.nodeId, label: input.nodeLabel },
        requiresRole: "manager",
        payload: input
      })
    })
  }),
  tool({
    name: "approval.setStatus",
    description: "Create a proposed approval status action.",
    inputSchema: z.object({ nodeId: z.string().optional(), nodeLabel: z.string().optional(), status: z.enum(["not_reviewed", "in_review", "approved", "rejected"]), comments: z.string().optional() }),
    outputSchema: z.object({ action: agentActionSchema }),
    permission: "approver",
    run: (input) => ({
      action: createAgentAction({
        kind: "approval.setStatus",
        title: `Set approval to ${input.status.replaceAll("_", " ")}`,
        agentRole: "approval_chain",
        target: { type: "approval_square", id: input.nodeId, label: input.nodeLabel },
        requiresRole: "approver",
        payload: input
      })
    })
  }),
  tool({
    name: "provider.listOptions",
    description: "List supported provider options and icon paths.",
    inputSchema: z.object({ definitionId: z.string().optional() }),
    outputSchema: z.object({ providers: z.array(z.unknown()), nodeDefinitions: z.array(z.string()) }),
    permission: "any",
    run: (input) => ({
      providers: input.definitionId ? getProviderOptionsForNode(input.definitionId) : PROVIDER_ICON_LIBRARY,
      nodeDefinitions: NODE_DEFINITIONS.map((definition) => definition.id)
    })
  })
] as const;

export type AgentToolName = (typeof agentToolRegistry)[number]["name"];

export function getAgentTool(name: string) {
  return agentToolRegistry.find((toolDefinition) => toolDefinition.name === name);
}

export function runAgentTool(name: string, input: unknown, context: AgentContext) {
  const definition = getAgentTool(name);
  if (!definition) throw new Error(`Unknown agent tool: ${name}`);
  const parsedInput = definition.inputSchema.parse(input);
  const output = (definition.run as (parsed: unknown, agentContext: AgentContext) => unknown)(parsedInput, context);
  return definition.outputSchema.parse(output);
}

function tool<Input, Output>(definition: AgentToolDefinition<Input, Output>) {
  return definition;
}

function getNodeDocuments(workflow: Workflow, nodeId: string): ReviewDocument[] {
  const node = workflow.nodes.find((item) => item.id === nodeId);
  const documents = node?.data.configuration.documents;
  return Array.isArray(documents) ? documents.filter(isReviewDocument) : [];
}

function isReviewDocument(value: unknown): value is ReviewDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<ReviewDocument>;
  return typeof document.id === "string" && typeof document.title === "string" && typeof document.url === "string" && (document.type === "pdf" || document.type === "doc" || document.type === "text");
}
