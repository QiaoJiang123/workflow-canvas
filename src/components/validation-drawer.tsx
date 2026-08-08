"use client";

import { useWorkflowStore } from "@/store/use-workflow-store";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

export function ValidationDrawer() {
  const validationOpen = useWorkflowStore((state) => state.validationOpen);
  const issues = useWorkflowStore((state) => state.validationIssues);
  const select = useWorkflowStore((state) => state.select);

  if (!validationOpen) {
    return <section className="validation-drawer compact" aria-label="Validation" />;
  }

  if (!issues.length) {
    return (
      <section className="validation-drawer validation-passed" aria-label="Validation passed">
        <CheckCircle2 size={15} />
        <strong>Validation passed</strong>
        <span>No issues found.</span>
      </section>
    );
  }

  return (
    <section className="validation-drawer" aria-label="Validation">
      <header>
        <strong>Validation</strong>
        <span>{`${issues.length} issues`}</span>
      </header>
      <div className="validation-list">
        {issues.map((issue, index) => (
          <button
            type="button"
            key={`${issue.id}-${index}`}
            className={`validation-item ${issue.severity}`}
            onClick={() => {
              if (issue.targetType === "node" && issue.targetId) select({ type: "node", id: issue.targetId });
              if (issue.targetType === "edge" && issue.targetId) select({ type: "edge", id: issue.targetId });
              if (issue.targetType === "workflow") select({ type: "workflow", id: issue.targetId ?? "workflow" });
            }}
          >
            {issue.severity === "error" && <AlertCircle size={16} />}
            {issue.severity === "warning" && <TriangleAlert size={16} />}
            {issue.severity === "info" && <Info size={16} />}
            <span>
              <strong>{issue.title}</strong>
              <small>{issue.message}</small>
              {issue.suggestion ? <small className="validation-suggestion">Suggestion: {issue.suggestion}</small> : null}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
