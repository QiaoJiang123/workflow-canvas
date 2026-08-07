import { getProviderOption } from "@/domain/providers";
import type { AgentStrategy } from "../types";
import { action, lowerPrompt, selectedOrLastNodeId, toolCall } from "./helpers";

export const ProviderAgent: AgentStrategy = {
  role: "provider",
  label: "Provider Agent",
  capabilities: [
    { id: "provider.listOptions", label: "Provider options", description: "Inspect Azure, AWS, Databricks, OpenAI, and general provider choices." },
    { id: "node.update", label: "Set provider", description: "Set node providerId so the canvas shows the matching provider icon." }
  ],
  canHandle: (context) => /\b(provider|azure|aws|databricks|openai|icon|logo|general)\b/i.test(context.prompt),
  plan: (context) => {
    const lower = lowerPrompt(context);
    const nodeId = context.selected?.type === "node" ? context.selected.id : selectedOrLastNodeId(context);
    const selectedNode = nodeId ? context.workflow.nodes.find((node) => node.id === nodeId) : null;
    const providerId = inferProviderId(lower);
    const actions = [];
    const toolCalls = [toolCall("provider", "provider.listOptions", selectedNode ? { definitionId: selectedNode.definitionId } : {})];

    if (nodeId && providerId !== undefined) {
      const provider = getProviderOption(providerId);
      actions.push(
        action("provider", {
          kind: "node.update",
          title: provider ? `Set provider to ${provider.name}` : "Set provider to General",
          description: "Update providerId on the selected node. The node icon will update from the provider icon library.",
          target: { type: "node", id: nodeId },
          requiresRole: "manager",
          payload: {
            nodeId,
            configuration: {
              providerId,
              provider: provider?.name ?? "General"
            }
          }
        })
      );
    }

    if (!actions.length) {
      actions.push(
        action("provider", {
          kind: "recommendation.generate",
          title: "Provider recommendation",
          target: { type: "workflow", id: context.workflow.id },
          payload: {
            recommendation: "Select providerId on each cloud-backed square. Data Lake supports General, Azure, AWS, and Databricks; OCR supports Azure and OpenAI."
          }
        })
      );
    }

    return { summary: "Prepared provider/icon actions.", actions, toolCalls };
  }
};

function inferProviderId(lower: string) {
  if (lower.includes("databricks")) return "databricks";
  if (lower.includes("openai") || lower.includes("open ai")) return "openai";
  if (lower.includes("azure")) return "azure";
  if (lower.includes("aws") || lower.includes("amazon")) return "aws";
  if (lower.includes("general")) return "";
  return undefined;
}
