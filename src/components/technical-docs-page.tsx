"use client";

import { AuthStatus } from "./auth-status";
import { APPROVER_TABLE_SQL } from "@/lib/litesql-approver-table";
import {
  APPROVAL_CHAIN_TABLE_SQL,
  APPROVAL_SQUARE_TABLE_SQL,
  AGENT_ACTION_TABLE_SQL,
  AGENT_RUN_TABLE_SQL,
  AGENT_STEP_TABLE_SQL,
  AGENT_TOOL_CALL_TABLE_SQL,
  DOCUMENT_TABLE_SQL,
  SQUARE_DOCUMENT_TABLE_SQL,
  USER_TABLE_SQL,
  WORKFLOW_TABLE_SQL
} from "@/lib/local-flow-tables";
import { ArrowLeft, BookOpenText, Database, FileText, GitBranch, LockKeyhole, Workflow } from "lucide-react";
import { useRouter } from "next/navigation";

const localStores = [
  ["workflow-canvas:litesql:users", "Users table", "Demo users available at login."],
  ["workflow-canvas:litesql:workflows", "Workflows table", "Maps saved workflows to invited users. Approval chains expose Creator and Approver roles in the UI."],
  ["workflow-canvas:litesql:documents", "Documents table", "Unique PDF/DOCX/text document records for each workflow."],
  ["workflow-canvas:litesql:approval-chains", "Approval chain table", "One row per approval-chain workflow."],
  ["workflow-canvas:litesql:approval-squares", "Approval square table", "One row per approval-chain square with creator, approver, and status."],
  ["workflow-canvas:litesql:square-documents", "Square-document table", "Join table that controls which documents are visible inside each square."],
  ["workflow-canvas:litesql:agent-runs", "Agent run table", "One row per Copilot plan or execution."],
  ["workflow-canvas:litesql:agent-steps", "Agent step table", "Router, specialist, and execution steps for an agent run."],
  ["workflow-canvas:litesql:agent-actions", "Agent action table", "Typed proposed/applied actions with payload JSON."],
  ["workflow-canvas:litesql:agent-tool-calls", "Agent tool call table", "Local or MCP tool calls with input/output JSON."],
  ["workflow-canvas:index", "Workflow list", "Array of saved workflow ids."],
  ["workflow-canvas:workflow:{id}", "Workflow graph", "Full JSON record with groups, nodes, edges, documents, and metadata."],
  ["workflow-canvas:litesql:approvers", "Approver table", "Local demo approver rows that mimic a SQL table."],
  ["workflow-canvas:auth-session", "Authentication session", "Current fake signed-in user and signed-in timestamp."]
];

const classRows = [
  ["Workflow", "AIWorkflow | ApprovalChainWorkflow", "Root saved canvas item."],
  ["AIWorkflow", "flowKind: ai_workflow", "AI/data/ML workflow with no approvalChainType."],
  ["ApprovalChainWorkflow", "flowKind: approval_chain", "Approval chain with required approvalChainType."],
  ["ApprovalSquareData", "creator, approver, status, dueDate, decision, documents", "Canonical approval-chain square data used by inspector, queue, and exports."],
  ["WorkflowNode", "id, definitionId, position, data", "Square node on the canvas."],
  ["WorkflowEdge", "source, target, sourceHandle, targetHandle, curvature", "Connection between node side handles."],
  ["WorkflowGroup", "position, width, height, color", "Large stage rectangle behind nodes."],
  ["ReviewDocument", "title, type, url, owner, summary", "PDF/DOCX/text stored once per workflow."],
  ["SquareDocument", "workflowId, squareNodeId, documentId", "Join row linking one document to one square."],
  ["Approver", "name, email, role, team, approvalChainTypes", "User who can be assigned to approval nodes."],
  ["AgentPlan", "executionMode, selectedAgent, steps, actions, toolCalls", "Typed Copilot plan shown before execution."],
  ["AgentAction", "kind, target, requiresRole, payload, status", "Only typed action records can mutate the canvas."]
];

const productionStores = [
  ["Workflow index", "Azure Cosmos DB for NoSQL", "flow_canvas_prod / workflow_index"],
  ["Full workflow JSON", "Azure Cosmos DB for NoSQL", "flow_canvas_prod / workflows"],
  ["Users and approvers", "Azure SQL Database", "flow_canvas_identity_prod / dbo.users, dbo.approvers"],
  ["Approval chains", "Azure SQL Database", "dbo.approval_chains"],
  ["Approval squares", "Azure SQL Database", "dbo.approval_squares"],
  ["Square-document links", "Azure SQL Database", "dbo.square_documents"],
  ["Approval square audit trail", "Azure SQL Database", "dbo.approval_audit_events"],
  ["Agent orchestration audit", "Azure SQL Database", "dbo.agent_runs, dbo.agent_steps, dbo.agent_actions, dbo.agent_tool_calls"],
  ["PDF and DOCX files", "Azure Blob Storage", "stflowcanvasprod / review-documents"],
  ["Exports", "Azure Blob Storage", "stflowcanvasprod / exports"],
  ["Secrets", "Azure Key Vault", "kv-flow-canvas-prod"]
];

export function TechnicalDocsPage() {
  const router = useRouter();

  return (
    <main className="docs-page">
      <header className="docs-header">
        <div className="manager-brand">
          <span className="brand-mark" aria-hidden="true">
            <BookOpenText size={18} />
          </span>
          <div>
            <strong>Flow Canvas Docs</strong>
            <span>Technical structure, storage notes, and operating instructions</span>
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

      <section className="docs-grid">
        <article className="docs-panel docs-overview">
          <SectionTitle icon={<Workflow size={17} />} title="Architecture" />
          <p>
            Flow Canvas is a React/Next.js frontend that stores demo data in browser storage. A saved item is always either an
            AI Workflow or an Approval Chain. Both share the same graph model, but approval chains add approver assignments,
            approval-chain type metadata, and linked review documents.
          </p>
          <div className="docs-code">
            <code>{`Workflow
  AIWorkflow
    flowKind = "ai_workflow"
    approvalChainType = undefined
  ApprovalChainWorkflow
    flowKind = "approval_chain"
    approvalChainType = underwriting | data_engineering | project_approval | procurement | model_governance`}</code>
          </div>
        </article>

        <article className="docs-panel">
          <SectionTitle icon={<Database size={17} />} title="Current Local DB" />
          <DocsTable headers={["Key", "Class", "Stored data"]} rows={localStores} />
        </article>

        <article className="docs-panel docs-wide">
          <SectionTitle icon={<Database size={17} />} title="Local Table DDL" />
          <div className="docs-code">
            <code>{`${USER_TABLE_SQL}

${WORKFLOW_TABLE_SQL}

${DOCUMENT_TABLE_SQL}

${APPROVER_TABLE_SQL}

${APPROVAL_CHAIN_TABLE_SQL}

${APPROVAL_SQUARE_TABLE_SQL}

${SQUARE_DOCUMENT_TABLE_SQL}

${AGENT_RUN_TABLE_SQL}

${AGENT_STEP_TABLE_SQL}

${AGENT_ACTION_TABLE_SQL}

${AGENT_TOOL_CALL_TABLE_SQL}`}</code>
          </div>
          <p>
            Documents are stored once in <code>documents</code>. Visibility inside a square is controlled by
            <code> square_documents</code>, so an approver only sees the documents assigned to that specific square.
          </p>
        </article>

        <article className="docs-panel">
          <SectionTitle icon={<Database size={17} />} title="Production Azure DB" />
          <DocsTable headers={["Data", "Azure service", "Resource/table"]} rows={productionStores} />
        </article>

        <article className="docs-panel">
          <SectionTitle icon={<GitBranch size={17} />} title="Class Structure" />
          <DocsTable headers={["Class", "Important fields", "Purpose"]} rows={classRows} />
        </article>

        <article className="docs-panel docs-wide">
          <SectionTitle icon={<FileText size={17} />} title="Workflow JSON Shape" />
          <div className="docs-code">
            <code>{`{
  "schemaVersion": "1.0",
  "id": "flow-underwriting-approval-chain-sample",
  "name": "Underwriting approval chain",
  "flowKind": "approval_chain",
  "approvalChainType": "underwriting",
  "status": "draft",
  "nodes": [{ "id": "node-id", "definitionId": "approval_gate", "position": { "x": 320, "y": 180 }, "data": {} }],
  "edges": [{ "id": "edge-id", "source": "node-a", "target": "node-b", "sourceHandle": "source-right", "targetHandle": "target-left" }],
  "groups": [{ "id": "group-id", "title": "Review", "position": { "x": 80, "y": 80 }, "width": 280, "height": 520 }],
  "reviewDocuments": [{ "title": "SOP", "type": "pdf", "url": "/review-documents/approval-chain/legal-review.pdf" }]
}`}</code>
          </div>
        </article>

        <article className="docs-panel">
          <SectionTitle icon={<LockKeyhole size={17} />} title="Authentication" />
          <p>
            The current login is demo-only. Four fake users are defined in <code>src/domain/fake-users.ts</code>, and each
            uses password <code>123456</code>. The active session is stored in <code>workflow-canvas:auth-session</code>.
          </p>
          <p>
            For production, replace this with Microsoft Entra ID. Store the Entra object id in <code>dbo.users.entra_object_id</code>
            and use server-side session validation.
          </p>
        </article>

        <article className="docs-panel">
          <SectionTitle icon={<BookOpenText size={17} />} title="Instructions" />
          <ol className="docs-steps">
            <li>Sign in on <code>/login</code> with any demo user and password <code>123456</code>.</li>
            <li>Open <code>/workflows</code> to choose an existing AI workflow or approval chain.</li>
            <li>Use <code>+ Create</code> to create either an AI Workflow or an Approval Chain.</li>
            <li>Open a workflow, drag nodes, connect side handles, and use the right inspector to edit content.</li>
            <li>For approval chains, select the approval-chain type and assign approvers from the inspector.</li>
            <li>Use <code>/approvals</code> for the approver work queue and <code>/documents</code> for linked review files.</li>
            <li>Attach or open PDF/DOCX review documents from approval nodes.</li>
            <li>Use Export PDF, Export image, or Export JSON from the editor toolbar for sharing.</li>
            <li>Select a square and use LLM Evaluation Export to download, copy, or evaluate one square.</li>
          </ol>
        </article>
      </section>
    </main>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="docs-section-title">
      <span aria-hidden="true">{icon}</span>
      {title}
    </h2>
  );
}

function DocsTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="docs-table" role="table">
      <div className="docs-table-row header" role="row">
        {headers.map((header) => (
          <strong key={header} role="columnheader">
            {header}
          </strong>
        ))}
      </div>
      {rows.map((row) => (
        <div className="docs-table-row" key={row.join(":")} role="row">
          {row.map((cell) => (
            <span key={cell} role="cell">
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
