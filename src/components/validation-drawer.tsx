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

  return (
    <section className="validation-drawer" aria-label="Validation">
      <header>
        <strong>Validation</strong>
        <span>{issues.length ? `${issues.length} issues` : "No issues"}</span>
      </header>
      <div className="validation-list">
        {!issues.length && (
          <article className="validation-empty">
            <CheckCircle2 size={18} />
            <span>The flow passes the current validation rules.</span>
          </article>
        )}
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
