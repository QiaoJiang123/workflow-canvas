"use client";

import { createInsuranceClaimSeveritySample, createSimpleDemoWorkflow } from "@/domain/samples";
import type { Workflow } from "@/domain/types";
import { createEmptyWorkflow } from "@/domain/workflow-factory";
import { BrowserWorkflowRepository } from "@/lib/workflow-repository";
import { ArrowRight, FilePlus2, GitBranch, Layers3, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const repository = new BrowserWorkflowRepository();

export function WorkflowManager() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadWorkflows();
  }, []);

  const stats = useMemo(
    () => ({
      total: workflows.length,
      nodes: workflows.reduce((sum, workflow) => sum + workflow.nodes.length, 0),
      edges: workflows.reduce((sum, workflow) => sum + workflow.edges.length, 0)
    }),
    [workflows]
  );

  async function loadWorkflows() {
    setIsLoading(true);
    const summaries = await repository.list();
    const ids = new Set(summaries.map((summary) => summary.id));
    if (!ids.has("workflow-simple-document-approval")) {
      await repository.save(createSimpleDemoWorkflow());
    }
    if (!ids.has("workflow-claim-severity-sample")) {
      await repository.save(createInsuranceClaimSeveritySample());
    }
    const seededSummaries = await repository.list();
    const loaded = await Promise.all(seededSummaries.map((summary) => repository.get(summary.id)));
    setWorkflows(loaded.filter((workflow): workflow is Workflow => Boolean(workflow)));
    setIsLoading(false);
  }

  async function createWorkflow() {
    const workflow = createEmptyWorkflow(`Workflow ${workflows.length + 1}`);
    await repository.save(workflow);
    router.push(`/workflows/${workflow.id}`);
  }

  async function deleteWorkflow(id: string) {
    await repository.delete(id);
    await loadWorkflows();
  }

  return (
    <main className="workflow-manager">
      <header className="workflow-manager-header">
        <div className="manager-brand">
          <span className="brand-mark" aria-hidden="true">
            <WorkflowIcon size={18} />
          </span>
          <div>
            <strong>Workflow Canvas</strong>
            <span>Manage saved workflow demos and drafts</span>
          </div>
        </div>
        <button className="primary-action" type="button" onClick={createWorkflow}>
          <FilePlus2 size={16} />
          + Workflow
        </button>
      </header>

      <section className="workflow-manager-summary" aria-label="Workflow summary">
        <SummaryTile icon={<Layers3 size={16} />} label="Workflows" value={stats.total} />
        <SummaryTile icon={<WorkflowIcon size={16} />} label="Nodes" value={stats.nodes} />
        <SummaryTile icon={<GitBranch size={16} />} label="Edges" value={stats.edges} />
      </section>

      <section className="workflow-list-shell" aria-label="Saved workflows">
        <div className="workflow-list-header">
          <div>
            <h1>Workflows</h1>
            <p>{isLoading ? "Loading workflows" : "Open a workflow or create a new canvas."}</p>
          </div>
        </div>

        <div className="workflow-grid">
          {workflows.map((workflow) => (
            <article className="workflow-card" key={workflow.id}>
              <button className="workflow-card-open" type="button" onClick={() => router.push(`/workflows/${workflow.id}`)}>
                <span className="workflow-card-icon" aria-hidden="true">
                  <WorkflowIcon size={18} />
                </span>
                <span className="workflow-card-body">
                  <span className="workflow-card-kicker">{workflow.status.replaceAll("_", " ")}</span>
                  <strong>{workflow.name}</strong>
                  <span>{workflow.description || "No description yet."}</span>
                </span>
                <ArrowRight className="workflow-card-arrow" size={16} aria-hidden="true" />
              </button>
              <footer>
                <span>{workflow.nodes.length} nodes</span>
                <span>{workflow.edges.length} edges</span>
                <span>{formatDate(workflow.updatedAt)}</span>
                <button type="button" aria-label={`Delete ${workflow.name}`} title="Delete workflow" onClick={() => void deleteWorkflow(workflow.id)}>
                  <Trash2 size={14} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function SummaryTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="manager-summary-tile">
      <span aria-hidden="true">{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
