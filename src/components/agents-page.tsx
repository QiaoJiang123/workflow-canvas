"use client";

import { agentStrategies } from "@/agents/roles";
import { agentToolRegistry } from "@/agents/tools/registry";
import type { AgentRole } from "@/agents/types";
import { AuthStatus } from "./auth-status";
import {
  ArrowLeft,
  Bot,
  Braces,
  Cable,
  CheckCircle2,
  Cloud,
  Database,
  FileText,
  GitBranch,
  ChevronDown,
  ListChecks,
  PlayCircle,
  Route,
  ShieldCheck,
  UserCheck,
  Workflow
} from "lucide-react";
import { useRouter } from "next/navigation";

const agentDetails: Array<{
  role: AgentRole;
  label: string;
  icon: React.ReactNode;
  scope: string;
  workflow: string[];
  outputs: string[];
  guardrail: string;
}> = [
  {
    role: "router",
    label: "Router Agent",
    icon: <Route size={17} />,
    scope: "Reads the prompt and current canvas context, then chooses the specialist agents for the run.",
    workflow: ["Receive prompt", "Classify intent", "Select specialists", "Pass context forward"],
    outputs: ["Agent role list", "Routing step"],
    guardrail: "Does not mutate workflows."
  },
  {
    role: "workflow_architect",
    label: "Workflow Architect Agent",
    icon: <Workflow size={17} />,
    scope: "Builds AI workflow structure: nodes, edges, and stage groups.",
    workflow: ["Inspect graph", "Infer missing AI nodes", "Propose edges/stages", "Return typed actions"],
    outputs: ["node.add", "edge.add", "group.add", "recommendation.generate"],
    guardrail: "Requires Creator/manager role for canvas mutations."
  },
  {
    role: "approval_chain",
    label: "Approval Chain Agent",
    icon: <UserCheck size={17} />,
    scope: "Builds approval-chain squares and supports approver assignments and decisions.",
    workflow: ["Inspect selected square", "Create approval square", "Assign approver", "Record review status"],
    outputs: ["approval_square.add", "approval.assignApprover", "approval.setStatus"],
    guardrail: "Creators manage setup; approvers can only submit approval decisions."
  },
  {
    role: "document",
    label: "Document Agent",
    icon: <FileText size={17} />,
    scope: "Links documents to selected workflow squares and prepares square-level LLM context exports.",
    workflow: ["List documents", "Find selected square", "Propose document link", "Prepare LLM export"],
    outputs: ["document.linkToNode", "document.unlinkFromNode", "llm.exportNodeContext"],
    guardrail: "Documents are linked to specific squares; approvers only see assigned documents."
  },
  {
    role: "provider",
    label: "Provider Agent",
    icon: <Cloud size={17} />,
    scope: "Sets provider choices and icon metadata for Azure, AWS, Databricks, OpenAI, or General nodes.",
    workflow: ["Inspect node definition", "List provider options", "Set providerId", "Refresh provider icon"],
    outputs: ["node.update", "provider.listOptions"],
    guardrail: "Provider changes require Creator/manager role."
  },
  {
    role: "validation",
    label: "Validation Agent",
    icon: <ShieldCheck size={17} />,
    scope: "Checks workflow quality, disconnected structure, missing metadata, and approval/document gaps.",
    workflow: ["Run validation", "Group findings", "Summarize risks", "Recommend fixes"],
    outputs: ["workflow.validate", "recommendation.generate"],
    guardrail: "Read-only by default."
  },
  {
    role: "mcp_tool",
    label: "MCP Tool Agent",
    icon: <Cable size={17} />,
    scope: "Defines how future MCP connectors can inspect external systems without directly changing the canvas.",
    workflow: ["List MCP tools", "Validate schema", "Run read-only calls", "Convert writes to AgentAction"],
    outputs: ["recommendation.generate", "mcp.catalog"],
    guardrail: "MCP responses never mutate the canvas directly."
  },
  {
    role: "execution",
    label: "Execution Agent",
    icon: <PlayCircle size={17} />,
    scope: "Applies approved typed actions after role checks and records audit status.",
    workflow: ["Receive approved actions", "Check user role", "Apply patch", "Write audit rows"],
    outputs: ["AgentExecutionResult", "agent_runs", "agent_actions"],
    guardrail: "Only approved action IDs can be executed."
  }
];

const orchestrationSteps = [
  ["1", "User prompt", "The Agent tab sends prompt, workflow JSON, selected item, role, and execution mode."],
  ["2", "Router", "Keyword and flow-kind routing chooses one or more specialists."],
  ["3", "Specialists", "Agents inspect the workflow and produce typed proposed actions."],
  ["4", "Plan card", "The right panel shows steps, action checkboxes, and apply controls."],
  ["5", "Execution", "Approved action IDs go through `/api/agents/execute` with permission checks."],
  ["6", "Audit", "Runs, steps, actions, and tool calls are stored in local LiteSQL-style tables."]
];

const storageRows = [
  ["agent_runs", "One row per plan/execution with prompt, selected agent, mode, status, and timestamps."],
  ["agent_steps", "Router, specialist, and execution steps attached to an agent run."],
  ["agent_actions", "Typed proposed/applied workflow mutations and read-only recommendations."],
  ["agent_tool_calls", "Local tool or future MCP tool calls, inputs, outputs, and status."]
];

export function AgentsPage() {
  const router = useRouter();
  const registeredCapabilities = new Map(agentStrategies.map((agent) => [agent.role, agent.capabilities]));
  const toolRows = agentToolRegistry.map((tool) => [tool.name, tool.permission, tool.description]);

  return (
    <main className="docs-page agents-page">
      <header className="docs-header">
        <div className="manager-brand">
          <span className="brand-mark" aria-hidden="true">
            <Bot size={18} />
          </span>
          <div>
            <strong>Agent Center</strong>
            <span>Created agents, orchestration workflow, tools, and audit storage</span>
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

      <section className="agents-layout">
        <article className="docs-panel docs-overview agent-hero-panel">
          <div>
            <SectionTitle icon={<Bot size={17} />} title="Agent System" />
            <p>
              The Copilot is a multi-agent planner. Agents do not secretly edit the workflow. They create typed actions,
              show those actions to the user, and only execute approved actions through the executor.
            </p>
          </div>
          <div className="agent-summary-strip" aria-label="Agent system summary">
            <SummaryPill icon={<Bot size={15} />} label="Agents" value={String(agentDetails.length)} />
            <SummaryPill icon={<Braces size={15} />} label="Action kinds" value="12" />
            <SummaryPill icon={<Database size={15} />} label="Audit tables" value="4" />
          </div>
        </article>

        <article className="docs-panel docs-wide">
          <SectionTitle icon={<GitBranch size={17} />} title="Workflow" />
          <div className="agent-flow-track">
            {orchestrationSteps.map(([number, title, detail]) => (
              <div className="agent-flow-step" key={number}>
                <span>{number}</span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
        </article>

        <section className="agent-card-grid" aria-label="Created agents">
          {agentDetails.map((agent) => (
            <details className="agent-roster-card" key={agent.role}>
              <summary>
                <span aria-hidden="true">{agent.icon}</span>
                <div>
                  <strong>{agent.label}</strong>
                  <small>{agent.scope}</small>
                </div>
                <ChevronDown className="agent-card-chevron" size={16} aria-hidden="true" />
              </summary>
              <div className="agent-roster-content">
                <div className="agent-card-section">
                  <h2>Workflow</h2>
                  <ol>
                    {agent.workflow.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
                <div className="agent-card-section">
                  <h2>Outputs</h2>
                  <div className="agent-chip-row">
                    {agent.outputs.map((output) => (
                      <span key={output}>{output}</span>
                    ))}
                  </div>
                </div>
                <div className="agent-card-section">
                  <h2>Capabilities</h2>
                  <div className="agent-chip-row">
                    {(registeredCapabilities.get(agent.role) ?? []).map((capability) => (
                      <span key={capability.id}>{capability.label}</span>
                    ))}
                    {!registeredCapabilities.get(agent.role)?.length && <span>System orchestration</span>}
                  </div>
                </div>
                <footer>
                  <CheckCircle2 size={14} />
                  <span>{agent.guardrail}</span>
                </footer>
              </div>
            </details>
          ))}
        </section>

        <article className="docs-panel">
          <SectionTitle icon={<ListChecks size={17} />} title="Agent Tools" />
          <DocsTable headers={["Tool", "Permission", "Purpose"]} rows={toolRows} />
        </article>

        <article className="docs-panel">
          <SectionTitle icon={<Database size={17} />} title="Agent Storage" />
          <DocsTable headers={["Table", "Stored data"]} rows={storageRows} compact />
        </article>
      </section>
    </main>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h1 className="docs-section-title">
      <span aria-hidden="true">{icon}</span>
      {title}
    </h1>
  );
}

function SummaryPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="agent-summary-pill">
      <span aria-hidden="true">{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function DocsTable({ headers, rows, compact = false }: { headers: string[]; rows: string[][]; compact?: boolean }) {
  return (
    <div className="docs-table" role="table">
      <div className={compact ? "docs-table-row compact header" : "docs-table-row header"} role="row">
        {headers.map((header) => (
          <strong key={header} role="columnheader">
            {header}
          </strong>
        ))}
      </div>
      {rows.map((row) => (
        <div className={compact ? "docs-table-row compact" : "docs-table-row"} key={row.join(":")} role="row">
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
