# Flow Canvas

Flow Canvas is a React/Next.js visual design tool for two kinds of flow items:

- **AI Workflow**: data, machine learning, generative AI, deployment, monitoring, and output workflows.
- **Approval Chain**: approval processes with named squares, approvers, documents, decisions, due dates, and audit context.

The current application is a browser-local demo. It uses fake users and localStorage-backed tables to model the production data shape before a real Azure backend is added.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3001` if the dev server is started with `PORT=3001 npm run dev`.

Demo users use password `123456`.

## Main Routes

- `/login`: demo authentication.
- `/workflows`: main flow manager with AI workflows and approval chains.
- `/workflows/[id]`: visual canvas editor.
- `/approvals`: current user's approval work queue.
- `/documents`: document table for linked PDF/DOCX/text review assets.
- `/agents`: agent roster, orchestration workflow, tool mapping, and audit tables.
- `/docs`: technical notes, local table shape, production Azure mapping, and operating instructions.

## Approval Chain Features

Approval-chain squares intentionally show only the square name on the canvas. The right inspector stores the detail:

- creator
- approver
- description
- tags
- status
- due date
- decision
- comments
- instructions
- linked documents
- audit trail

The left panel becomes approval-specific when an approval chain is open. Premade squares are grouped by:

- Intake
- Review
- Approval
- Exception
- Notification
- Audit

Users can also create a custom approval square with a name, type, approver, status, due date, required document, description, and instructions.

## LLM Evaluation

Each selected square can be exported from the inspector:

- download square JSON
- copy square JSON
- send to AI evaluator

The exported payload includes workflow metadata, the selected square, canonical approval data when applicable, provider metadata, documents, incoming/outgoing edges, connected nodes, and stage context.

## Current Local Tables

The demo stores browser-local data under localStorage keys:

- `workflow-canvas:litesql:users`
- `workflow-canvas:litesql:workflows`
- `workflow-canvas:litesql:documents`
- `workflow-canvas:litesql:approvers`
- `workflow-canvas:litesql:approval-chains`
- `workflow-canvas:litesql:approval-squares`
- `workflow-canvas:litesql:square-documents`
- `workflow-canvas:litesql:agent-runs`
- `workflow-canvas:litesql:agent-steps`
- `workflow-canvas:litesql:agent-actions`
- `workflow-canvas:litesql:agent-tool-calls`
- `workflow-canvas:index`
- `workflow-canvas:workflow:{id}`
- `workflow-canvas:auth-session`

## Multi-Agent Copilot

The right-side Copilot now uses a typed multi-agent planner:

- Router Agent chooses specialists from the request.
- Workflow Architect Agent proposes AI workflow nodes, edges, and stage groups.
- Approval Chain Agent proposes approval squares, approver assignment, and review status changes.
- Document Agent proposes document links and square-level LLM export packages.
- Provider Agent sets provider ids so Azure, AWS, Databricks, and OpenAI icons render on nodes.
- Validation Agent checks gaps and produces recommendations.
- MCP Tool Agent documents how future external tools connect safely.

Execution modes:

- Confirm actions: show a plan and let the user apply selected actions.
- Plan only: show the plan without changing the workflow.
- Auto apply: apply proposed actions after role checks.

All mutations are represented as typed `AgentAction` records and pass through `/api/agents/execute`.

MCP is intentionally adapter-based. MCP tools should list or inspect external systems first, then convert any requested workflow mutation into a typed proposed action. MCP responses should not directly mutate the canvas.

## Production Direction

Recommended Azure mapping:

- Microsoft Entra ID for authentication.
- Azure SQL Database for users, approvers, approval assignments, document metadata, and audit events.
- Azure SQL Database for agent runs, agent steps, agent actions, and agent tool calls.
- Azure Cosmos DB or Azure SQL JSON columns for full workflow graph JSON.
- Azure Blob Storage for PDF/DOCX files and exports.
- Azure Key Vault for secrets.

## Validation

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Note: stop the Next dev server before running `npm run build` if `.next` cache errors appear.
