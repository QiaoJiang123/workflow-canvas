import type { AgentStrategy } from "../types";
import { action, lowerPrompt, toolCall } from "./helpers";

export const McpToolAgent: AgentStrategy = {
  role: "mcp_tool",
  label: "MCP Tool Agent",
  capabilities: [
    { id: "mcp.catalog", label: "MCP catalog", description: "Recommend MCP tools that could be attached to future agent runs." },
    { id: "workflow.proposePatch", label: "Tool-safe plan", description: "Keep external tool work behind explicit proposed actions." }
  ],
  canHandle: (context) => /\b(mcp|external tool|connector|tool server|jira|sharepoint|sql|azure)\b/i.test(context.prompt),
  plan: (context) => {
    const lower = lowerPrompt(context);
    const recommendation = [
      "Use MCP only through a typed adapter: list tools, validate schemas, run read-only calls by default, then convert writes into proposed AgentAction records.",
      lower.includes("azure") ? "For Azure production, useful MCP targets are Azure SQL metadata, Blob/SharePoint documents, APIM/OpenAPI catalogs, and audit log readers." : "",
      "Never let an MCP response mutate the canvas directly; route every mutation through /api/agents/execute."
    ]
      .filter(Boolean)
      .join(" ");

    return {
      summary: "Prepared MCP orchestration recommendation.",
      actions: [
        action("mcp_tool", {
          kind: "recommendation.generate",
          title: "MCP orchestration recommendation",
          target: { type: "workflow", id: context.workflow.id },
          payload: { recommendation }
        })
      ],
      toolCalls: [toolCall("mcp_tool", "mcp.catalog", { query: context.prompt })]
    };
  }
};
