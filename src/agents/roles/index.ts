import type { AgentRole, AgentStrategy } from "../types";
import { ApprovalChainAgent } from "./approval-chain-agent";
import { DocumentAgent } from "./document-agent";
import { McpToolAgent } from "./mcp-tool-agent";
import { ProviderAgent } from "./provider-agent";
import { routeAgents } from "./router-agent";
import { ValidationAgent } from "./validation-agent";
import { WorkflowArchitectAgent } from "./workflow-architect-agent";

export const agentStrategies: AgentStrategy[] = [
  WorkflowArchitectAgent,
  ApprovalChainAgent,
  DocumentAgent,
  ValidationAgent,
  ProviderAgent,
  McpToolAgent
];

export function getAgentStrategy(role: AgentRole) {
  return agentStrategies.find((strategy) => strategy.role === role);
}

export { routeAgents };
