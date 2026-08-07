import type { AgentStrategy } from "../types";
import { action, inferNodeDefinitions, lowerPrompt, quotedText, selectedOrLastNodeId, toolCall } from "./helpers";

export const WorkflowArchitectAgent: AgentStrategy = {
  role: "workflow_architect",
  label: "Workflow Architect",
  capabilities: [
    { id: "node.add", label: "Add nodes", description: "Add AI workflow nodes from the existing node catalog." },
    { id: "edge.add", label: "Connect edges", description: "Connect existing or newly created nodes." },
    { id: "group.add", label: "Create stages", description: "Create stage rectangles for workflow phases." }
  ],
  canHandle: (context) => context.workflow.flowKind === "ai_workflow" || /\b(node|edge|connect|stage|llm|agent|workflow)\b/i.test(context.prompt),
  plan: (context) => {
    const lower = lowerPrompt(context);
    const actions = [];
    const toolCalls = [toolCall("workflow_architect", "workflow.inspect", {})];
    const anchor = selectedOrLastNodeId(context);

    if (/\b(add|create|insert|include)\b/.test(lower)) {
      const definitions = inferNodeDefinitions(lower);
      definitions.forEach((definitionId, index) => {
        actions.push(
          action("workflow_architect", {
            kind: "node.add",
            title: `Add ${definitionId.replaceAll("-", " ")}`,
            description: "Add a workflow node selected by the architect agent.",
            target: { type: "node", label: definitionId },
            requiresRole: "manager",
            payload: {
              definitionId,
              status: "not_started",
              sourceId: lower.includes("connect") || lower.includes("after") ? (index === 0 ? anchor : "__previous__") : undefined,
              edgeLabel: "Agent added",
              edgeType: lower.includes("approval") ? "approval" : "data"
            }
          })
        );
      });
    }

    const connection = context.prompt.match(/connect\s+(.+?)\s+(?:to|->)\s+(.+?)(?:\.|$)/i);
    if (connection) {
      actions.push(
        action("workflow_architect", {
          kind: "edge.add",
          title: "Connect workflow nodes",
          target: { type: "edge" },
          requiresRole: "manager",
          payload: {
            sourceLabel: connection[1].trim(),
            targetLabel: connection[2].trim(),
            type: lower.includes("approval") ? "approval" : "data",
            label: "Agent connection"
          }
        })
      );
    }

    if (lower.includes("stage")) {
      actions.push(
        action("workflow_architect", {
          kind: "group.add",
          title: "Create stage group",
          target: { type: "group", label: quotedText(context.prompt).at(0) ?? "Agent stage" },
          requiresRole: "manager",
          payload: {
            title: quotedText(context.prompt).at(0) ?? "Agent stage",
            description: "Stage created by the Workflow Architect agent."
          }
        })
      );
    }

    if (!actions.length && /\b(improve|recommend|design)\b/.test(lower)) {
      actions.push(
        action("workflow_architect", {
          kind: "recommendation.generate",
          title: "Workflow architecture recommendation",
          target: { type: "workflow", id: context.workflow.id },
          payload: {
            recommendation: "Make source, validation, model/LLM, human review, deployment, monitoring, and feedback stages explicit before production."
          }
        })
      );
    }

    return {
      summary: actions.length ? "Prepared AI workflow architecture changes." : "Reviewed the AI workflow structure.",
      actions,
      toolCalls
    };
  }
};
