"use client";

import { normalizeApprovalSquareData } from "@/domain/approval-node-presets";
import type { Workflow, WorkflowNode } from "@/domain/types";
import { getAuthSession } from "@/lib/local-auth";
import { ensureFlowTables, listWorkflowRowsForUser } from "@/lib/local-flow-tables";
import { BrowserWorkflowRepository } from "@/lib/workflow-repository";
import { AuthStatus } from "./auth-status";
import { LoadingFlow } from "./loading-flow";
import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, Search, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const repository = new BrowserWorkflowRepository();

interface ApprovalQueueItem {
  id: string;
  workflowId: string;
  workflowName: string;
  nodeId: string;
  squareName: string;
  approver: string;
  creator: string;
  type: string;
  status: string;
  dueDate: string;
  documents: number;
  description: string;
  assignedToMe: boolean;
}

export function ApprovalWorkQueuePage() {
  const router = useRouter();
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [currentUserName, setCurrentUserName] = useState("");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadQueue();
  }, []);

  async function loadQueue() {
    const session = getAuthSession();
    if (!session) {
      setLoading(false);
      return;
    }
    setCurrentUserName(session.user.name);
    ensureFlowTables();
    const rows = listWorkflowRowsForUser(session.user.id);
    const workflows = (await Promise.all(rows.map((row) => repository.get(row.workflowId)))).filter((workflow): workflow is Workflow => Boolean(workflow));
    setItems(workflows.flatMap((workflow) => buildQueueItems(workflow, session.user.name)));
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const scoped = scope === "mine" ? items.filter((item) => item.assignedToMe) : items;
    const sorted = [...scoped].sort((a, b) => Number(b.assignedToMe) - Number(a.assignedToMe) || a.status.localeCompare(b.status) || a.squareName.localeCompare(b.squareName));
    if (!normalized) return sorted;
    return sorted.filter((item) =>
      [item.workflowName, item.squareName, item.approver, item.creator, item.type, item.status, item.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [items, query, scope]);

  const assignedCount = items.filter((item) => item.assignedToMe).length;

  if (loading) {
    return <LoadingFlow title="Loading approvals..." detail="Finding approval squares, assignees, documents, and due dates." />;
  }

  return (
    <main className="docs-page approval-queue-page">
      <header className="docs-header">
        <div className="manager-brand">
          <span className="brand-mark" aria-hidden="true">
            <UserCheck size={18} />
          </span>
          <div>
            <strong>My Approvals</strong>
            <span>{currentUserName ? `${assignedCount} assigned to ${currentUserName}` : "Approval work queue"}</span>
          </div>
        </div>
        <div className="manager-actions">
          <AuthStatus />
          <button className="secondary-action" type="button" onClick={() => router.push("/workflows")}>
            <ArrowLeft size={16} />
            Workflows
          </button>
        </div>
      </header>

      <section className="management-shell">
        <div className="workflow-list-header">
          <div>
            <h1>Approval queue</h1>
            <p>{`${filtered.length} approval square${filtered.length === 1 ? "" : "s"} visible.`}</p>
          </div>
          <div className="queue-controls">
            <div className="segmented-control" role="group" aria-label="Approval queue scope">
              <button type="button" className={scope === "mine" ? "active" : ""} onClick={() => setScope("mine")}>Assigned to me</button>
              <button type="button" className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>All visible</button>
            </div>
            <label className="workflow-search">
              <Search size={15} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search approvals" />
            </label>
          </div>
        </div>

        {filtered.length ? (
          <div className="approval-queue-list">
            {filtered.map((item) => (
              <article className={item.assignedToMe ? "approval-queue-card assigned" : "approval-queue-card"} key={item.id}>
                <div>
                  <span className={`approval-status ${item.status}`}>
                    {item.status === "approved" ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
                    {item.status.replaceAll("_", " ")}
                  </span>
                  <small className="approval-workflow-name">{item.workflowName}</small>
                  <strong>{item.squareName}</strong>
                  <p>{item.description || "No approval description yet."}</p>
                </div>
                <dl>
                  <div>
                    <dt>Approver</dt>
                    <dd>{item.approver || "Unassigned"}</dd>
                  </div>
                  <div>
                    <dt>Creator</dt>
                    <dd>{item.creator || "Unassigned"}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{item.type}</dd>
                  </div>
                  <div>
                    <dt>Docs</dt>
                    <dd>{item.documents}</dd>
                  </div>
                  <div>
                    <dt>Due</dt>
                    <dd>{item.dueDate || "No date"}</dd>
                  </div>
                </dl>
                <button type="button" onClick={() => router.push(`/workflows/${item.workflowId}`)}>
                  <ExternalLink size={14} />
                  Open workflow
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="workflow-empty-state rich-empty-state">
            <UserCheck size={20} />
            <strong>{scope === "mine" ? "No approvals assigned to you" : "No approval squares available"}</strong>
            <span>{query ? "Try a different search." : "Your queue is clear."}</span>
          </div>
        )}
      </section>
    </main>
  );
}

function buildQueueItems(workflow: Workflow, currentUserName: string): ApprovalQueueItem[] {
  if (workflow.flowKind !== "approval_chain") return [];
  return workflow.nodes.map((node) => {
    const data = normalizeApprovalSquareData(node.data.configuration, {
      label: node.data.label,
      description: node.data.description,
      owner: node.data.owner,
      workflowOwner: workflow.owner,
      approvalChainType: workflow.approvalChainType
    });
    return {
      id: `${workflow.id}-${node.id}`,
      workflowId: workflow.id,
      workflowName: workflow.name,
      nodeId: node.id,
      squareName: node.data.label,
      approver: data.approver,
      creator: data.creator,
      type: data.approvalType,
      status: data.status,
      dueDate: data.dueDate,
      documents: data.documents.length,
      description: data.description,
      assignedToMe: namesMatch(data.approver, currentUserName)
    };
  });
}

function namesMatch(left: string, right: string) {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}
