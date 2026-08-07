import { validateWorkflow } from "@/domain/validation";
import type { AgentStrategy } from "../types";
import { action, toolCall } from "./helpers";

export const ValidationAgent: AgentStrategy = {
  role: "validation",
  label: "Validation Agent",
  capabilities: [
    { id: "workflow.validate", label: "Validate workflow", description: "Check structure, disconnected items, missing metadata, and review gaps." },
    { id: "recommendation.generate", label: "Recommend fixes", description: "Translate validation findings into user-facing improvement steps." }
  ],
  canHandle: (context) => /\b(validate|risk|issue|gap|missing|quality|check|review|recommend|improve)\b/i.test(context.prompt),
  plan: (context) => {
    const findings = validateWorkflow(context.workflow);
    const errors = findings.filter((finding) => finding.severity === "error");
    const warnings = findings.filter((finding) => finding.severity === "warning");
    const recommendation =
      findings
        .slice(0, 5)
        .map((finding) => `${finding.title}: ${finding.suggestion ?? finding.message}`)
        .join(" ") ||
      "The structure is valid. Next improvement is to add explicit owners, required documents, and approval evidence for production workflows.";

    return {
      summary: `Found ${errors.length} errors and ${warnings.length} warnings.`,
      actions: [
        action("validation", {
          kind: "workflow.validate",
          title: "Validate workflow",
          target: { type: "workflow", id: context.workflow.id },
          payload: {}
        }),
        action("validation", {
          kind: "recommendation.generate",
          title: "Validation recommendation",
          target: { type: "workflow", id: context.workflow.id },
          payload: { recommendation }
        })
      ],
      toolCalls: [toolCall("validation", "workflow.validate", {})],
      warnings: findings.slice(0, 6).map((finding) => `${finding.severity}: ${finding.title}`)
    };
  }
};
