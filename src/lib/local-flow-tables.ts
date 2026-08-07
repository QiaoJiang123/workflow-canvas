"use client";

import { DEMO_USERS, type DemoUser } from "@/domain/fake-users";
import type { ReviewDocument, Workflow } from "@/domain/types";
import type { AgentExecutionResult, AgentPlan } from "@/agents/types";

const USERS_KEY = "workflow-canvas:litesql:users";
const WORKFLOWS_KEY = "workflow-canvas:litesql:workflows";
const DOCUMENTS_KEY = "workflow-canvas:litesql:documents";
const APPROVAL_CHAINS_KEY = "workflow-canvas:litesql:approval-chains";
const APPROVAL_SQUARES_KEY = "workflow-canvas:litesql:approval-squares";
const SQUARE_DOCUMENTS_KEY = "workflow-canvas:litesql:square-documents";
const APPROVAL_SNAPSHOTS_KEY = "workflow-canvas:litesql:approval-chain-snapshots";
const AGENT_RUNS_KEY = "workflow-canvas:litesql:agent-runs";
const AGENT_STEPS_KEY = "workflow-canvas:litesql:agent-steps";
const AGENT_ACTIONS_KEY = "workflow-canvas:litesql:agent-actions";
const AGENT_TOOL_CALLS_KEY = "workflow-canvas:litesql:agent-tool-calls";

export const USER_TABLE_NAME = "users";
export const WORKFLOW_TABLE_NAME = "workflows";
export const DOCUMENT_TABLE_NAME = "documents";
export const APPROVAL_CHAIN_TABLE_NAME = "approval_chains";
export const APPROVAL_SQUARE_TABLE_NAME = "approval_squares";
export const SQUARE_DOCUMENT_TABLE_NAME = "square_documents";
export const APPROVAL_CHAIN_SNAPSHOT_TABLE_NAME = "approval_chain_snapshots";
export const AGENT_RUN_TABLE_NAME = "agent_runs";
export const AGENT_STEP_TABLE_NAME = "agent_steps";
export const AGENT_ACTION_TABLE_NAME = "agent_actions";
export const AGENT_TOOL_CALL_TABLE_NAME = "agent_tool_calls";

export const USER_TABLE_SQL = `CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  team TEXT NOT NULL
);`;

export const WORKFLOW_TABLE_SQL = `CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  flow_kind TEXT NOT NULL,
  approval_chain_type TEXT,
  status TEXT NOT NULL,
  access_role TEXT NOT NULL DEFAULT 'manager',
  updated_at TEXT NOT NULL
);`;

export const DOCUMENT_TABLE_SQL = `CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT
);`;

export const APPROVAL_CHAIN_TABLE_SQL = `CREATE TABLE approval_chains (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  chain_type TEXT NOT NULL,
  owner_name TEXT,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;

export const APPROVAL_SQUARE_TABLE_SQL = `CREATE TABLE approval_squares (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  name TEXT NOT NULL,
  creator_name TEXT,
  approver_name TEXT,
  approval_status TEXT NOT NULL,
  due_date TEXT,
  updated_at TEXT NOT NULL
);`;

export const SQUARE_DOCUMENT_TABLE_SQL = `CREATE TABLE square_documents (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  square_node_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  url TEXT NOT NULL
);`;

export const APPROVAL_CHAIN_SNAPSHOT_TABLE_SQL = `CREATE TABLE approval_chain_snapshots (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  version TEXT NOT NULL,
  published_by_user_id TEXT,
  published_by_name TEXT,
  published_at TEXT NOT NULL,
  node_count INTEGER NOT NULL,
  edge_count INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL
);`;

export const AGENT_RUN_TABLE_SQL = `CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  user_name TEXT,
  selected_agent TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);`;

export const AGENT_STEP_TABLE_SQL = `CREATE TABLE agent_steps (
  id TEXT PRIMARY KEY,
  agent_run_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL
);`;

export const AGENT_ACTION_TABLE_SQL = `CREATE TABLE agent_actions (
  id TEXT PRIMARY KEY,
  agent_run_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  action_kind TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL
);`;

export const AGENT_TOOL_CALL_TABLE_SQL = `CREATE TABLE agent_tool_calls (
  id TEXT PRIMARY KEY,
  agent_run_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  created_at TEXT NOT NULL
);`;

export interface WorkflowTableRow {
  id: string;
  workflowId: string;
  ownerUserId: string;
  name: string;
  flowKind: Workflow["flowKind"];
  approvalChainType?: string;
  status: Workflow["status"];
  accessRole?: "manager" | "approver" | "reader";
  updatedAt: string;
}

export interface DocumentTableRow {
  id: string;
  workflowId: string;
  nodeId?: string;
  title: string;
  documentType: ReviewDocument["type"];
  url: string;
  summary?: string;
}

export interface ApprovalChainTableRow {
  id: string;
  workflowId: string;
  name: string;
  chainType: string;
  ownerName?: string;
  status: Workflow["status"];
  updatedAt: string;
}

export interface ApprovalSquareTableRow {
  id: string;
  workflowId: string;
  nodeId: string;
  name: string;
  creatorName?: string;
  approverName?: string;
  approvalStatus: string;
  dueDate?: string;
  updatedAt: string;
}

export interface SquareDocumentTableRow {
  id: string;
  workflowId: string;
  squareNodeId: string;
  documentId: string;
  title: string;
  documentType: ReviewDocument["type"];
  url: string;
}

export interface ApprovalChainSnapshotRow {
  id: string;
  workflowId: string;
  workflowName: string;
  version: string;
  publishedByUserId?: string;
  publishedByName?: string;
  publishedAt: string;
  nodeCount: number;
  edgeCount: number;
  snapshotJson: string;
}

export interface AgentRunTableRow {
  id: string;
  workflowId: string;
  userName?: string;
  selectedAgent: string;
  executionMode: string;
  prompt: string;
  status: string;
  createdAt: string;
  completedAt?: string;
}

export interface AgentStepTableRow {
  id: string;
  agentRunId: string;
  workflowId: string;
  agentRole: string;
  title: string;
  summary: string;
  status: string;
}

export interface AgentActionTableRow {
  id: string;
  agentRunId: string;
  workflowId: string;
  actionKind: string;
  agentRole: string;
  targetType: string;
  targetId?: string;
  title: string;
  status: string;
  payloadJson: string;
}

export interface AgentToolCallTableRow {
  id: string;
  agentRunId: string;
  workflowId: string;
  toolName: string;
  agentRole: string;
  status: string;
  inputJson: string;
  outputJson?: string;
  createdAt: string;
}

export function ensureFlowTables() {
  if (typeof window === "undefined") return;
  writeUsers(readUsers());
  writeWorkflows(readWorkflows());
  writeDocuments(readDocuments());
  writeApprovalChains(readApprovalChains());
  writeApprovalSquares(readApprovalSquares());
  writeSquareDocuments(readSquareDocuments());
  writeApprovalChainSnapshots(readApprovalChainSnapshots());
  writeAgentRuns(readAgentRuns());
  writeAgentSteps(readAgentSteps());
  writeAgentActions(readAgentActions());
  writeAgentToolCalls(readAgentToolCalls());
}

export function readUsers() {
  const stored = readArray<DemoUser>(USERS_KEY, isDemoUser);
  const byId = new Map([...DEMO_USERS, ...stored].map((user) => [user.id, user]));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function listWorkflowRowsForUser(userId: string) {
  return readWorkflows()
    .filter((row) => row.ownerUserId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listDocumentRowsForWorkflow(workflowId: string) {
  return readDocuments().filter((row) => row.workflowId === workflowId);
}

export function listApprovalChainRows() {
  return readApprovalChains().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listApprovalSquareRowsForWorkflow(workflowId: string) {
  return readApprovalSquares().filter((row) => row.workflowId === workflowId);
}

export function listSquareDocumentRowsForWorkflow(workflowId: string) {
  return readSquareDocuments().filter((row) => row.workflowId === workflowId);
}

export function listSquareDocumentRowsForSquare(workflowId: string, squareNodeId: string) {
  return readSquareDocuments().filter((row) => row.workflowId === workflowId && row.squareNodeId === squareNodeId);
}

export function listApprovalChainSnapshots(workflowId: string) {
  return readApprovalChainSnapshots()
    .filter((row) => row.workflowId === workflowId)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function listAgentRunsForWorkflow(workflowId: string) {
  return readAgentRuns()
    .filter((row) => row.workflowId === workflowId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listAgentActionsForRun(agentRunId: string) {
  return readAgentActions().filter((row) => row.agentRunId === agentRunId);
}

export function recordAgentPlan(plan: AgentPlan, userName?: string) {
  if (typeof window === "undefined") return null;
  const run: AgentRunTableRow = {
    id: plan.id,
    workflowId: plan.workflowId,
    userName,
    selectedAgent: plan.selectedAgent,
    executionMode: plan.executionMode,
    prompt: plan.prompt,
    status: "planned",
    createdAt: plan.createdAt
  };
  writeAgentRuns([...readAgentRuns().filter((row) => row.id !== run.id), run]);
  writeAgentSteps([
    ...readAgentSteps().filter((row) => row.agentRunId !== plan.id),
    ...plan.steps.map((step) => ({
      id: step.id,
      agentRunId: plan.id,
      workflowId: plan.workflowId,
      agentRole: step.agentRole,
      title: step.title,
      summary: step.summary,
      status: step.status
    }))
  ]);
  writeAgentActions([
    ...readAgentActions().filter((row) => row.agentRunId !== plan.id),
    ...plan.actions.map((agentAction) => ({
      id: agentAction.id,
      agentRunId: plan.id,
      workflowId: plan.workflowId,
      actionKind: agentAction.kind,
      agentRole: agentAction.agentRole,
      targetType: agentAction.target.type,
      targetId: agentAction.target.id,
      title: agentAction.title,
      status: agentAction.status,
      payloadJson: JSON.stringify(agentAction.payload)
    }))
  ]);
  writeAgentToolCalls([
    ...readAgentToolCalls().filter((row) => row.agentRunId !== plan.id),
    ...plan.toolCalls.map((toolCall) => ({
      id: toolCall.id,
      agentRunId: plan.id,
      workflowId: plan.workflowId,
      toolName: toolCall.toolName,
      agentRole: toolCall.agentRole,
      status: toolCall.status,
      inputJson: JSON.stringify(toolCall.input),
      outputJson: toolCall.output === undefined ? undefined : JSON.stringify(toolCall.output),
      createdAt: toolCall.createdAt
    }))
  ]);
  return run;
}

export function recordAgentExecution(planId: string, result: AgentExecutionResult) {
  if (typeof window === "undefined") return null;
  const existingRun = readAgentRuns().find((row) => row.id === planId);
  const completedRun: AgentRunTableRow = {
    id: planId,
    workflowId: result.workflow.id,
    userName: result.auditLog.userName,
    selectedAgent: existingRun?.selectedAgent ?? result.auditLog.agentName,
    executionMode: existingRun?.executionMode ?? "confirm_each_step",
    prompt: result.auditLog.prompt,
    status: result.auditLog.status,
    createdAt: existingRun?.createdAt ?? result.auditLog.createdAt,
    completedAt: result.auditLog.completedAt
  };
  writeAgentRuns([...readAgentRuns().filter((row) => row.id !== planId), completedRun]);
  writeAgentActions([
    ...readAgentActions().filter((row) => row.agentRunId !== planId),
    ...result.actions.map((agentAction) => ({
      id: agentAction.id,
      agentRunId: planId,
      workflowId: result.workflow.id,
      actionKind: agentAction.kind,
      agentRole: agentAction.agentRole,
      targetType: agentAction.target.type,
      targetId: agentAction.target.id,
      title: agentAction.title,
      status: agentAction.status,
      payloadJson: JSON.stringify(agentAction.payload)
    }))
  ]);
  return completedRun;
}

export function listDocumentRowsForUser(userId: string) {
  const workflowIds = new Set(listWorkflowRowsForUser(userId).map((row) => row.workflowId));
  return readDocuments()
    .filter((row) => workflowIds.has(row.workflowId))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function listWorkflowRows() {
  return readWorkflows().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertWorkflowForUser(workflow: Workflow, user: DemoUser) {
  const accessRole = inferAccessRole(workflow, user);
  const row: WorkflowTableRow = {
    id: `workflow-row-${user.id}-${workflow.id}`,
    workflowId: workflow.id,
    ownerUserId: user.id,
    name: workflow.name,
    flowKind: workflow.flowKind,
    approvalChainType: workflow.approvalChainType,
    status: workflow.status,
    accessRole,
    updatedAt: workflow.updatedAt
  };
  const next = [...readWorkflows().filter((item) => item.id !== row.id), row];
  writeWorkflows(next);
  syncDocumentsForWorkflow(workflow);
  return row;
}

export function deleteWorkflowTableRows(workflowId: string) {
  writeWorkflows(readWorkflows().filter((row) => row.workflowId !== workflowId));
  writeDocuments(readDocuments().filter((row) => row.workflowId !== workflowId));
  writeApprovalChains(readApprovalChains().filter((row) => row.workflowId !== workflowId));
  writeApprovalSquares(readApprovalSquares().filter((row) => row.workflowId !== workflowId));
  writeSquareDocuments(readSquareDocuments().filter((row) => row.workflowId !== workflowId));
  writeAgentRuns(readAgentRuns().filter((row) => row.workflowId !== workflowId));
  writeAgentSteps(readAgentSteps().filter((row) => row.workflowId !== workflowId));
  writeAgentActions(readAgentActions().filter((row) => row.workflowId !== workflowId));
  writeAgentToolCalls(readAgentToolCalls().filter((row) => row.workflowId !== workflowId));
}

export function syncDocumentsForWorkflow(workflow: Workflow) {
  if (typeof window === "undefined") return;
  const rows: DocumentTableRow[] = [
    ...(workflow.reviewDocuments ?? []).map((document) => documentToRow(workflow.id, document)),
    ...workflow.nodes.flatMap((node) => {
      const value = node.data.configuration.documents;
      if (!Array.isArray(value)) return [];
      return value.filter(isReviewDocumentLike).map((document) => documentToRow(workflow.id, document));
    })
  ];
  const squareDocumentRows = workflow.nodes.flatMap((node) => {
    const value = node.data.configuration.documents;
    if (!Array.isArray(value)) return [];
    return value.filter(isReviewDocumentLike).map((document) => squareDocumentToRow(workflow.id, node.id, document));
  });
  const approvalChainRows =
    workflow.flowKind === "approval_chain"
      ? [
          {
            id: `approval-chain-${workflow.id}`,
            workflowId: workflow.id,
            name: workflow.name,
            chainType: workflow.approvalChainType,
            ownerName: workflow.owner,
            status: workflow.status,
            updatedAt: workflow.updatedAt
          } satisfies ApprovalChainTableRow
        ]
      : [];
  const approvalSquareRows =
    workflow.flowKind === "approval_chain"
      ? workflow.nodes.map((node) => ({
          id: `approval-square-${workflow.id}-${node.id}`,
          workflowId: workflow.id,
          nodeId: node.id,
          name: node.data.label,
          creatorName: configuredText(node.data.configuration.creator, node.data.owner, workflow.owner),
          approverName: configuredText(node.data.configuration.approver, node.data.configuration.assignee, node.data.configuration.reviewer),
          approvalStatus: configuredText(node.data.configuration.approvalStatus, node.data.configuration.status) || "not_reviewed",
          dueDate: configuredText(node.data.configuration.dueDate),
          updatedAt: workflow.updatedAt
        }))
      : [];
  const next = [...readDocuments().filter((row) => row.workflowId !== workflow.id), ...dedupeDocumentRows(rows)];
  writeDocuments(next);
  writeSquareDocuments([...readSquareDocuments().filter((row) => row.workflowId !== workflow.id), ...dedupeSquareDocumentRows(squareDocumentRows)]);
  writeApprovalChains([...readApprovalChains().filter((row) => row.workflowId !== workflow.id), ...approvalChainRows]);
  writeApprovalSquares([...readApprovalSquares().filter((row) => row.workflowId !== workflow.id), ...approvalSquareRows]);
}

export function publishApprovalChainSnapshot(workflow: Workflow, publisher?: Pick<DemoUser, "id" | "name">) {
  if (typeof window === "undefined" || workflow.flowKind !== "approval_chain") return null;
  const publishedAt = new Date().toISOString();
  const row: ApprovalChainSnapshotRow = {
    id: `approval-snapshot-${workflow.id}-${publishedAt.replace(/[^0-9a-z]/gi, "")}`,
    workflowId: workflow.id,
    workflowName: workflow.name,
    version: workflow.version,
    publishedByUserId: publisher?.id,
    publishedByName: publisher?.name,
    publishedAt,
    nodeCount: workflow.nodes.length,
    edgeCount: workflow.edges.length,
    snapshotJson: JSON.stringify(workflow)
  };
  writeApprovalChainSnapshots([...readApprovalChainSnapshots(), row]);
  return row;
}

function documentToRow(workflowId: string, document: ReviewDocument): DocumentTableRow {
  return {
    id: `document-row-${workflowId}-${document.id}`,
    workflowId,
    title: document.title,
    documentType: document.type,
    url: document.url,
    summary: document.summary
  };
}

function squareDocumentToRow(workflowId: string, squareNodeId: string, document: ReviewDocument): SquareDocumentTableRow {
  return {
    id: `square-document-${workflowId}-${squareNodeId}-${document.id}`,
    workflowId,
    squareNodeId,
    documentId: document.id,
    title: document.title,
    documentType: document.type,
    url: document.url
  };
}

function readWorkflows() {
  return readArray<WorkflowTableRow>(WORKFLOWS_KEY, isWorkflowTableRow);
}

function readDocuments() {
  return readArray<DocumentTableRow>(DOCUMENTS_KEY, isDocumentTableRow);
}

function readApprovalChains() {
  return readArray<ApprovalChainTableRow>(APPROVAL_CHAINS_KEY, isApprovalChainTableRow);
}

function readApprovalSquares() {
  return readArray<ApprovalSquareTableRow>(APPROVAL_SQUARES_KEY, isApprovalSquareTableRow);
}

function readSquareDocuments() {
  return readArray<SquareDocumentTableRow>(SQUARE_DOCUMENTS_KEY, isSquareDocumentTableRow);
}

function readApprovalChainSnapshots() {
  return readArray<ApprovalChainSnapshotRow>(APPROVAL_SNAPSHOTS_KEY, isApprovalChainSnapshotRow);
}

function readAgentRuns() {
  return readArray<AgentRunTableRow>(AGENT_RUNS_KEY, isAgentRunTableRow);
}

function readAgentSteps() {
  return readArray<AgentStepTableRow>(AGENT_STEPS_KEY, isAgentStepTableRow);
}

function readAgentActions() {
  return readArray<AgentActionTableRow>(AGENT_ACTIONS_KEY, isAgentActionTableRow);
}

function readAgentToolCalls() {
  return readArray<AgentToolCallTableRow>(AGENT_TOOL_CALLS_KEY, isAgentToolCallTableRow);
}

function writeUsers(users: DemoUser[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function writeWorkflows(rows: WorkflowTableRow[]) {
  window.localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(rows));
}

function writeDocuments(rows: DocumentTableRow[]) {
  window.localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(rows));
}

function writeApprovalChains(rows: ApprovalChainTableRow[]) {
  window.localStorage.setItem(APPROVAL_CHAINS_KEY, JSON.stringify(rows));
}

function writeApprovalSquares(rows: ApprovalSquareTableRow[]) {
  window.localStorage.setItem(APPROVAL_SQUARES_KEY, JSON.stringify(rows));
}

function writeSquareDocuments(rows: SquareDocumentTableRow[]) {
  window.localStorage.setItem(SQUARE_DOCUMENTS_KEY, JSON.stringify(rows));
}

function writeApprovalChainSnapshots(rows: ApprovalChainSnapshotRow[]) {
  window.localStorage.setItem(APPROVAL_SNAPSHOTS_KEY, JSON.stringify(rows));
}

function writeAgentRuns(rows: AgentRunTableRow[]) {
  window.localStorage.setItem(AGENT_RUNS_KEY, JSON.stringify(rows));
}

function writeAgentSteps(rows: AgentStepTableRow[]) {
  window.localStorage.setItem(AGENT_STEPS_KEY, JSON.stringify(rows));
}

function writeAgentActions(rows: AgentActionTableRow[]) {
  window.localStorage.setItem(AGENT_ACTIONS_KEY, JSON.stringify(rows));
}

function writeAgentToolCalls(rows: AgentToolCallTableRow[]) {
  window.localStorage.setItem(AGENT_TOOL_CALLS_KEY, JSON.stringify(rows));
}

function readArray<T>(key: string, guard: (value: unknown) => value is T) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}

function dedupeDocumentRows(rows: DocumentTableRow[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function dedupeSquareDocumentRows(rows: SquareDocumentTableRow[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function isDemoUser(value: unknown): value is DemoUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<DemoUser>;
  return ["id", "name", "email", "role", "team"].every((key) => typeof user[key as keyof DemoUser] === "string");
}

function isWorkflowTableRow(value: unknown): value is WorkflowTableRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<WorkflowTableRow>;
  return (
    typeof row.id === "string" &&
    typeof row.workflowId === "string" &&
    typeof row.ownerUserId === "string" &&
    typeof row.name === "string" &&
    (row.flowKind === "ai_workflow" || row.flowKind === "approval_chain") &&
    typeof row.status === "string" &&
    typeof row.updatedAt === "string"
  );
}

function isDocumentTableRow(value: unknown): value is DocumentTableRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<DocumentTableRow>;
  return (
    typeof row.id === "string" &&
    typeof row.workflowId === "string" &&
    typeof row.title === "string" &&
    (row.documentType === "pdf" || row.documentType === "doc" || row.documentType === "text") &&
    typeof row.url === "string"
  );
}

function isApprovalChainTableRow(value: unknown): value is ApprovalChainTableRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ApprovalChainTableRow>;
  return (
    typeof row.id === "string" &&
    typeof row.workflowId === "string" &&
    typeof row.name === "string" &&
    typeof row.chainType === "string" &&
    typeof row.status === "string" &&
    typeof row.updatedAt === "string"
  );
}

function isApprovalSquareTableRow(value: unknown): value is ApprovalSquareTableRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ApprovalSquareTableRow>;
  return (
    typeof row.id === "string" &&
    typeof row.workflowId === "string" &&
    typeof row.nodeId === "string" &&
    typeof row.name === "string" &&
    typeof row.approvalStatus === "string" &&
    typeof row.updatedAt === "string"
  );
}

function isSquareDocumentTableRow(value: unknown): value is SquareDocumentTableRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<SquareDocumentTableRow>;
  return (
    typeof row.id === "string" &&
    typeof row.workflowId === "string" &&
    typeof row.squareNodeId === "string" &&
    typeof row.documentId === "string" &&
    typeof row.title === "string" &&
    (row.documentType === "pdf" || row.documentType === "doc" || row.documentType === "text") &&
    typeof row.url === "string"
  );
}

function isApprovalChainSnapshotRow(value: unknown): value is ApprovalChainSnapshotRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ApprovalChainSnapshotRow>;
  return (
    typeof row.id === "string" &&
    typeof row.workflowId === "string" &&
    typeof row.workflowName === "string" &&
    typeof row.version === "string" &&
    typeof row.publishedAt === "string" &&
    typeof row.nodeCount === "number" &&
    typeof row.edgeCount === "number" &&
    typeof row.snapshotJson === "string"
  );
}

function isAgentRunTableRow(value: unknown): value is AgentRunTableRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<AgentRunTableRow>;
  return typeof row.id === "string" && typeof row.workflowId === "string" && typeof row.selectedAgent === "string" && typeof row.executionMode === "string" && typeof row.prompt === "string" && typeof row.status === "string" && typeof row.createdAt === "string";
}

function isAgentStepTableRow(value: unknown): value is AgentStepTableRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<AgentStepTableRow>;
  return typeof row.id === "string" && typeof row.agentRunId === "string" && typeof row.workflowId === "string" && typeof row.agentRole === "string" && typeof row.title === "string" && typeof row.summary === "string" && typeof row.status === "string";
}

function isAgentActionTableRow(value: unknown): value is AgentActionTableRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<AgentActionTableRow>;
  return typeof row.id === "string" && typeof row.agentRunId === "string" && typeof row.workflowId === "string" && typeof row.actionKind === "string" && typeof row.agentRole === "string" && typeof row.targetType === "string" && typeof row.title === "string" && typeof row.status === "string" && typeof row.payloadJson === "string";
}

function isAgentToolCallTableRow(value: unknown): value is AgentToolCallTableRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<AgentToolCallTableRow>;
  return typeof row.id === "string" && typeof row.agentRunId === "string" && typeof row.workflowId === "string" && typeof row.toolName === "string" && typeof row.agentRole === "string" && typeof row.status === "string" && typeof row.inputJson === "string" && typeof row.createdAt === "string";
}

function inferAccessRole(workflow: Workflow, user: DemoUser): "manager" | "approver" | "reader" {
  if (isUserValue(workflow.owner, user)) return "manager";
  if (
    workflow.flowKind === "approval_chain" &&
    workflow.nodes.some((node) => isUserValue(configuredText(node.data.configuration.approver, node.data.configuration.assignee, node.data.configuration.reviewer), user))
  ) {
    return "approver";
  }
  return "reader";
}

function isUserValue(value: unknown, user: DemoUser) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return Boolean(normalized) && [user.id, user.name, user.email].some((candidate) => candidate.toLowerCase() === normalized);
}

function configuredText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function isReviewDocumentLike(value: unknown): value is ReviewDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<ReviewDocument>;
  return (
    typeof document.id === "string" &&
    typeof document.title === "string" &&
    typeof document.url === "string" &&
    (document.type === "pdf" || document.type === "doc" || document.type === "text")
  );
}
