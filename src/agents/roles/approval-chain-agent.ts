import type { AgentStrategy } from "../types";
import { action, inferApprovalStatus, inferApprover, inferNodeLabelFromPrompt, lowerPrompt, quotedText, selectedOrLastNodeId, toolCall } from "./helpers";

export const ApprovalChainAgent: AgentStrategy = {
  role: "approval_chain",
  label: "Approval Chain Agent",
  capabilities: [
    { id: "approval_square.add", label: "Add approval square", description: "Create approval-chain squares with creator, approver, instructions, and status." },
    { id: "approval.assignApprover", label: "Assign approver", description: "Assign or update an approver on a square." },
    { id: "approval.setStatus", label: "Set status", description: "Let an approver mark a square in review, approved, or rejected." }
  ],
  canHandle: (context) => context.workflow.flowKind === "approval_chain" || /\b(approval|approver|approve|reject|review|square|chain)\b/i.test(context.prompt),
  plan: (context) => {
    const lower = lowerPrompt(context);
    const actions = [];
    const toolCalls = [toolCall("approval_chain", "workflow.inspect", {})];
    const selectedOrLast = selectedOrLastNodeId(context);

    if (context.workflow.flowKind === "approval_chain" && /\b(add|create|insert)\b/.test(lower) && /\b(square|approval|review|gate)\b/.test(lower)) {
      const label = quotedText(context.prompt).at(0) ?? inferApprovalLabel(lower);
      actions.push(
        action("approval_chain", {
          kind: "approval_square.add",
          title: `Add ${label}`,
          description: "Create an approval-chain square with standard approval metadata.",
          target: { type: "approval_square", label },
          requiresRole: "manager",
          payload: {
            definitionId: lower.includes("document") ? "review-document" : lower.includes("approval") ? "approval" : "human-review",
            label,
            description: `Review and complete ${label}.`,
            creator: context.userName,
            approver: inferApprover(context.prompt) ?? "",
            status: "not_reviewed",
            instructions: `Review evidence, note risks, and record a decision for ${label}.`,
            sourceId: lower.includes("connect") || lower.includes("after") ? selectedOrLast : undefined
          }
        })
      );
    }

    const approver = inferApprover(context.prompt);
    if (approver && /\b(assign|approver|reviewer)\b/.test(lower)) {
      actions.push(
        action("approval_chain", {
          kind: "approval.assignApprover",
          title: `Assign ${approver}`,
          description: "Assign a named approver to an approval square.",
          target: { type: "approval_square", id: context.selected?.type === "node" ? context.selected.id : undefined },
          requiresRole: "manager",
          payload: {
            nodeId: context.selected?.type === "node" ? context.selected.id : undefined,
            nodeLabel: inferNodeLabelFromPrompt(context.workflow, context.prompt),
            approver
          }
        })
      );
    }

    const status = inferApprovalStatus(context.prompt);
    if (status) {
      actions.push(
        action("approval_chain", {
          kind: "approval.setStatus",
          title: `Mark square ${status.replaceAll("_", " ")}`,
          description: "Record an approval decision/status and append to audit trail.",
          target: { type: "approval_square", id: context.selected?.type === "node" ? context.selected.id : undefined },
          requiresRole: context.userRole === "manager" ? "manager" : "approver",
          payload: {
            nodeId: context.selected?.type === "node" ? context.selected.id : undefined,
            nodeLabel: inferNodeLabelFromPrompt(context.workflow, context.prompt),
            status,
            actor: context.userName,
            comments: quotedText(context.prompt).at(0)
          }
        })
      );
    }

    if (!actions.length && context.workflow.flowKind === "approval_chain") {
      actions.push(
        action("approval_chain", {
          kind: "recommendation.generate",
          title: "Approval-chain recommendation",
          target: { type: "workflow", id: context.workflow.id },
          payload: {
            recommendation: "Keep creator-controlled setup separate from approver-controlled decisions. Ensure every approval square has an approver, due date, linked document, and audit trail."
          }
        })
      );
    }

    return {
      summary: actions.length ? "Prepared approval-chain actions." : "Reviewed approval-chain setup.",
      actions,
      toolCalls
    };
  }
};

function inferApprovalLabel(lower: string) {
  if (lower.includes("security")) return "Security Review";
  if (lower.includes("legal")) return "Legal Review";
  if (lower.includes("finance")) return "Finance Review";
  if (lower.includes("data")) return "Data Owner Review";
  if (lower.includes("executive")) return "Executive Approval";
  return "Approval Review";
}
