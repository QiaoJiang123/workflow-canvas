import { createAgentId, type AgentAction } from "../types";
import { mcpToolDescriptorSchema, mcpToolResultSchema, type McpToolDescriptor, type McpToolResult } from "./mcp-types";

export interface McpAdapter {
  listTools: () => Promise<McpToolDescriptor[]>;
  runTool: (serverId: string, toolName: string, input: unknown) => Promise<McpToolResult>;
}

export class StaticMcpAdapter implements McpAdapter {
  constructor(private readonly tools: McpToolDescriptor[] = []) {}

  async listTools() {
    return this.tools.map((tool) => mcpToolDescriptorSchema.parse(tool));
  }

  async runTool(serverId: string, toolName: string) {
    const tool = this.tools.find((item) => item.serverId === serverId && item.name === toolName);
    return mcpToolResultSchema.parse({
      serverId,
      toolName,
      status: tool ? "blocked" : "failed",
      error: tool ? "This MCP adapter is registered as catalog-only in the browser demo." : "Tool not found."
    });
  }
}

export function mcpResultToRecommendationAction(result: McpToolResult): AgentAction {
  return {
    id: createAgentId("action"),
    kind: "recommendation.generate",
    title: result.status === "completed" ? `Review ${result.toolName} result` : `MCP ${result.status}: ${result.toolName}`,
    agentRole: "mcp_tool",
    status: "proposed",
    target: { type: "workflow" },
    payload: {
      recommendation:
        result.status === "completed"
          ? `MCP tool ${result.toolName} completed. Convert any suggested mutations into typed workflow actions before applying.`
          : result.error ?? "The MCP call did not complete."
    }
  };
}
