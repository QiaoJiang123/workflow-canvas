"use client";

import { APPROVAL_CHAIN_TYPE_OPTIONS } from "@/domain/approval-chain-types";
import type { DemoUser } from "@/domain/fake-users";
import { createApprovalChainSample, createInsuranceClaimSeveritySample } from "@/domain/samples";
import type { ApprovalChainType, Workflow } from "@/domain/types";
import { createEmptyWorkflow } from "@/domain/workflow-factory";
import { getAuthSession } from "@/lib/local-auth";
import { deleteWorkflowTableRows, ensureFlowTables, listDocumentRowsForWorkflow, listWorkflowRowsForUser, upsertWorkflowForUser } from "@/lib/local-flow-tables";
import { canUserAccessWorkflow } from "@/lib/workflow-access";
import { BrowserWorkflowRepository } from "@/lib/workflow-repository";
import { AuthStatus } from "./auth-status";
import { LoadingFlow } from "./loading-flow";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarDays,
  BookOpenText,
  Database,
  FilePlus2,
  FileText,
  GitBranch,
  Layers3,
  Search,
  Trash2,
  UserCheck,
  Wand2,
  Workflow as WorkflowIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const repository = new BrowserWorkflowRepository();
const templateOptions = [
  { id: "claims", label: "AI workflow", description: "Blank AI workflow canvas for building ingestion, modeling, deployment, and monitoring from scratch.", kind: "AI Workflow" },
  { id: "approval-chain", label: "Approval chain", description: "Blank approval chain canvas for adding reviewers, approval gates, documents, notifications, and audit records.", kind: "Approval Chain" }
] as const;

type TemplateId = (typeof templateOptions)[number]["id"];

export function WorkflowManager() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null);
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [newWorkflowName, setNewWorkflowName] = useState("New AI workflow");
  const [templateId, setTemplateId] = useState<TemplateId>("claims");
  const [approvalChainType, setApprovalChainType] = useState<ApprovalChainType>("underwriting");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void loadWorkflows();
  }, []);

  const stats = useMemo(
    () => ({
      total: workflows.length,
      nodes: workflows.reduce((sum, workflow) => sum + workflow.nodes.length, 0),
      edges: workflows.reduce((sum, workflow) => sum + workflow.edges.length, 0),
      documents: workflows.reduce((sum, workflow) => sum + (documentCounts[workflow.id] ?? 0), 0)
    }),
    [documentCounts, workflows]
  );
  const filteredWorkflows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return workflows;
    return workflows.filter((workflow) =>
      [workflow.name, workflow.description, workflow.owner, workflow.team, workflow.status, workflow.flowKind, workflow.tags.join(" ")]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [search, workflows]);

  async function loadWorkflows() {
    setIsLoading(true);
    const session = getAuthSession();
    if (!session) {
      setIsLoading(false);
      return;
    }
    setCurrentUser(session.user);
    ensureFlowTables();
    const summaries = await repository.list();
    const ids = new Set(summaries.map((summary) => summary.id));
    if (!ids.has("workflow-claim-severity-sample")) {
      await repository.save(createInsuranceClaimSeveritySample());
    } else {
      const existingSample = await repository.get("workflow-claim-severity-sample");
      if (existingSample && existingSample.flowKind !== "ai_workflow") await repository.save(createInsuranceClaimSeveritySample());
    }
    if (!ids.has("flow-underwriting-approval-chain-sample")) {
      await repository.save(createApprovalChainSample());
    } else {
      const existingApprovalSample = await repository.get("flow-underwriting-approval-chain-sample");
      if (
          existingApprovalSample &&
          (existingApprovalSample.flowKind !== "approval_chain" ||
            existingApprovalSample.approvalChainType !== "underwriting" ||
          !approvalSampleIsCurrent(existingApprovalSample))
      ) {
        await repository.save(createApprovalChainSample());
      }
    }
    let rows = listWorkflowRowsForUser(session.user.id);
    if (!rows.length) {
      const sampleIds = ["workflow-claim-severity-sample", "flow-underwriting-approval-chain-sample"];
      const sampleWorkflows = (await Promise.all(sampleIds.map((id) => repository.get(id)))).filter((workflow): workflow is Workflow => Boolean(workflow));
      for (const workflow of sampleWorkflows) upsertWorkflowForUser(workflow, session.user);
      rows = listWorkflowRowsForUser(session.user.id);
    }
    const refreshedSummaries = await repository.list();
    const loaded = (await Promise.all(refreshedSummaries.map((row) => repository.get(row.id))))
      .filter((workflow): workflow is Workflow => Boolean(workflow))
      .filter((workflow) => canUserAccessWorkflow(workflow, session.user));
    for (const workflow of loaded) upsertWorkflowForUser(workflow, session.user);
    setWorkflows(loaded);
    setDocumentCounts(Object.fromEntries(loaded.map((workflow) => [workflow.id, listDocumentRowsForWorkflow(workflow.id).length])));
    setIsLoading(false);
  }

  async function createWorkflow() {
    const trimmedName = newWorkflowName.trim();
    const workflowName = trimmedName || `Item ${workflows.length + 1}`;
    const session = getAuthSession();
    const workflow = createWorkflowFromTemplate(templateId, workflowName, approvalChainType);
    if (session) {
      workflow.owner = session.user.name;
      workflow.team = session.user.team;
    }
    await repository.save(workflow);
    if (session) upsertWorkflowForUser(workflow, session.user);
    router.push(`/workflows/${workflow.id}`);
  }

  async function deleteWorkflow(id: string) {
    await repository.delete(id);
    deleteWorkflowTableRows(id);
    await loadWorkflows();
  }

  if (isLoading) {
    return <LoadingFlow title="Loading existing flows..." detail="Loading AI workflows, approval chains, documents, and saved metadata." />;
  }

  return (
    <main className="workflow-manager">
      <header className="workflow-manager-header">
        <div className="manager-brand">
          <span className="brand-mark" aria-hidden="true">
            <WorkflowIcon size={18} />
          </span>
          <div>
            <strong>Flow Canvas</strong>
          <span>{currentUser ? `${currentUser.name}'s workflows and approval chains` : "Design AI workflows and approval chains with one shared canvas"}</span>
          </div>
        </div>
        <div className="manager-metrics" aria-label="Canvas item summary">
          <SummaryTile icon={<Layers3 size={14} />} label="Items" value={stats.total} />
          <SummaryTile icon={<WorkflowIcon size={14} />} label="Nodes" value={stats.nodes} />
          <SummaryTile icon={<GitBranch size={14} />} label="Edges" value={stats.edges} />
          <SummaryTile icon={<Database size={14} />} label="Docs" value={stats.documents} />
        </div>
        <div className="manager-actions">
          <AuthStatus />
          <button className="secondary-action" type="button" onClick={() => router.push("/approvals")}>
            <UserCheck size={16} />
            My Approvals
          </button>
          <button className="secondary-action" type="button" onClick={() => router.push("/documents")}>
            <FileText size={16} />
            Documents
          </button>
          <button className="secondary-action" type="button" onClick={() => router.push("/agents")}>
            <Bot size={16} />
            Agents
          </button>
          <button className="secondary-action" type="button" onClick={() => router.push("/docs")}>
            <BookOpenText size={16} />
            Docs
          </button>
          <button className="secondary-action" type="button" onClick={() => router.push("/instructions")}>
            <BookOpenText size={16} />
            Instructions
          </button>
          <button className="primary-action" type="button" onClick={createWorkflow}>
            <FilePlus2 size={16} />
            + Create
          </button>
        </div>
      </header>

      <div className="workflow-home-grid">
        <section className="workflow-list-shell" aria-label="Existing AI workflows and approval chains">
          <div className="workflow-list-header">
            <div>
              <h1>{currentUser ? `${currentUser.name}'s flows` : "My flows"}</h1>
              <p>{`${filteredWorkflows.length} item${filteredWorkflows.length === 1 ? "" : "s"} available.`}</p>
            </div>
            <label className="workflow-search">
              <Search size={15} aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items" />
            </label>
          </div>

          {filteredWorkflows.length === 0 ? (
            <div className="workflow-empty-state">No AI workflows or approval chains match your search.</div>
          ) : (
            <div className="workflow-table">
              {filteredWorkflows.map((workflow) => (
                <article className={`workflow-row ${getFlowKindClass(workflow)}`} key={workflow.id}>
                  <button className="workflow-row-open" type="button" onClick={() => router.push(`/workflows/${workflow.id}`)}>
                    <span className="workflow-card-icon" aria-hidden="true">
                      <WorkflowIcon size={17} />
                    </span>
                    <span className="workflow-card-body">
                      <span className="workflow-card-kicker">{getFlowKindLabel(workflow)} · {workflow.status.replaceAll("_", " ")}</span>
                      <strong>{workflow.name}</strong>
                      <span>{workflow.description || "No description yet."}</span>
                    </span>
                    <span className="workflow-row-meta">
                      <span>{workflow.nodes.length} nodes</span>
                      <span>{workflow.edges.length} edges</span>
                      <span>{documentCounts[workflow.id] ?? 0} docs</span>
                      <span>
                        <CalendarDays size={12} aria-hidden="true" />
                        {formatDate(workflow.updatedAt)}
                      </span>
                    </span>
                    <ArrowRight className="workflow-card-arrow" size={16} aria-hidden="true" />
                  </button>
                  <button className="workflow-row-delete" type="button" aria-label={`Delete ${workflow.name}`} title="Delete item" onClick={() => void deleteWorkflow(workflow.id)}>
                    <Trash2 size={14} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="workflow-create-shell" aria-labelledby="create-flow-title">
          <div className="workflow-list-header">
            <div>
              <h1 id="create-flow-title">New item</h1>
              <p>Pick AI workflow or approval chain, name it, and open the canvas.</p>
            </div>
            <span className="create-panel-icon" aria-hidden="true">
              <Wand2 size={16} />
            </span>
          </div>

          <label className="manager-field">
            <span>Name</span>
            <input value={newWorkflowName} onChange={(event) => setNewWorkflowName(event.target.value)} placeholder="Item name" />
          </label>

          <div className="template-options" role="radiogroup" aria-label="Canvas item type">
            {templateOptions.map((template) => (
              <button
                className={template.id === templateId ? "template-option selected" : "template-option"}
                key={template.id}
                type="button"
                role="radio"
                aria-checked={template.id === templateId}
                onClick={() => setTemplateId(template.id)}
              >
                <span className="template-option-icon" aria-hidden="true">
                  {template.id === "approval-chain" ? <BadgeCheck size={16} /> : <WorkflowIcon size={16} />}
                </span>
                <span>
                  <em>{template.kind}</em>
                  <strong>{template.label}</strong>
                  <small>{template.description}</small>
                </span>
              </button>
            ))}
          </div>

          {templateId === "approval-chain" ? (
            <label className="manager-field">
              <span>Approval chain type</span>
              <select value={approvalChainType} onChange={(event) => setApprovalChainType(event.target.value as ApprovalChainType)}>
                {APPROVAL_CHAIN_TYPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>{APPROVAL_CHAIN_TYPE_OPTIONS.find((option) => option.id === approvalChainType)?.description}</small>
            </label>
          ) : null}

          <button className="create-workflow-button" type="button" onClick={createWorkflow}>
            <FilePlus2 size={16} />
            Create and open
          </button>
        </section>
      </div>
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

function getFlowKindLabel(workflow: Workflow) {
  if (workflow.flowKind === "approval_chain") return "Approval chain";
  return "AI workflow";
}

function getFlowKindClass(workflow: Workflow) {
  return workflow.flowKind === "approval_chain" ? "workflow-row-approval-chain" : "workflow-row-ai-workflow";
}

function approvalSampleIsCurrent(workflow: Workflow) {
  const hasNodeDocuments = workflow.nodes.length > 0 && workflow.nodes.every((node) => Array.isArray(node.data.configuration.documents) && node.data.configuration.documents.length > 0);
  const hasCurrentApprovers = workflow.nodes.some((node) => ["Qiao Jiang", "Chad Gordon", "Johann Sun", "Chae Won Lee"].includes(String(node.data.configuration.approver ?? node.data.configuration.assignee ?? node.data.configuration.reviewer ?? "")));
  const hasCurrentCreator = workflow.nodes.every((node) => String(node.data.configuration.creator ?? "") === "Qiao Jiang");
  return workflow.owner === "Qiao Jiang" && hasNodeDocuments && hasCurrentApprovers && hasCurrentCreator && !workflow.reviewDocuments?.length;
}

function createWorkflowFromTemplate(templateId: TemplateId, name: string, approvalChainType: ApprovalChainType) {
  const workflow = createEmptyWorkflow(name);

  if (templateId === "approval-chain") {
    const chainLabel = APPROVAL_CHAIN_TYPE_OPTIONS.find((option) => option.id === approvalChainType)?.label ?? "Approval";
    return {
      ...workflow,
      flowKind: "approval_chain",
      approvalChainType,
      description: `Blank ${chainLabel.toLowerCase()} approval chain. Add squares, assign approvers, and link review documents as needed.`,
      tags: ["approval-chain", approvalChainType.replaceAll("_", "-")],
      groups: [],
      nodes: [],
      edges: [],
      reviewDocuments: []
    } satisfies Workflow;
  }

  return {
    ...workflow,
    flowKind: "ai_workflow",
    approvalChainType: undefined,
    description: "Blank AI workflow canvas. Add nodes, providers, edges, and stage groups as needed.",
    tags: ["ai-workflow"],
    groups: [],
    nodes: [],
    edges: [],
    reviewDocuments: []
  } satisfies Workflow;
}
