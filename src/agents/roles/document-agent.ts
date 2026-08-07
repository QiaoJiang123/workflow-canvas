import type { ReviewDocument } from "@/domain/types";
import type { AgentStrategy } from "../types";
import { action, lowerPrompt, quotedText, selectedOrLastNodeId, toolCall } from "./helpers";

export const DocumentAgent: AgentStrategy = {
  role: "document",
  label: "Document Agent",
  capabilities: [
    { id: "document.list", label: "Inspect documents", description: "List workflow and square-linked documents." },
    { id: "document.linkToNode", label: "Link document", description: "Attach a review document to a selected square or node." },
    { id: "llm.exportNodeContext", label: "Export LLM package", description: "Prepare selected square context for LLM evaluation." }
  ],
  canHandle: (context) => /\b(document|pdf|doc|docx|upload|link|sop|llm|export)\b/i.test(context.prompt),
  plan: (context) => {
    const lower = lowerPrompt(context);
    const nodeId = context.selected?.type === "node" ? context.selected.id : selectedOrLastNodeId(context);
    const actions = [];
    const toolCalls = [toolCall("document", "document.list", nodeId ? { nodeId } : {})];

    if (nodeId && /\b(link|attach|assign|add)\b/.test(lower) && /\b(document|pdf|doc|docx|sop)\b/.test(lower)) {
      const title = quotedText(context.prompt).at(0) ?? inferDocumentTitle(lower);
      const document: ReviewDocument = {
        id: `agent-doc-${Date.now().toString(36)}`,
        title,
        type: lower.includes("doc") && !lower.includes("pdf") ? "doc" : "pdf",
        url: `/documents/${slugify(title)}.${lower.includes("doc") && !lower.includes("pdf") ? "docx" : "pdf"}`,
        owner: context.userName,
        summary: `Agent-created placeholder link for ${title}.`
      };
      actions.push(
        action("document", {
          kind: "document.linkToNode",
          title: `Link ${title}`,
          description: "Attach the document to the selected square so only that square shows it.",
          target: { type: "document", id: document.id, label: title },
          requiresRole: "manager",
          payload: { nodeId, document }
        })
      );
    }

    if (nodeId && /\b(llm|evaluation|evaluate|export)\b/.test(lower)) {
      actions.push(
        action("document", {
          kind: "llm.exportNodeContext",
          title: "Prepare LLM evaluation package",
          description: "This read-only action identifies the selected square context package.",
          target: { type: "node", id: nodeId },
          payload: { nodeId }
        })
      );
    }

    if (!actions.length) {
      actions.push(
        action("document", {
          kind: "recommendation.generate",
          title: "Document recommendation",
          target: { type: "workflow", id: context.workflow.id },
          payload: {
            recommendation: "Keep workflow-level documents separate from square-linked documents. Approvers should only see documents assigned to their square."
          }
        })
      );
    }

    return { summary: "Prepared document actions.", actions, toolCalls };
  }
};

function inferDocumentTitle(lower: string) {
  if (lower.includes("sop")) return "Review SOP";
  if (lower.includes("checklist")) return "Approval Checklist";
  if (lower.includes("evidence")) return "Evidence Packet";
  return "Review Document";
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "review-document";
}
