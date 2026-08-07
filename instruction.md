# Flow Canvas Instructions

Version: 1.1

Flow Canvas supports two item types:

- AI Workflow: build data, ML, LLM, deployment, monitoring, and human-review workflows.
- Approval Chain: build approval processes with creators, approvers, review documents, status decisions, and audit context.

## Sign In

1. Open `/login`.
2. Select one of the demo users.
3. Use password `123456`.
4. After login, the app opens the main workflow page for the signed-in user.

Demo users:

- Qiao Jiang
- Chad Gordon
- Johann Sun
- Chae Won Lee

## Main Workflow Page

Open `/workflows` to manage your items.

From this page you can:

- Open existing AI workflows and approval chains.
- Create a new AI workflow.
- Create a new approval chain.
- Search your saved items.
- Open My Approvals.
- Open Documents.
- Open Agents.
- Open Docs.
- Open Instructions.

## Create A New Item

1. Enter a name in the New item panel.
2. Choose AI workflow or Approval chain.
3. For approval chains, choose the approval chain type.
4. Click Create and open.

New items start with a blank canvas. Drag squares from the left panel to build the flow.

While dragging a square, temporary alignment lines appear when its left, center, right, top, middle, or bottom aligns with another square. Use those lines to line up workflows and approval chains without guessing.

## AI Workflow Canvas

Use AI Workflow for data and AI system design.

Typical workflow:

1. Drag nodes from the left library.
2. Select a node to edit name, owner, technology, status, provider, governance, notes, and documents.
3. Connect nodes by dragging from side dots or by using Advanced edge creation in the right panel.
4. Add stage rectangles to group related nodes.
5. Export the workflow as PDF, image, or JSON from the top toolbar.
6. Select a square and use LLM Evaluation Export to download or copy square-level context.

## Approval Chain Canvas

Use Approval Chain for processes that need review and sign-off.

Each approval square has two role lanes:

- Creator Setup
- Approver Review

### Creator Responsibilities

The creator can:

- Create approval squares.
- Rename squares.
- Assign approvers.
- Add the description, due date, and instructions.
- Add tags from the suggested tag chips or search/add a tag.
- Upload, attach, and remove review documents.
- Save approval-square setup.
- Delete approval squares they created.
- Create edges between approval squares.

### Approver Responsibilities

The assigned approver can:

- View the square setup.
- View linked review documents.
- Add review comments.
- Move the square to In Review.
- Approve the square.
- Reject the square.

Approvers cannot upload or change documents. They only review and decide.

### Approval Status

Use these statuses:

- Not Reviewed: the square is waiting.
- In Review: the approver has started review.
- Approved: the approver accepted the square.
- Rejected: the approver rejected the square.

The canvas highlights approval squares by status:

- Green aura: approved.
- Red aura: rejected.
- Yellow aura: in review.

## Documents

Documents can be managed at two levels:

- Workflow document library: upload once and assign to multiple squares.
- Square document panel: upload or attach documents for the selected square.

Supported uploads:

- PDF
- DOC
- DOCX
- TXT
- Markdown

For approval chains:

- Creators can upload, attach, and remove documents.
- Approvers can view documents only.

## Review Documents

When a document is linked to a square:

1. Select the square.
2. Open Documents to Review.
3. Click View.
4. The document opens in a modal inside the same page.

PDF files render in the modal. DOC/DOCX/text files are available as downloads.

Each square only shows documents assigned to that square. The workflow document library can contain more files than a selected square shows.

## Roles And Access

For approval chains, the Parameters panel shows the signed-in user's role at the top:

- Creator: can create and manage approval-chain setup, approvers, documents, and metadata.
- Approver: can review assigned approval squares and view linked documents.

Users can open approval chains only when they are the creator or an assigned approver.

## Edges

There are two ways to create edges:

- Drag from a side dot on one square to another square.
- Use Advanced edge creation in the right inspector.

Edges can connect from left, right, top, or bottom sides. The arrow should sit below the square and should point into the selected side.

## Stage Rectangles

Use stage rectangles to group work.

1. Click Add stage rectangle.
2. Move it behind squares.
3. Select it to edit the title, description, color, and collapsed state.

If you choose a non-default color, the inspector shows a note.

## Export

From the top toolbar:

- Export PDF: downloads a PDF containing the canvas.
- Export image: downloads a PNG image of the canvas.
- Export JSON: downloads the full workflow structure.
- Copy JSON: copies the full workflow JSON.

From a selected square:

- LLM Evaluation Export downloads or copies only the selected square context.
- It includes connected edges, documents, provider details, stage context, and workflow metadata.

## Data Structure

The workflow is stored as JSON.

Important fields:

- `workflow.flowKind`: `ai_workflow` or `approval_chain`
- `workflow.nodes`: all squares
- `workflow.edges`: all arrows
- `workflow.groups`: stage rectangles
- `workflow.reviewDocuments`: workflow-level document library
- `node.data.configuration.documents`: documents linked to one square
- `node.data.configuration.creator`: creator of an approval square
- `node.data.configuration.approver`: assigned approver
- `node.data.configuration.status`: approval status
- `node.data.configuration.auditTrail`: approval decision history

Local LiteSQL-style tables:

- `users`: demo users for login.
- `workflows`: workflow membership rows with creator or approver access for approval chains.
- `approvers`: approvers available for approval chains.
- `approval_chains`: one row per approval-chain workflow.
- `approval_squares`: one row per approval-chain square with creator, approver, status, and due date.
- `documents`: unique document records for a workflow.
- `square_documents`: join table that links documents to specific squares.
- `approval_chain_snapshots`: published approval-chain snapshots.
- `agent_runs`: one row per Copilot plan/execution.
- `agent_steps`: routed specialist steps for a run.
- `agent_actions`: typed proposed/applied actions.
- `agent_tool_calls`: proposed MCP/local tool calls and outputs.

## Multi-Agent Copilot

Open the Agent tab in the right panel.

Use the mode selector:

- Confirm actions: the safest default. The agent shows proposed actions and you apply selected ones.
- Plan only: the agent only writes a plan.
- Auto apply: the agent applies proposed actions after role checks.

What the agents do:

- Router Agent picks the right specialist.
- Workflow Architect Agent adds AI nodes, edges, and stage groups.
- Approval Chain Agent adds approval squares, assigns approvers, and proposes status updates.
- Document Agent links documents to selected squares and prepares LLM evaluation exports.
- Provider Agent sets Azure, AWS, Databricks, OpenAI, or General provider choices.
- Validation Agent checks missing metadata and disconnected structure.
- MCP Tool Agent recommends future MCP tool usage without directly mutating the canvas.

Only approved typed actions are executed. Creator-only changes require Creator/manager access. Approvers can only apply approval status decisions on assigned approval squares.

## Production Notes

For production on Azure:

- Use Microsoft Entra ID for authentication.
- Use Azure SQL Database for users, approvers, assignments, and audit events.
- Use Azure Cosmos DB for full workflow JSON.
- Use Azure Blob Storage for PDF/DOCX files and exports.
- Use Azure Key Vault for secrets.

See `PROD_DB.md` and `/docs` for deeper technical mapping.
