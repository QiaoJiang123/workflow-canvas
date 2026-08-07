"use client";

import { AuthStatus } from "./auth-status";
import { ArrowLeft, BadgeCheck, BookOpenText, CheckCircle2, Download, FileText, GitBranch, LockKeyhole, Tags, UploadCloud, UserCheck, Workflow } from "lucide-react";
import { useRouter } from "next/navigation";

const quickStart = [
  "Sign in on /login with a demo user and password 123456.",
  "Open /workflows to manage your AI workflows and approval chains.",
  "Choose AI Workflow or Approval Chain when creating a new item.",
  "Drag squares from the left panel onto the blank canvas.",
  "Use alignment guide lines while dragging squares to line up canvas items.",
  "Select a square to edit details in the right inspector.",
  "Export PDF, image, or JSON from the top toolbar."
];

const creatorSteps = [
  "Create approval squares.",
  "Assign approvers.",
  "Write description, due date, and instructions.",
  "Choose approval tags from suggested chips or search/add a tag.",
  "Upload, attach, and remove review documents.",
  "Create edges and save the approval setup."
];

const approverSteps = [
  "Open assigned approval squares.",
  "Read setup details and review documents.",
  "Add review comments.",
  "Click In Review, Approve, or Reject.",
  "Decision history is saved in the square audit trail."
];

const dataFields = [
  ["workflow.flowKind", "ai_workflow or approval_chain"],
  ["workflow.nodes", "Canvas squares"],
  ["workflow.edges", "Connections and arrows"],
  ["workflow.groups", "Stage rectangles"],
  ["workflow.reviewDocuments", "Workflow-level document library"],
  ["node.data.configuration.documents", "Documents linked to one square"],
  ["node.data.configuration.creator", "Approval-square creator"],
  ["node.data.configuration.approver", "Assigned approver"],
  ["node.data.configuration.status", "Approval status"],
  ["node.data.configuration.auditTrail", "Decision history"],
  ["square_documents", "Join table linking documents to specific squares"]
];

const localTables = [
  ["users", "Demo login users"],
  ["workflows", "Workflow membership and creator/approver access for approval chains"],
  ["approvers", "Assignable approval-chain reviewers"],
  ["approval_chains", "One row per approval-chain workflow"],
  ["approval_squares", "One row per approval-chain square"],
  ["documents", "Unique workflow document records"],
  ["square_documents", "Document-to-square matching table"],
  ["approval_chain_snapshots", "Published approval snapshots"]
];

export function InstructionPage() {
  const router = useRouter();

  return (
    <main className="docs-page instructions-page">
      <header className="docs-header">
        <div className="manager-brand">
          <span className="brand-mark" aria-hidden="true">
            <BookOpenText size={18} />
          </span>
          <div>
            <strong>Flow Canvas Instructions</strong>
            <span>Version 1.1 user guide for workflows, approval chains, documents, and exports</span>
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
          <SectionTitle icon={<Workflow size={17} />} title="What To Build" />
          <p>
            Flow Canvas has two item types: AI Workflow for data and AI system design, and Approval Chain for review
            processes with creators, assigned approvers, linked documents, decisions, and audit context.
          </p>
        </article>

        <InstructionList icon={<CheckCircle2 size={17} />} title="Quick Start" items={quickStart} />

        <article className="docs-panel">
          <SectionTitle icon={<BadgeCheck size={17} />} title="Approval Roles" />
          <p>Approval-chain squares are split into creator setup and approver review. The Parameters panel shows your current role at the top.</p>
          <div className="docs-table" role="table">
            <div className="docs-table-row header" role="row">
              <strong role="columnheader">Role</strong>
              <strong role="columnheader">Can do</strong>
              <strong role="columnheader">Cannot do</strong>
            </div>
            <div className="docs-table-row" role="row">
              <span role="cell">Creator</span>
              <span role="cell">Create squares, assign approvers, upload documents, edit setup, save, delete owned squares.</span>
              <span role="cell">Approve or reject as the approver unless they are also assigned.</span>
            </div>
            <div className="docs-table-row" role="row">
              <span role="cell">Approver</span>
              <span role="cell">View documents, add review comments, set In Review, Approve, or Reject.</span>
              <span role="cell">Upload documents or change creator setup.</span>
            </div>
          </div>
        </article>

        <article className="docs-panel">
          <SectionTitle icon={<LockKeyhole size={17} />} title="Access Rules" />
          <p>
            Users can open an approval chain only when they are the creator or assigned as an approver.
            Approvers see only the documents linked to their selected approval square.
          </p>
        </article>

        <article className="docs-panel">
          <SectionTitle icon={<Tags size={17} />} title="Approval Tags" />
          <p>
            Approval-chain tags are selected with suggested chips and a search/add box. Use tags like urgent, compliance,
            legal, finance, security, data, production, exception, and audit.
          </p>
        </article>

        <InstructionList icon={<UploadCloud size={17} />} title="Creator Setup" items={creatorSteps} />
        <InstructionList icon={<UserCheck size={17} />} title="Approver Review" items={approverSteps} />

        <article className="docs-panel">
          <SectionTitle icon={<FileText size={17} />} title="Documents" />
          <p>
            Upload documents to the workflow library once, then assign them to one or multiple squares. On approval chains,
            creators can upload and attach documents. Approvers can view linked documents only.
          </p>
          <p>Supported formats: PDF, DOC, DOCX, TXT, and Markdown.</p>
        </article>

        <article className="docs-panel">
          <SectionTitle icon={<GitBranch size={17} />} title="Edges" />
          <p>
            Drag from a side dot on one square to another square, or use Advanced edge creation in the right inspector.
            Edges can connect from left, right, top, or bottom and render below the squares.
          </p>
        </article>

        <article className="docs-panel">
          <SectionTitle icon={<Download size={17} />} title="Export" />
          <p>
            Use the top toolbar to export PDF, image, JSON, or copy JSON. Select a square and use LLM Evaluation Export
            when you only need one square plus its connected context.
          </p>
        </article>

        <article className="docs-panel docs-wide">
          <SectionTitle icon={<BookOpenText size={17} />} title="Data Structure" />
          <DocsTable rows={dataFields} />
          <DocsTable rows={localTables} />
          <p>
            The repo-level instruction file is <code>instruction.md</code>. Technical database details are in <code>PROD_DB.md</code>
            and the app docs page.
          </p>
        </article>
      </section>
    </main>
  );
}

function InstructionList({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <article className="docs-panel">
      <SectionTitle icon={icon} title={title} />
      <ol className="docs-steps">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </article>
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

function DocsTable({ rows }: { rows: string[][] }) {
  return (
    <div className="docs-table" role="table">
      <div className="docs-table-row header compact" role="row">
        <strong role="columnheader">Field</strong>
        <strong role="columnheader">Meaning</strong>
      </div>
      {rows.map((row) => (
        <div className="docs-table-row compact" key={row.join(":")} role="row">
          <span role="cell">{row[0]}</span>
          <span role="cell">{row[1]}</span>
        </div>
      ))}
    </div>
  );
}
