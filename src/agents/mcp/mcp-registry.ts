import { StaticMcpAdapter } from "./mcp-tool-adapter";
import type { McpToolDescriptor } from "./mcp-types";

export const recommendedMcpTools: McpToolDescriptor[] = [
  {
    serverId: "azure-documents",
    name: "search_documents",
    title: "Search Azure/SharePoint Documents",
    description: "Find SOP, evidence, and review packet documents before linking them to approval squares.",
    writeRisk: "read"
  },
  {
    serverId: "azure-sql",
    name: "inspect_schema",
    title: "Inspect Azure SQL Schema",
    description: "Compare production user, workflow, approval, square, and document tables against app data structures.",
    writeRisk: "read"
  },
  {
    serverId: "api-catalog",
    name: "list_openapi_specs",
    title: "List API Catalog",
    description: "Discover APIM/OpenAPI endpoints for provider-backed AI workflow nodes.",
    writeRisk: "read"
  }
];

export const defaultMcpAdapter = new StaticMcpAdapter(recommendedMcpTools);
