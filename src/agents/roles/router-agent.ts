import type { AgentContext, AgentRole } from "../types";
import { lowerPrompt } from "./helpers";

const roleKeywords: Array<[AgentRole, string[]]> = [
  ["approval_chain", ["approval", "approver", "approve", "reject", "review", "square", "chain"]],
  ["document", ["document", "pdf", "docx", "upload", "link", "sop"]],
  ["validation", ["validate", "risk", "issue", "gap", "missing", "quality", "check"]],
  ["provider", ["provider", "azure", "aws", "databricks", "openai", "icon"]],
  ["mcp_tool", ["mcp", "external tool", "connector", "tool server"]],
  ["workflow_architect", ["node", "edge", "connect", "stage", "workflow", "agent", "llm", "add"]]
];

export function routeAgents(context: AgentContext): AgentRole[] {
  const lower = lowerPrompt(context);
  const matches = roleKeywords.filter(([, keywords]) => keywords.some((keyword) => lower.includes(keyword))).map(([role]) => role);
  if (context.workflow.flowKind === "approval_chain" && !matches.includes("approval_chain")) matches.unshift("approval_chain");
  if (!matches.length) matches.push("validation");
  return ["router", ...dedupe(matches), "execution"];
}

function dedupe<T>(items: T[]) {
  return [...new Set(items)];
}
