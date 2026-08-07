import type { Workflow } from "@/domain/types";
import { createAgentAction, createToolCall, selectedNode, type AgentAction, type AgentContext, type AgentRole } from "../types";

export function lowerPrompt(context: AgentContext) {
  return context.prompt.toLowerCase();
}

export function action(
  agentRole: AgentRole,
  kindInput: Omit<AgentAction, "id" | "status" | "agentRole"> & { agentRole?: AgentRole }
) {
  return createAgentAction({ ...kindInput, agentRole });
}

export function toolCall(agentRole: AgentRole, toolName: string, input: Record<string, unknown>) {
  return createToolCall({ agentRole, toolName, input });
}

export function inferNodeDefinitions(text: string) {
  const matches = new Set<string>();
  const map: Array<[string[], string]> = [
    [["database", "sql"], "database"],
    [["data lake", "datalake"], "data-lake"],
    [["api", "endpoint"], "api-source"],
    [["ocr"], "ocr"],
    [["validation", "quality", "check"], "data-validation"],
    [["clean", "normalize"], "data-cleaning"],
    [["transform", "join"], "transformation"],
    [["feature"], "feature-engineering"],
    [["train", "model"], "model-training"],
    [["evaluate", "evaluation", "fairness"], "model-evaluation"],
    [["llm", "gpt", "openai"], "llm"],
    [["agent"], "agent"],
    [["tool", "mcp"], "tool"],
    [["rag", "retrieval"], "rag-retrieval"],
    [["vector"], "vector-db"],
    [["guardrail", "policy"], "guardrail"],
    [["human", "review"], "human-review"],
    [["approval", "approve"], "approval"],
    [["monitor", "drift"], "monitoring"],
    [["alert"], "alert"],
    [["dashboard"], "dashboard"],
    [["report"], "report"]
  ];

  for (const [keywords, definitionId] of map) {
    if (keywords.some((keyword) => text.includes(keyword))) matches.add(definitionId);
  }
  return [...matches];
}

export function selectedOrLastNodeId(context: AgentContext) {
  return selectedNode(context)?.id ?? context.workflow.nodes.at(-1)?.id;
}

export function inferNodeLabelFromPrompt(workflow: Workflow, prompt: string) {
  const lower = prompt.toLowerCase();
  return workflow.nodes.find((node) => lower.includes(node.data.label.toLowerCase()))?.data.label;
}

export function quotedText(prompt: string) {
  return [...prompt.matchAll(/"([^"]+)"/g)].map((match) => match[1].trim()).filter(Boolean);
}

export function inferApprovalStatus(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes("reject")) return "rejected";
  if (lower.includes("approve")) return "approved";
  if (lower.includes("review")) return "in_review";
  return undefined;
}

export function inferApprover(prompt: string) {
  const match = prompt.match(/(?:assign|approver|reviewer)\s+(?:to\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  return match?.[1]?.trim();
}
