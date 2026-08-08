"use client";

import { AuthStatus } from "./auth-status";
import { LoadingFlow } from "./loading-flow";
import { getAuthSession } from "@/lib/local-auth";
import { ensureFlowTables, listDocumentRowsForUser, listWorkflowRowsForUser, type DocumentTableRow } from "@/lib/local-flow-tables";
import { ArrowLeft, ExternalLink, FileText, Search, Workflow } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function DocumentManagementPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentTableRow[]>([]);
  const [workflowNames, setWorkflowNames] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      setLoading(false);
      return;
    }
    ensureFlowTables();
    setDocuments(listDocumentRowsForUser(session.user.id));
    setWorkflowNames(Object.fromEntries(listWorkflowRowsForUser(session.user.id).map((row) => [row.workflowId, row.name])));
    setLoading(false);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return documents;
    return documents.filter((document) =>
      [document.title, document.documentType, document.summary, document.workflowId, document.nodeId, workflowNames[document.workflowId]]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [documents, query, workflowNames]);

  if (loading) {
    return <LoadingFlow title="Loading documents..." detail="Collecting linked PDFs, DOCX files, and approval-square references." />;
  }

  return (
    <main className="docs-page document-page">
      <header className="docs-header">
        <div className="manager-brand">
          <span className="brand-mark" aria-hidden="true">
            <FileText size={18} />
          </span>
          <div>
            <strong>Documents</strong>
            <span>Review files linked to approval chains and workflow squares</span>
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
            <h1>Document table</h1>
            <p>{`${filtered.length} document${filtered.length === 1 ? "" : "s"} available.`}</p>
          </div>
          <label className="workflow-search">
            <Search size={15} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" />
          </label>
        </div>

        {filtered.length ? (
          <div className="management-table">
            <div className="management-row header">
              <strong>Document</strong>
              <strong>Workflow</strong>
              <strong>Square</strong>
              <strong>Type</strong>
              <strong>Open</strong>
            </div>
            {filtered.map((document) => (
              <div className="management-row" key={document.id}>
                <span data-label="Document">
                  <strong>{document.title}</strong>
                  <small>{document.summary || "No summary yet."}</small>
                </span>
                <button data-label="Workflow" type="button" onClick={() => router.push(`/workflows/${document.workflowId}`)}>
                  <Workflow size={14} />
                  {workflowNames[document.workflowId] ?? document.workflowId}
                </button>
                <span data-label="Square">{document.nodeId ?? "Workflow-level"}</span>
                <span data-label="Type">{document.documentType.toUpperCase()}</span>
                <a data-label="Open" href={document.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} />
                  Open
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="workflow-empty-state rich-empty-state">
            <FileText size={20} />
            <strong>No linked documents</strong>
            <span>Documents assigned to accessible workflows will appear here.</span>
          </div>
        )}
      </section>
    </main>
  );
}
