# Production Azure Data Stores

This app is currently local-browser first. For production on the Azure family, use the following one-to-one matching between the current app storage and Azure portal resources.

## One-To-One Matching

| Current app storage | Production Azure resource | Azure database/container/table | Purpose |
|---|---|---|---|
| `workflow-canvas:index` in `localStorage` | Azure Cosmos DB for NoSQL | Database: `flow_canvas_prod`; Container: `workflow_index` | Stores workflow list/search metadata: `id`, `name`, `flowKind`, `approvalChainType`, `status`, `updatedAt`, `nodeCount`, `edgeCount`, `documentCount`. |
| `workflow-canvas:workflow:{workflowId}` in `localStorage` | Azure Cosmos DB for NoSQL | Database: `flow_canvas_prod`; Container: `workflows` | Stores the full workflow JSON graph: groups, nodes, edges, viewport, review documents, approval-chain metadata. Partition key: `/teamId` or `/ownerId`. |
| `workflow-canvas:litesql:approvers` local LiteSQL table | Azure SQL Database | Database: `flow_canvas_identity_prod`; Table: `dbo.approvers` | Stores approvers that can be assigned to approval-chain nodes. This is the production replacement for the local approver table. |
| `Approver.approvalChainTypes[]` array | Azure SQL Database | Database: `flow_canvas_identity_prod`; Table: `dbo.approver_chain_types` | Many-to-many mapping between approvers and chain types such as underwriting, data engineering, project approval, procurement, and model governance. |
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
     - `dbo.approval_assignments`
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

CREATE TABLE dbo.approval_assignments (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  workflow_id NVARCHAR(120) NOT NULL,
  node_id NVARCHAR(120) NOT NULL,
  approver_id UNIQUEIDENTIFIER NOT NULL,
  approval_status NVARCHAR(40) NOT NULL DEFAULT 'not_reviewed',
  due_date DATE NULL,
  assigned_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  decided_at DATETIME2 NULL,
  decision_notes NVARCHAR(MAX) NULL,
  CONSTRAINT fk_approval_assignments_approvers FOREIGN KEY (approver_id) REFERENCES dbo.approvers(id)
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
