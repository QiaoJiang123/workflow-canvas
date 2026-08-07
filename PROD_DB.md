# Production Azure Data Stores

This app is currently local-browser first. For production on the Azure family, use the following one-to-one matching between the current app storage and Azure portal resources.

## One-To-One Matching

| Current app storage | Production Azure resource | Azure database/container/table | Purpose |
|---|---|---|---|
| `workflow-canvas:index` in `localStorage` | Azure Cosmos DB for NoSQL | Database: `flow_canvas_prod`; Container: `workflow_index` | Stores workflow list/search metadata: `id`, `name`, `flowKind`, `approvalChainType`, `status`, `updatedAt`, `nodeCount`, `edgeCount`, `documentCount`. |
| `workflow-canvas:workflow:{workflowId}` in `localStorage` | Azure Cosmos DB for NoSQL | Database: `flow_canvas_prod`; Container: `workflows` | Stores the full workflow JSON graph: groups, nodes, edges, viewport, review documents, approval-chain metadata. Partition key: `/teamId` or `/ownerId`. |
| `workflow-canvas:litesql:approvers` local LiteSQL table | Azure SQL Database | Database: `flow_canvas_identity_prod`; Table: `dbo.approvers` | Stores approvers that can be assigned to approval-chain nodes. This is the production replacement for the local approver table. |
| `Approver.approvalChainTypes[]` array | Azure SQL Database | Database: `flow_canvas_identity_prod`; Table: `dbo.approver_chain_types` | Many-to-many mapping between approvers and chain types such as underwriting, data engineering, project approval, procurement, and model governance. |
| `workflow-canvas:litesql:approval-chains` local LiteSQL table | Azure SQL Database | Database: `flow_canvas_identity_prod`; Table: `dbo.approval_chains` | One relational row per approval-chain workflow for chain type, owner, status, and lifecycle lookup. |
| `workflow-canvas:litesql:approval-squares` local LiteSQL table | Azure SQL Database | Database: `flow_canvas_identity_prod`; Table: `dbo.approval_squares` | One row per approval square with creator, approver, status, due date, and the canvas node id. |
| `workflow-canvas:litesql:documents` local LiteSQL table | Azure SQL Database | Database: `flow_canvas_identity_prod`; Table: `dbo.documents` | Stores unique document metadata and blob URLs for PDF/DOCX/text assets. |
| `workflow-canvas:litesql:square-documents` local LiteSQL table | Azure SQL Database | Database: `flow_canvas_identity_prod`; Table: `dbo.square_documents` | Join table that links a document to one square; this controls which documents are visible inside each square. |
| `workflow-canvas:litesql:agent-runs` local LiteSQL table | Azure SQL Database | Database: `flow_canvas_identity_prod`; Table: `dbo.agent_runs` | One row per Copilot plan/execution with prompt, selected agent, execution mode, user, status, and timestamps. |
| `workflow-canvas:litesql:agent-steps` local LiteSQL table | Azure SQL Database | Database: `flow_canvas_identity_prod`; Table: `dbo.agent_steps` | Specialist routing and orchestration steps for each agent run. |
| `workflow-canvas:litesql:agent-actions` local LiteSQL table | Azure SQL Database | Database: `flow_canvas_identity_prod`; Table: `dbo.agent_actions` | Typed proposed/applied actions with target, payload JSON, role, and status. |
| `workflow-canvas:litesql:agent-tool-calls` local LiteSQL table | Azure SQL Database | Database: `flow_canvas_identity_prod`; Table: `dbo.agent_tool_calls` | Local/MCP tool call records with input/output JSON and status. |
| Future app users / login profile | Azure SQL Database | Database: `flow_canvas_identity_prod`; Table: `dbo.users` | Stores app user profile records that map to Microsoft Entra ID object IDs. Do not store passwords here. |
| Approval node PDF/DOCX files in `public/review-documents/**` | Azure Blob Storage | Storage account: `stflowcanvasprod`; Container: `review-documents` | Stores SOPs, PDFs, DOCX review packets, and uploaded approval evidence. Store only blob URL or blob key in workflow node JSON. |
| Exported workflow PDFs/images | Azure Blob Storage | Storage account: `stflowcanvasprod`; Container: `exports` | Stores generated PDF/image exports if export history is needed in production. |
| GPT / database connection secrets in `.env` | Azure Key Vault | Vault: `kv-flow-canvas-prod`; Secrets: `OPENAI-API-KEY`, `COSMOS-CONNECTION`, `AZURE-SQL-CONNECTION`, `BLOB-STORAGE-CONNECTION` | Stores production secrets and connection strings. App Service should read them through managed identity or Key Vault references. |

## Azure Portal Resources To Create

1. Azure Cosmos DB for NoSQL account
   - Account name: `cosmos-flow-canvas-prod`
   - Database: `flow_canvas_prod`
   - Containers:
     - `workflow_index`
     - `workflows`
   - Recommended partition key:
     - `/teamId` if flows are team-owned
     - `/ownerId` if flows are user-owned
   - Why: workflow data is already JSON document data, so Cosmos DB gives a close one-to-one match to the current saved workflow object.

2. Azure SQL Database
   - Server name: `sql-flow-canvas-prod`
   - Database: `flow_canvas_identity_prod`
   - Tables:
     - `dbo.users`
     - `dbo.approvers`
     - `dbo.approver_chain_types`
     - `dbo.approval_chains`
     - `dbo.approval_squares`
     - `dbo.documents`
     - `dbo.square_documents`
     - `dbo.approval_audit_events`
     - `dbo.agent_runs`
     - `dbo.agent_steps`
     - `dbo.agent_actions`
     - `dbo.agent_tool_calls`
   - Why: users, approvers, roles, teams, and assignment history are relational and need clean SQL lookup/query behavior.

3. Azure Storage Account
   - Storage account name: `stflowcanvasprod`
   - Blob containers:
     - `review-documents`
     - `exports`
     - `imports`
   - Why: PDFs, DOCX files, uploaded evidence, and generated exports are binary files and should not live in Cosmos DB or SQL rows.

4. Azure Key Vault
   - Vault name: `kv-flow-canvas-prod`
   - Store all connection strings, API keys, and storage keys here.
   - Use separate vaults for dev, test, and prod.

## SQL Tables

Use Azure SQL Database for identity and approval assignment data.

```sql
CREATE TABLE dbo.users (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  entra_object_id NVARCHAR(64) NOT NULL UNIQUE,
  display_name NVARCHAR(200) NOT NULL,
  email NVARCHAR(320) NOT NULL UNIQUE,
  team NVARCHAR(160) NULL,
  role NVARCHAR(120) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.approvers (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  user_id UNIQUEIDENTIFIER NULL,
  name NVARCHAR(200) NOT NULL,
  email NVARCHAR(320) NOT NULL UNIQUE,
  role NVARCHAR(160) NOT NULL,
  team NVARCHAR(160) NOT NULL,
  active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_approvers_users FOREIGN KEY (user_id) REFERENCES dbo.users(id)
);

CREATE TABLE dbo.approver_chain_types (
  approver_id UNIQUEIDENTIFIER NOT NULL,
  approval_chain_type NVARCHAR(80) NOT NULL,
  PRIMARY KEY (approver_id, approval_chain_type),
  CONSTRAINT fk_approver_chain_types_approvers FOREIGN KEY (approver_id) REFERENCES dbo.approvers(id)
);

CREATE TABLE dbo.approval_chains (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  workflow_id NVARCHAR(120) NOT NULL UNIQUE,
  name NVARCHAR(240) NOT NULL,
  approval_chain_type NVARCHAR(80) NOT NULL,
  owner_user_id UNIQUEIDENTIFIER NULL,
  status NVARCHAR(40) NOT NULL DEFAULT 'draft',
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_approval_chains_owner FOREIGN KEY (owner_user_id) REFERENCES dbo.users(id)
);

CREATE TABLE dbo.approval_squares (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  workflow_id NVARCHAR(120) NOT NULL,
  node_id NVARCHAR(120) NOT NULL,
  name NVARCHAR(240) NOT NULL,
  creator_user_id UNIQUEIDENTIFIER NULL,
  approver_id UNIQUEIDENTIFIER NOT NULL,
  approval_status NVARCHAR(40) NOT NULL DEFAULT 'not_reviewed',
  due_date DATE NULL,
  assigned_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  decided_at DATETIME2 NULL,
  decision_notes NVARCHAR(MAX) NULL,
  CONSTRAINT uq_approval_squares_workflow_node UNIQUE (workflow_id, node_id),
  CONSTRAINT fk_approval_squares_creator FOREIGN KEY (creator_user_id) REFERENCES dbo.users(id),
  CONSTRAINT fk_approval_squares_approvers FOREIGN KEY (approver_id) REFERENCES dbo.approvers(id)
);

CREATE TABLE dbo.documents (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  workflow_id NVARCHAR(120) NOT NULL,
  title NVARCHAR(260) NOT NULL,
  document_type NVARCHAR(40) NOT NULL,
  blob_url NVARCHAR(1200) NOT NULL,
  summary NVARCHAR(MAX) NULL,
  uploaded_by_user_id UNIQUEIDENTIFIER NULL,
  uploaded_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_documents_uploaded_by FOREIGN KEY (uploaded_by_user_id) REFERENCES dbo.users(id)
);

CREATE TABLE dbo.square_documents (
  square_id UNIQUEIDENTIFIER NOT NULL,
  document_id UNIQUEIDENTIFIER NOT NULL,
  assigned_by_user_id UNIQUEIDENTIFIER NULL,
  assigned_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY (square_id, document_id),
  CONSTRAINT fk_square_documents_square FOREIGN KEY (square_id) REFERENCES dbo.approval_squares(id),
  CONSTRAINT fk_square_documents_document FOREIGN KEY (document_id) REFERENCES dbo.documents(id),
  CONSTRAINT fk_square_documents_assigned_by FOREIGN KEY (assigned_by_user_id) REFERENCES dbo.users(id)
);

CREATE TABLE dbo.approval_audit_events (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  square_id UNIQUEIDENTIFIER NOT NULL,
  actor_user_id UNIQUEIDENTIFIER NULL,
  action NVARCHAR(80) NOT NULL,
  note NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_approval_audit_events_square FOREIGN KEY (square_id) REFERENCES dbo.approval_squares(id),
  CONSTRAINT fk_approval_audit_events_actor FOREIGN KEY (actor_user_id) REFERENCES dbo.users(id)
);

CREATE TABLE dbo.agent_runs (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  workflow_id NVARCHAR(120) NOT NULL,
  user_id UNIQUEIDENTIFIER NULL,
  user_name NVARCHAR(200) NULL,
  selected_agent NVARCHAR(80) NOT NULL,
  execution_mode NVARCHAR(40) NOT NULL,
  prompt NVARCHAR(MAX) NOT NULL,
  status NVARCHAR(40) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  completed_at DATETIME2 NULL,
  CONSTRAINT fk_agent_runs_user FOREIGN KEY (user_id) REFERENCES dbo.users(id)
);

CREATE TABLE dbo.agent_steps (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  agent_run_id UNIQUEIDENTIFIER NOT NULL,
  workflow_id NVARCHAR(120) NOT NULL,
  agent_role NVARCHAR(80) NOT NULL,
  title NVARCHAR(240) NOT NULL,
  summary NVARCHAR(MAX) NOT NULL,
  status NVARCHAR(40) NOT NULL,
  CONSTRAINT fk_agent_steps_run FOREIGN KEY (agent_run_id) REFERENCES dbo.agent_runs(id)
);

CREATE TABLE dbo.agent_actions (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  agent_run_id UNIQUEIDENTIFIER NOT NULL,
  workflow_id NVARCHAR(120) NOT NULL,
  action_kind NVARCHAR(80) NOT NULL,
  agent_role NVARCHAR(80) NOT NULL,
  target_type NVARCHAR(80) NOT NULL,
  target_id NVARCHAR(120) NULL,
  title NVARCHAR(240) NOT NULL,
  status NVARCHAR(40) NOT NULL,
  payload_json NVARCHAR(MAX) NOT NULL,
  CONSTRAINT fk_agent_actions_run FOREIGN KEY (agent_run_id) REFERENCES dbo.agent_runs(id)
);

CREATE TABLE dbo.agent_tool_calls (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  agent_run_id UNIQUEIDENTIFIER NOT NULL,
  workflow_id NVARCHAR(120) NOT NULL,
  tool_name NVARCHAR(160) NOT NULL,
  agent_role NVARCHAR(80) NOT NULL,
  status NVARCHAR(40) NOT NULL,
  input_json NVARCHAR(MAX) NOT NULL,
  output_json NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_agent_tool_calls_run FOREIGN KEY (agent_run_id) REFERENCES dbo.agent_runs(id)
);
```

## Cosmos Containers

Use Cosmos DB for the full flow JSON document.

`workflows` document shape:

```json
{
  "id": "flow-underwriting-approval-chain-sample",
  "teamId": "ai-governance",
  "name": "Underwriting approval chain",
  "flowKind": "approval_chain",
  "approvalChainType": "underwriting",
  "status": "draft",
  "groups": [],
  "nodes": [],
  "edges": [],
  "reviewDocuments": [],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

`workflow_index` document shape:

```json
{
  "id": "flow-underwriting-approval-chain-sample",
  "teamId": "ai-governance",
  "name": "Underwriting approval chain",
  "flowKind": "approval_chain",
  "approvalChainType": "underwriting",
  "status": "draft",
  "nodeCount": 12,
  "edgeCount": 13,
  "documentCount": 24,
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

## Blob Storage Layout

```text
review-documents/
  {workflowId}/
    {nodeId}/
      sop.pdf
      review-packet.docx
      evidence/

exports/
  {workflowId}/
    {timestamp}/
      workflow.pdf
      workflow.png

imports/
  {workflowId}/
    raw/
```

## Production Notes

- Do not keep production data in browser `localStorage`.
- Store workflow JSON in Cosmos DB, not SQL, because the canvas graph is nested JSON and changes shape over time.
- Store approvers and users in Azure SQL Database because assignments need relational integrity and clean joins.
- Store PDFs, DOCX files, and exported files in Blob Storage. Keep only blob URLs or blob keys in Cosmos DB.
- Store all secrets in Key Vault. Do not commit production connection strings.
- Use Microsoft Entra ID for authentication and map the Entra object ID to `dbo.users.entra_object_id`.
- Use private endpoints or virtual network integration for production database access where possible.

## References

- Azure Cosmos DB for NoSQL: https://learn.microsoft.com/azure/cosmos-db/nosql/
- Azure SQL Database: https://learn.microsoft.com/azure/azure-sql/database/
- Azure Blob Storage: https://learn.microsoft.com/azure/storage/blobs/storage-blobs-introduction
- Azure Key Vault secrets: https://learn.microsoft.com/azure/key-vault/secrets/
