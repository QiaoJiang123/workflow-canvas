"use client";

import { APPROVAL_CHAIN_TYPE_OPTIONS, approverMatchesType, getApprovalChainTypeLabel } from "@/domain/approval-chain-types";
import { normalizeApprovalSquareData } from "@/domain/approval-node-presets";
import { CATEGORY_LABELS, getNodeDefinition } from "@/domain/node-definitions";
import { getProviderOption, getProviderOptionsForNode, normalizeProviderIdForNode } from "@/domain/providers";
import { STAGE_COLOR_OPTIONS, getDefaultStageColor } from "@/domain/workflow-factory";
import type { ApprovalChainType, Approver, EdgeKind, NodeFieldDefinition, NodeStatus, ReviewDocument, Workflow, WorkflowNode, WorkflowStatus } from "@/domain/types";
import { deleteApprover, insertApprover, listApprovers } from "@/lib/litesql-approver-table";
import {
  listApprovalChainSnapshots,
  publishApprovalChainSnapshot,
  readUsers,
  type ApprovalChainSnapshotRow
} from "@/lib/local-flow-tables";
import { getAuthSession } from "@/lib/local-auth";
import { buildNodeLlmExport, downloadNodeLlmExport } from "@/lib/node-llm-export";
import { getNodeAccessRole, type WorkflowAccessRole } from "@/lib/workflow-access";
import { BrowserWorkflowRepository } from "@/lib/workflow-repository";
import { useWorkflowStore } from "@/store/use-workflow-store";
import { WorkflowChat } from "./workflow-chat";
import { DynamicIcon } from "./icon";
import { AlertTriangle, Bot, CheckCircle2, ClipboardList, Clock3, Download, Eye, FileText, GitPullRequestArrow, Layers3, Paperclip, Save, Search, Settings2, Tag, Trash2, UploadCloud, UserPlus, X, XCircle } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type NodeDocumentAsset = {
  id: string;
  title: string;
  type: "pdf" | "doc" | "text";
  url: string;
  summary?: string;
};

type ApprovalRoleMode = "creator" | "approver";
type RoleBannerRow = {
  label: string;
  detail: string;
};

const repository = new BrowserWorkflowRepository();
const APPROVAL_TAG_OPTIONS = [
  "urgent",
  "compliance",
  "legal",
  "finance",
  "security",
  "data",
  "model-risk",
  "vendor",
  "customer-impact",
  "production",
  "exception",
  "audit"
];

export function Inspector() {
  const workflow = useWorkflowStore((state) => state.workflow);
  const selectedItem = useWorkflowStore((state) => state.selectedItem);
  const inspectorCollapsed = useWorkflowStore((state) => state.inspectorCollapsed);
  const updateWorkflowMeta = useWorkflowStore((state) => state.updateWorkflowMeta);
  const addWorkflowDocument = useWorkflowStore((state) => state.addWorkflowDocument);
  const linkDocumentToNodes = useWorkflowStore((state) => state.linkDocumentToNodes);
  const unlinkDocumentFromNode = useWorkflowStore((state) => state.unlinkDocumentFromNode);
  const updateNode = useWorkflowStore((state) => state.updateNode);
  const updateNodeConfiguration = useWorkflowStore((state) => state.updateNodeConfiguration);
  const addEdge = useWorkflowStore((state) => state.addEdge);
  const updateEdge = useWorkflowStore((state) => state.updateEdge);
  const updateGroup = useWorkflowStore((state) => state.updateGroup);
  const setSaveStatus = useWorkflowStore((state) => state.setSaveStatus);
  const deleteSelected = useWorkflowStore((state) => state.deleteSelected);
  const duplicateSelected = useWorkflowStore((state) => state.duplicateSelected);
  const moveSelectedGroupLayer = useWorkflowStore((state) => state.moveSelectedGroupLayer);
  const select = useWorkflowStore((state) => state.select);
  const [activePanel, setActivePanel] = useState<"parameters" | "agent">("parameters");
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [approvalSaveNotice, setApprovalSaveNotice] = useState("");
  const [approvalReviewComment, setApprovalReviewComment] = useState("");
  const [activeApprovalRole, setActiveApprovalRole] = useState<ApprovalRoleMode>("creator");
  const currentUser = getAuthSession()?.user ?? null;

  const node = selectedItem.type === "node" ? workflow.nodes.find((item) => item.id === selectedItem.id) ?? null : null;
  const edge = selectedItem.type === "edge" ? workflow.edges.find((item) => item.id === selectedItem.id) ?? null : null;
  const group = selectedItem.type === "group" ? workflow.groups.find((item) => item.id === selectedItem.id) ?? null : null;
  const approvalData = useMemo(
    () =>
      node
        ? normalizeApprovalSquareData(node.data.configuration, {
            label: node.data.label,
            description: node.data.description,
            owner: node.data.owner,
            workflowOwner: workflow.owner,
            approvalChainType: workflow.approvalChainType
          })
        : null,
    [node, workflow.approvalChainType, workflow.owner]
  );
  const nodeDocuments = useMemo(() => getNodeDocuments(approvalData?.documents ?? node?.data.configuration.documents), [approvalData?.documents, node?.data.configuration.documents]);
  const chainApprovers = useMemo(
    () => approvers.filter((approver) => approverMatchesType(approver, workflow.approvalChainType)),
    [approvers, workflow.approvalChainType]
  );
  const approvalCreator = approvalData?.creator ?? "";
  const approvalApprover = approvalData?.approver || (node ? getApprovalNodeApprover(node) : "");
  const canEditWorkflowDocuments = workflow.flowKind !== "approval_chain" || !workflow.owner || isSameUser(workflow.owner, currentUser?.name, currentUser?.email);
  const canManageApprovalChain = workflow.flowKind !== "approval_chain" || !workflow.owner || isSameUser(workflow.owner, currentUser?.name, currentUser?.email);
  const hasCreatorApprovalRole = workflow.flowKind === "approval_chain" && Boolean(node && (!approvalCreator || isSameUser(approvalCreator, currentUser?.name, currentUser?.email)));
  const hasApproverApprovalRole = workflow.flowKind === "approval_chain" && Boolean(node && approvalApprover && isSameUser(approvalApprover, currentUser?.name, currentUser?.email));
  const hasDualApprovalRoles = hasCreatorApprovalRole && hasApproverApprovalRole;
  const workflowApproverNodes = useMemo(
    () =>
      workflow.flowKind === "approval_chain"
        ? workflow.nodes.filter((item) => {
            const approver = getApprovalNodeApprover(item);
            return approver && isSameUser(approver, currentUser?.name, currentUser?.email);
          })
        : [],
    [currentUser?.email, currentUser?.name, workflow.flowKind, workflow.nodes]
  );
  const hasWorkflowCreatorRole = workflow.flowKind === "approval_chain" && Boolean(!workflow.owner || isSameUser(workflow.owner, currentUser?.name, currentUser?.email));
  const hasWorkflowApproverRole = workflow.flowKind === "approval_chain" && workflowApproverNodes.length > 0;
  const hasWorkflowDualApprovalRoles = hasWorkflowCreatorRole && hasWorkflowApproverRole;
  const canEditApprovalSquare = workflow.flowKind !== "approval_chain" || !node || (hasCreatorApprovalRole && (!hasDualApprovalRoles || activeApprovalRole === "creator"));
  const canReviewApprovalSquare = hasApproverApprovalRole && (!hasDualApprovalRoles || activeApprovalRole === "approver");
  const canSaveApprovalSquare = Boolean(node && workflow.flowKind === "approval_chain" && (canEditApprovalSquare || canReviewApprovalSquare));
  const inspectorRole = getNodeAccessRole(workflow, node, currentUser);
  const roleBannerLabel = workflow.flowKind === "approval_chain" && ((node && hasDualApprovalRoles) || (!node && hasWorkflowDualApprovalRoles)) ? "Creator + Approver" : undefined;
  const roleBannerNote =
    workflow.flowKind === "approval_chain" && node && hasDualApprovalRoles
      ? `Active as ${activeApprovalRole === "creator" ? "Creator" : "Approver"}. Use the role switch in Node Properties to change mode.`
      : workflow.flowKind === "approval_chain" && !node && hasWorkflowDualApprovalRoles
        ? "Creator controls the chain setup. Approver can open assigned squares below and submit a review decision."
        : undefined;
  const roleBannerRows =
    workflow.flowKind === "approval_chain" && ((node && hasDualApprovalRoles) || (!node && hasWorkflowDualApprovalRoles))
      ? [
          {
            label: "Creator",
            detail: node ? "Can edit this square setup" : "Can manage this approval chain"
          },
          {
            label: "Approver",
            detail: node
              ? "Can review this assigned square"
              : `${workflowApproverNodes.length} assigned square${workflowApproverNodes.length === 1 ? "" : "s"} to review`
          }
        ]
      : undefined;
  const creatorPermissionNote =
    hasDualApprovalRoles && activeApprovalRole !== "creator"
      ? "Switch to Creator role to change setup, approver assignment, and uploaded documents."
      : !canEditApprovalSquare
        ? `Only ${approvalCreator || "the creator"} can change setup, approver assignment, and uploaded documents.`
        : "";

  async function saveApprovalSquare() {
    if (!canSaveApprovalSquare) return;
    setApprovalSaveNotice("");
    setSaveStatus("saving");
    try {
      await repository.save(useWorkflowStore.getState().workflow);
      setSaveStatus("saved");
      setApprovalSaveNotice(canReviewApprovalSquare && !canEditApprovalSquare ? "Saved review decision" : "Saved approval square");
      window.setTimeout(() => setSaveStatus("saved"), 700);
    } catch (error) {
      setSaveStatus("error");
      setApprovalSaveNotice(error instanceof Error ? error.message : "Save failed");
    }
  }

  function setApprovalDecision(status: "in_review" | "approved" | "rejected") {
    if (!node || workflow.flowKind !== "approval_chain" || !canReviewApprovalSquare) return;
    const actor = currentUser?.name ?? approvalApprover;
    const action = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "marked in review";
    const now = new Date().toISOString();
    const nextConfiguration = {
      ...node.data.configuration,
      status,
      approvalStatus: status,
      decision: status === "in_review" ? "pending" : status,
      comments: approvalReviewComment,
      reviewedAt: now,
      reviewedBy: actor,
      auditTrail: [
        ...(approvalData?.auditTrail ?? []),
        {
          at: now,
          actor,
          action,
          note: approvalReviewComment.trim() || undefined
        }
      ]
    };
    updateNode(node.id, {
      status: approvalStatusToNodeStatus(status),
      configuration: nextConfiguration
    });
    setApprovalSaveNotice(`${actor} ${action}`);
  }

  useEffect(() => {
    setApprovers(listApprovers());
  }, []);

  useEffect(() => {
    setApprovalReviewComment(approvalData?.comments ?? "");
  }, [approvalData?.comments, node?.id]);

  useEffect(() => {
    if (workflow.flowKind !== "approval_chain" || !node) return;
    setActiveApprovalRole((current) => {
      if (hasDualApprovalRoles) return current;
      if (hasCreatorApprovalRole) return "creator";
      if (hasApproverApprovalRole) return "approver";
      return "creator";
    });
  }, [hasApproverApprovalRole, hasCreatorApprovalRole, hasDualApprovalRoles, node, workflow.flowKind]);

  const selectionMeta = useMemo(() => {
    if (node) {
      const definition = getNodeDefinition(node.definitionId);
      return {
        icon: <DynamicIcon name={definition?.icon ?? "Circle"} />,
        kicker: "Node",
        title: node.data.label,
        subtitle: CATEGORY_LABELS[node.data.category]
      };
    }
    if (edge) {
      return {
        icon: <GitPullRequestArrow size={17} />,
        kicker: "Connection",
        title: edge.label || "Untitled edge",
        subtitle: edge.type.replaceAll("_", " ")
      };
    }
    if (group) {
      return {
        icon: <Layers3 size={17} />,
        kicker: "Stage",
        title: group.title,
        subtitle: `${Math.round(group.width)} x ${Math.round(group.height)}`
      };
    }
    return {
      icon: <Settings2 size={17} />,
      kicker: workflow.flowKind === "approval_chain" ? "Approval Chain" : "Workflow",
      title: workflow.name,
      subtitle:
        workflow.flowKind === "approval_chain"
          ? `${workflow.nodes.length} squares, ${workflow.edges.length} arrows`
          : `${workflow.nodes.length} nodes, ${workflow.edges.length} edges`
    };
  }, [edge, group, node, workflow.edges.length, workflow.flowKind, workflow.name, workflow.nodes.length]);

  if (inspectorCollapsed) {
    return <aside className="inspector compact" aria-label="Inspector" />;
  }

  return (
    <aside className="inspector" aria-label="Inspector">
      <header className="inspector-focus-header">
        <span className="inspector-focus-icon" aria-hidden="true">
          {selectionMeta.icon}
        </span>
        <div>
          <small>{selectionMeta.kicker}</small>
          <strong title={selectionMeta.title}>{selectionMeta.title}</strong>
          <span title={selectionMeta.subtitle}>{selectionMeta.subtitle}</span>
        </div>
      </header>

      <div className="inspector-tabs" role="tablist" aria-label="Inspector views">
        <button type="button" className={activePanel === "parameters" ? "active" : ""} onClick={() => setActivePanel("parameters")} role="tab" aria-selected={activePanel === "parameters"}>
          <ClipboardList size={14} />
          Parameters
        </button>
        <button type="button" className={activePanel === "agent" ? "active" : ""} onClick={() => setActivePanel("agent")} role="tab" aria-selected={activePanel === "agent"}>
          <Bot size={14} />
          Agent
        </button>
      </div>

      {activePanel === "agent" ? (
        <div className="inspector-panel agent-panel" role="tabpanel">
          <WorkflowChat />
        </div>
      ) : (
        <div className="inspector-panel" role="tabpanel">
          <InspectorRoleBanner role={inspectorRole} workflow={workflow} currentUser={currentUser?.name ?? ""} labelOverride={roleBannerLabel} noteOverride={roleBannerNote} roleRows={roleBannerRows} />
          {selectedItem.type === "workflow" && (
        <section className="form-stack inspector-sections">
          <InspectorSection icon={<Settings2 size={16} />} title="Workflow Details">
            <TextField label="Name" value={workflow.name} onChange={(value) => updateWorkflowMeta({ name: value })} />
            <TextArea label="Description" value={workflow.description ?? ""} onChange={(value) => updateWorkflowMeta({ description: value })} />
            <ReadOnlyField label="Structure" value={workflow.flowKind === "approval_chain" ? "Approval chain" : "AI workflow"} />
            {workflow.flowKind === "approval_chain" ? (
              <SelectField
                label="Approval chain type"
                value={workflow.approvalChainType ?? "underwriting"}
                options={APPROVAL_CHAIN_TYPE_OPTIONS.map((option) => option.id)}
                labels={Object.fromEntries(APPROVAL_CHAIN_TYPE_OPTIONS.map((option) => [option.id, option.label]))}
                onChange={(value) => updateWorkflowMeta({ approvalChainType: value as ApprovalChainType })}
              />
            ) : null}
            <TextField label="Version" value={workflow.version} onChange={(value) => updateWorkflowMeta({ version: value })} />
            <SelectField
              label="Status"
              value={workflow.status}
              options={["draft", "in_review", "approved", "archived"]}
              onChange={(value) => updateWorkflowMeta({ status: value as WorkflowStatus })}
            />
            <TextField label="Owner" value={workflow.owner ?? ""} onChange={(value) => updateWorkflowMeta({ owner: value })} />
            <TextField label="Team" value={workflow.team ?? ""} onChange={(value) => updateWorkflowMeta({ team: value })} />
            <TextField label="Tags" value={workflow.tags.join(", ")} onChange={(value) => updateWorkflowMeta({ tags: splitTags(value) })} />
          </InspectorSection>
          <WorkflowDocumentManager
            workflow={workflow}
            disabled={!canEditWorkflowDocuments}
            onAddDocument={addWorkflowDocument}
            onAssignDocument={linkDocumentToNodes}
          />
          {workflow.flowKind === "approval_chain" ? (
            <>
              <ApprovalPublishPanel workflow={workflow} />
              {hasWorkflowApproverRole ? (
                <ApproverAssignmentPanel
                  nodes={workflowApproverNodes}
                  onOpen={(nodeId) =>
                    select({
                      type: "node",
                      id: nodeId
                    })
                  }
                />
              ) : null}
              <ApproverTable
                approvalChainType={workflow.approvalChainType ?? "underwriting"}
                approvers={chainApprovers}
                disabled={!canManageApprovalChain}
                onAdd={(input) => {
                  if (!canManageApprovalChain) return;
                  insertApprover(input);
                  setApprovers(listApprovers());
                }}
                onDelete={(id) => {
                  if (!canManageApprovalChain) return;
                  deleteApprover(id);
                  setApprovers(listApprovers());
                }}
              />
            </>
          ) : null}
          <div className="inspector-summary">
            <span>{workflow.nodes.length} {workflow.flowKind === "approval_chain" ? "squares" : "nodes"}</span>
            <span>{workflow.edges.length} {workflow.flowKind === "approval_chain" ? "arrows" : "edges"}</span>
            <span>{workflow.groups.length} stages</span>
          </div>
        </section>
          )}

          {node && (
        <section className="form-stack inspector-sections">
          {workflow.flowKind === "approval_chain" ? (
            <>
              <InspectorSection icon={<ClipboardList size={16} />} title="Role Mode">
                <ApprovalRoleSummary
                  creator={approvalCreator}
                  approver={approvalApprover}
                  currentUser={currentUser?.name ?? ""}
                  hasCreatorRole={hasCreatorApprovalRole}
                  hasApproverRole={hasApproverApprovalRole}
                  activeRole={activeApprovalRole}
                  onActiveRoleChange={setActiveApprovalRole}
                />
              </InspectorSection>
              <InspectorSection icon={<Settings2 size={16} />} title="Creator Setup">
                <TextField label="Name" value={node.data.label} onChange={(value) => updateNode(node.id, { label: value })} disabled={!canEditApprovalSquare} />
                {approvalCreator ? (
                  <ReadOnlyField label="Creator" value={approvalCreator} />
                ) : (
                  <TextField
                    label="Creator"
                    value={currentUser?.name ?? ""}
                    onChange={(value) => updateNodeConfiguration(node.id, "creator", value)}
                    disabled={!canEditApprovalSquare}
                  />
                )}
                <ApproverSelectField
                  value={approvalData?.approver ?? ""}
                  approvers={chainApprovers}
                  onChange={(value) => updateNodeConfiguration(node.id, "approver", value)}
                  disabled={!canEditApprovalSquare}
                />
                {creatorPermissionNote ? <p className="approval-permission-note">{creatorPermissionNote}</p> : null}
                <TextArea
                  label="Description"
                  value={approvalData?.description ?? ""}
                  onChange={(value) => {
                    updateNode(node.id, { description: value });
                    updateNodeConfiguration(node.id, "description", value);
                  }}
                  disabled={!canEditApprovalSquare}
                />
                <ApprovalTagPicker
                  value={node.data.tags ?? []}
                  onChange={(tags) => updateNode(node.id, { tags })}
                  disabled={!canEditApprovalSquare}
                />
                <TextField label="Due date" value={approvalData?.dueDate ?? ""} onChange={(value) => updateNodeConfiguration(node.id, "dueDate", value)} disabled={!canEditApprovalSquare} />
                <TextArea label="Instructions" value={approvalData?.instructions ?? ""} onChange={(value) => updateNodeConfiguration(node.id, "instructions", value)} disabled={!canEditApprovalSquare} />
                <ReadOnlyField label="Current status" value={formatApprovalStatus(approvalData?.status ?? "not_reviewed")} />
                <ReadOnlyField label="Decision" value={formatApprovalStatus(approvalData?.decision || "pending")} />
              </InspectorSection>
              <NodeDocumentManager
                workflow={workflow}
                node={node}
                documents={nodeDocuments}
                disabled={!canEditApprovalSquare}
                onUploadDocument={(document) => linkDocumentToNodes(document, [node.id])}
                onAttachDocument={(document) => linkDocumentToNodes(document, [node.id])}
                onUnlinkDocument={(documentId) => unlinkDocumentFromNode(documentId, node.id)}
              />
              <ApprovalDecisionPanel
                status={approvalData?.status ?? "not_reviewed"}
                approver={approvalApprover}
                canReview={canReviewApprovalSquare}
                disabledReason={
                  hasDualApprovalRoles && activeApprovalRole !== "approver"
                    ? "Switch to Approver role to move this square to In Review, Approved, or Rejected."
                    : undefined
                }
                currentUser={currentUser?.name ?? ""}
                comment={approvalReviewComment}
                onCommentChange={setApprovalReviewComment}
                onDecision={setApprovalDecision}
              />
              <InspectorSection icon={<Save size={16} />} title="Save and Audit">
                <ReadOnlyField label="Audit trail" value={`${approvalData?.auditTrail.length ?? 0} event${approvalData?.auditTrail.length === 1 ? "" : "s"}`} />
                <div className="approval-save-panel">
                  <button type="button" onClick={() => void saveApprovalSquare()} disabled={!canSaveApprovalSquare}>
                    <Save size={14} />
                    Save
                  </button>
                  <small>{approvalSaveNotice || (canEditApprovalSquare ? "Save creator setup changes." : canReviewApprovalSquare ? "Save this approval decision." : "Save is locked for this role.")}</small>
                </div>
              </InspectorSection>
            </>
          ) : (
            <>
              <InspectorSection icon={<ClipboardList size={16} />} title="Node Details">
                <TextField label="Name" value={node.data.label} onChange={(value) => updateNode(node.id, { label: value })} />
                <TextArea label="Description" value={node.data.description ?? ""} onChange={(value) => updateNode(node.id, { description: value })} />
                <ReadOnlyField label="Category" value={CATEGORY_LABELS[node.data.category]} />
                <TextField label="Owner" value={node.data.owner ?? ""} onChange={(value) => updateNode(node.id, { owner: value })} />
                <TextField label="Technology" value={node.data.technology ?? ""} onChange={(value) => updateNode(node.id, { technology: value })} />
                <SelectField
                  label="Status"
                  value={node.data.status ?? "not_started"}
                  options={["not_started", "in_progress", "ready", "needs_review", "blocked"]}
                  onChange={(value) => updateNode(node.id, { status: value as never })}
                />
                <TextField label="Tags" value={(node.data.tags ?? []).join(", ")} onChange={(value) => updateNode(node.id, { tags: splitTags(value) })} />
                <TextField label="Documentation URL" value={node.data.documentationUrl ?? ""} onChange={(value) => updateNode(node.id, { documentationUrl: value })} />
                <TextArea label="Notes" value={node.data.notes ?? ""} onChange={(value) => updateNode(node.id, { notes: value })} />
              </InspectorSection>
              <NodeDocumentManager
                workflow={workflow}
                node={node}
                documents={nodeDocuments}
                onUploadDocument={(document) => linkDocumentToNodes(document, [node.id])}
                onAttachDocument={(document) => linkDocumentToNodes(document, [node.id])}
                onUnlinkDocument={(documentId) => unlinkDocumentFromNode(documentId, node.id)}
              />

              <InspectorSection icon={<Settings2 size={16} />} title="Governance">
                <SelectField
                  label="Data sensitivity"
                  value={String(node.data.configuration.dataSensitivity ?? node.data.configuration.sensitivity ?? "")}
                  options={["", "public", "internal", "confidential", "restricted"]}
                  onChange={(value) => updateNodeConfiguration(node.id, "dataSensitivity", value)}
                />
                <SelectField
                  label="Risk level"
                  value={String(node.data.configuration.riskLevel ?? "")}
                  options={["", "low", "medium", "high", "critical"]}
                  onChange={(value) => updateNodeConfiguration(node.id, "riskLevel", value)}
                />
                <SelectField
                  label="Approval status"
                  value={String(node.data.configuration.approvalStatus ?? "")}
                  options={["", "not_reviewed", "in_review", "approved", "rejected"]}
                  onChange={(value) => updateNodeConfiguration(node.id, "approvalStatus", value)}
                />
              </InspectorSection>

              <InspectorSection icon={<Settings2 size={16} />} title={`${CATEGORY_LABELS[node.data.category]} Configuration`}>
                {(getNodeDefinition(node.definitionId)?.fields ?? [])
                  .filter((field) => !["owner", "technology", "status", "tags", "documentationUrl", "notes"].includes(field.key))
                  .map((field) => (
                    <NodeConfigField
                      key={field.key}
                      field={field}
                      definitionId={node.definitionId}
                      approvers={[]}
                      value={String(node.data.configuration[field.key] ?? "")}
                      onChange={(value) => updateNodeConfiguration(node.id, field.key, value)}
                    />
                  ))}
              </InspectorSection>
            </>
          )}
          <NodeLlmExportAction
            workflow={workflow}
            node={node}
          />
          <NodeConnectionCreator
            selectedNodeId={node.id}
            nodes={workflow.nodes.map((item) => ({ id: item.id, label: item.data.label }))}
            onCreate={addEdge}
            showType={workflow.flowKind !== "approval_chain"}
            defaultType={workflow.flowKind === "approval_chain" ? "approval" : "data"}
            disabled={workflow.flowKind === "approval_chain" && !canEditApprovalSquare}
          />
          {workflow.flowKind === "approval_chain" ? (
            <div className="approval-danger-zone inspector-section">
              <SectionTitle icon={<AlertTriangle size={16} />} title="Danger Zone" />
              <p>Deleting this square also removes any edges attached to it.</p>
              <button type="button" className="danger" onClick={deleteSelected} disabled={!canEditApprovalSquare}>
                <Trash2 size={14} />
                Delete square
              </button>
            </div>
          ) : (
            <div className="inspector-actions">
              <button type="button" onClick={duplicateSelected}>
                Duplicate
              </button>
              <button type="button" className="danger" onClick={deleteSelected}>
                Delete
              </button>
            </div>
          )}
        </section>
          )}

          {edge && (
        <section className="form-stack">
          <SectionTitle icon={<GitPullRequestArrow size={16} />} title="Edge Properties" />
          <TextField label="Label" value={edge.label ?? ""} onChange={(value) => updateEdge(edge.id, { label: value })} />
          <TextArea label="Description" value={edge.description ?? ""} onChange={(value) => updateEdge(edge.id, { description: value })} />
          <SelectField
            label="Type"
            value={edge.type}
            options={["data", "control", "feedback", "approval", "dependency"]}
            onChange={(value) => updateEdge(edge.id, { type: value as EdgeKind })}
          />
          <label className="toggle-line">
            <input type="checkbox" checked={Boolean(edge.animated)} onChange={(event) => updateEdge(edge.id, { animated: event.target.checked })} />
            Animated edge
          </label>
          <RangeField
            label="Curvature"
            value={Math.round((edge.curvature ?? 0.42) * 100)}
            min={0}
            max={100}
            suffix="%"
            onChange={(value) => updateEdge(edge.id, { curvature: value / 100 })}
          />
          <div className="curve-presets" aria-label="Curvature presets">
            <button type="button" className={(edge.curvature ?? 0.42) === 0 ? "active" : ""} onClick={() => updateEdge(edge.id, { curvature: 0 })}>
              Straight
            </button>
            <button type="button" className={Math.abs((edge.curvature ?? 0.42) - 0.42) < 0.01 ? "active" : ""} onClick={() => updateEdge(edge.id, { curvature: 0.42 })}>
              Soft
            </button>
            <button type="button" className={(edge.curvature ?? 0.42) >= 0.8 ? "active" : ""} onClick={() => updateEdge(edge.id, { curvature: 0.85 })}>
              Round
            </button>
          </div>
          <SelectField
            label="Source side"
            value={handleToSide(edge.sourceHandle, "source")}
            options={["left", "right", "top", "bottom"]}
            onChange={(value) => updateEdge(edge.id, { sourceHandle: sideToHandle(value, "source") })}
          />
          <SelectField
            label="Target side"
            value={handleToSide(edge.targetHandle, "target")}
            options={["left", "right", "top", "bottom"]}
            onChange={(value) => updateEdge(edge.id, { targetHandle: sideToHandle(value, "target") })}
          />
          <div className="inspector-actions">
            <button type="button" onClick={() => moveSelectedGroupLayer("backward")}>
              Send Back
            </button>
            <button type="button" onClick={() => moveSelectedGroupLayer("forward")}>
              Bring Forward
            </button>
          </div>
          <div className="inspector-actions">
            <button type="button" className="danger" onClick={deleteSelected}>
              Delete
            </button>
          </div>
        </section>
          )}

          {group && (
        <section className="form-stack">
          <SectionTitle icon={<Layers3 size={16} />} title="Stage Group" />
          <TextField label="Title" value={group.title} onChange={(value) => updateGroup(group.id, { title: value })} />
          <TextArea label="Description" value={group.description ?? ""} onChange={(value) => updateGroup(group.id, { description: value })} />
          <StageColorField
            color={group.color}
            defaultColor={group.defaultColor ?? getDefaultStageColor(workflow.groups.findIndex((item) => item.id === group.id))}
            onChange={(value) => updateGroup(group.id, { color: value })}
          />
          <label className="toggle-line">
            <input type="checkbox" checked={Boolean(group.collapsed)} onChange={(event) => updateGroup(group.id, { collapsed: event.target.checked })} />
            Collapse description
          </label>
          <div className="inspector-summary">
            <span>{Math.round(group.width)}w</span>
            <span>{Math.round(group.height)}h</span>
          </div>
          <div className="inspector-actions">
            <button type="button" className="danger" onClick={deleteSelected}>
              Delete
            </button>
          </div>
        </section>
          )}
        </div>
      )}
    </aside>
  );
}

function NodeLlmExportAction({ workflow, node }: { workflow: Workflow; node: WorkflowNode }) {
  const [notice, setNotice] = useState("");
  const [evaluation, setEvaluation] = useState("");
  const [evaluating, setEvaluating] = useState(false);

  function payloadText() {
    const payload = buildNodeLlmExport(workflow, node.id);
    return payload ? JSON.stringify(payload, null, 2) : "";
  }

  async function copyJson() {
    const text = payloadText();
    if (!text) return;
    await navigator.clipboard?.writeText(text);
    setNotice("Copied square JSON");
  }

  async function evaluateSquare() {
    const payload = buildNodeLlmExport(workflow, node.id);
    if (!payload || evaluating) return;
    setEvaluating(true);
    setNotice("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: payload.evaluationPrompt }],
          context: JSON.stringify(payload, null, 2),
          workflow,
          selected: { type: "node", id: node.id }
        })
      });
      const data = (await response.json()) as { message?: string; error?: string };
      setEvaluation(data.message || data.error || "No evaluation returned.");
      setNotice("Evaluation complete");
    } catch (error) {
      setEvaluation(error instanceof Error ? error.message : "Evaluation failed.");
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <div className="node-llm-export inspector-section">
      <SectionTitle icon={<Download size={16} />} title="LLM Evaluation Export" />
      <p>Download this square with its connected edges, documents, provider details, stage, and workflow context.</p>
      <div className="node-llm-actions">
        <button type="button" onClick={() => downloadNodeLlmExport(workflow, node.id)}>
          <Download size={14} />
          Download
        </button>
        <button type="button" onClick={() => void copyJson()}>
          Copy JSON
        </button>
        <button type="button" disabled={evaluating} onClick={() => void evaluateSquare()}>
          {evaluating ? "Evaluating..." : "Send to AI evaluator"}
        </button>
      </div>
      <small>{notice || node.data.label}</small>
      {evaluation ? <pre className="node-evaluation-result">{evaluation}</pre> : null}
    </div>
  );
}

function StageColorField({ color, defaultColor, onChange }: { color: string; defaultColor: string; onChange: (value: string) => void }) {
  const knownOptions: string[] = STAGE_COLOR_OPTIONS.map((option) => option.value);
  const options = knownOptions.includes(color) ? knownOptions : [...knownOptions, color];
  const labels = Object.fromEntries(STAGE_COLOR_OPTIONS.map((option) => [option.value, option.label]));
  const selectedLabel = labels[color] ?? `Custom ${color}`;
  const defaultLabel = labels[defaultColor] ?? defaultColor;
  const isCustomFromDefault = normalizeHex(color) !== normalizeHex(defaultColor);

  return (
    <div className="stage-color-field">
      <SelectField label="Color" value={color} options={options} labels={{ ...labels, [color]: selectedLabel }} onChange={onChange} />
      <div className="stage-color-preview">
        <span style={{ "--stage-preview-color": color } as React.CSSProperties} />
        <div>
          <strong>{selectedLabel}</strong>
          <small>Default: {defaultLabel}</small>
        </div>
      </div>
      {isCustomFromDefault && (
        <p className="stage-color-note" role="note">
          <AlertTriangle size={14} />
          This stage is using a non-default color.
        </p>
      )}
    </div>
  );
}

function InspectorRoleBanner({
  role,
  workflow,
  currentUser,
  labelOverride,
  noteOverride,
  roleRows
}: {
  role: WorkflowAccessRole;
  workflow: Workflow;
  currentUser: string;
  labelOverride?: string;
  noteOverride?: string;
  roleRows?: RoleBannerRow[];
}) {
  const isApprovalChain = workflow.flowKind === "approval_chain";
  const labels: Record<WorkflowAccessRole, string> = {
    manager: isApprovalChain ? "Creator" : "Manager",
    approver: "Approver",
    reader: isApprovalChain ? "Approver" : "Reader",
    none: isApprovalChain ? "No approval role" : "No access"
  };
  const notes: Record<WorkflowAccessRole, string> = {
    manager: isApprovalChain ? "Can create and manage approval-chain setup, approvers, documents, and metadata." : "Can manage setup, documents, and workflow metadata.",
    approver: "Can review assigned approval squares and view linked documents.",
    reader: isApprovalChain ? "Can review assigned approval squares and view linked documents." : "Can view invited workflow content and assigned documents.",
    none: isApprovalChain ? "This approval chain is not assigned to the current user." : "This workflow is not assigned to the current user."
  };

  return (
    <div className={`inspector-role-banner ${role}`}>
      <span>Signed in role</span>
      <strong>{labelOverride ?? labels[role]}</strong>
      <small>{currentUser || "Not signed in"} · {workflow.flowKind === "approval_chain" ? "Approval Chain" : "AI Workflow"}</small>
      <p>{noteOverride ?? notes[role]}</p>
      {roleRows?.length ? (
        <div className="inspector-role-list" aria-label="Signed in approval roles">
          {roleRows.map((item) => (
            <div className="inspector-role-row" key={item.label}>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ApproverAssignmentPanel({ nodes, onOpen }: { nodes: WorkflowNode[]; onOpen: (nodeId: string) => void }) {
  return (
    <div className="inspector-section">
      <SectionTitle icon={<CheckCircle2 size={16} />} title="Approver Review" />
      <div className="approval-assignment-panel">
        <div className="approval-assignment-meta">
          <strong>{nodes.length} assigned square{nodes.length === 1 ? "" : "s"}</strong>
          <span>Open a square to approve or reject.</span>
        </div>
        <div className="approval-assignment-list" aria-label="Squares assigned to current approver">
          {nodes.map((node) => {
            const status = String(node.data.configuration.approvalStatus ?? node.data.configuration.status ?? node.data.status ?? "");
            return (
              <button type="button" className="approval-assignment-row" key={node.id} onClick={() => onOpen(node.id)}>
                <span>
                  <strong>{node.data.label}</strong>
                  <small>{formatApprovalStatus(status)}</small>
                </span>
                <Eye size={13} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ApprovalTagPicker({ value, onChange, disabled = false }: { value: string[]; onChange: (tags: string[]) => void; disabled?: boolean }) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return APPROVAL_TAG_OPTIONS.filter((tag) => !selected.has(tag) && (!normalized || tag.includes(normalized))).slice(0, 6);
  }, [query, selected]);

  function addTag(tag: string) {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean || selected.has(clean)) return;
    onChange([...value, clean]);
    setQuery("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((item) => item !== tag));
  }

  return (
    <div className="approval-tag-picker">
      <SectionTitle icon={<Tag size={16} />} title="Tags" />
      <div className="approval-tag-list" aria-label="Selected approval tags">
        {value.length ? (
          value.map((tag) => (
            <button key={tag} type="button" className="approval-tag-chip selected" onClick={() => removeTag(tag)} disabled={disabled} title={disabled ? tag : `Remove ${tag}`}>
              {tag}
              {!disabled ? <X size={12} /> : null}
            </button>
          ))
        ) : (
          <span className="empty-panel-note">No tags selected.</span>
        )}
      </div>
      {!disabled ? (
        <>
          <label className="field">
            <span>Find tags</span>
            <div className="search-input-shell">
              <Search size={14} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag(query);
                  }
                }}
                placeholder="Search or add a tag"
              />
              {query ? (
                <button type="button" aria-label="Clear tag search" onClick={() => setQuery("")}>
                  <X size={13} />
                </button>
              ) : null}
            </div>
          </label>
          <div className="approval-tag-results" aria-label="Suggested approval tags">
            {filtered.map((tag) => (
              <button key={tag} type="button" className="approval-tag-chip" onClick={() => addTag(tag)}>
                {tag}
              </button>
            ))}
            {query.trim() && !selected.has(query.trim().toLowerCase().replace(/\s+/g, "-")) ? (
              <button type="button" className="approval-tag-chip custom" onClick={() => addTag(query)}>
                Add {query.trim()}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ApprovalRoleSummary({
  creator,
  approver,
  currentUser,
  hasCreatorRole,
  hasApproverRole,
  activeRole,
  onActiveRoleChange
}: {
  creator: string;
  approver: string;
  currentUser: string;
  hasCreatorRole: boolean;
  hasApproverRole: boolean;
  activeRole: ApprovalRoleMode;
  onActiveRoleChange: (role: ApprovalRoleMode) => void;
}) {
  const hasBothRoles = hasCreatorRole && hasApproverRole;
  const role = hasBothRoles ? `${activeRole === "creator" ? "Creator" : "Approver"} mode` : hasCreatorRole ? "Creator" : hasApproverRole ? "Approver" : "Viewer";
  const cardClass = hasBothRoles ? activeRole : hasCreatorRole ? "creator" : hasApproverRole ? "approver" : "viewer";
  return (
    <div className={`approval-role-card ${cardClass} ${hasBothRoles ? "dual" : ""}`}>
      <div>
        <span>Current role</span>
        <strong>{role}</strong>
        <small>{currentUser || "Not signed in"}</small>
      </div>
      <dl>
        <div>
          <dt>Creator</dt>
          <dd>{creator || "Current user on create"}</dd>
        </div>
        <div>
          <dt>Approver</dt>
          <dd>{approver || "Unassigned"}</dd>
        </div>
      </dl>
      {hasBothRoles ? (
        <div className="approval-role-switch" role="group" aria-label="Switch approval role">
          <button type="button" className={activeRole === "creator" ? "active" : ""} onClick={() => onActiveRoleChange("creator")}>
            Creator
          </button>
          <button type="button" className={activeRole === "approver" ? "active" : ""} onClick={() => onActiveRoleChange("approver")}>
            Approver
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ApprovalDecisionPanel({
  status,
  approver,
  canReview,
  disabledReason,
  currentUser,
  comment,
  onCommentChange,
  onDecision
}: {
  status: string;
  approver: string;
  canReview: boolean;
  disabledReason?: string;
  currentUser: string;
  comment: string;
  onCommentChange: (value: string) => void;
  onDecision: (status: "in_review" | "approved" | "rejected") => void;
}) {
  return (
    <div className="approval-decision-panel inspector-section">
      <SectionTitle icon={<CheckCircle2 size={16} />} title="Approver Review" />
      <div className={`approval-status-banner ${status.replaceAll("_", "-")}`}>
        <strong>{formatApprovalStatus(status)}</strong>
        <span>{canReview ? `Signed in as ${currentUser || approver}` : approver ? `Waiting for ${approver}` : "No approver assigned yet"}</span>
      </div>
      <TextArea label="Review comments" value={comment} onChange={onCommentChange} disabled={!canReview} />
      <div className="approval-decision-actions" role="group" aria-label="Approval decision actions">
        <button type="button" className="review" disabled={!canReview} onClick={() => onDecision("in_review")}>
          <Clock3 size={15} />
          In Review
        </button>
        <button type="button" className="approve" disabled={!canReview} onClick={() => onDecision("approved")}>
          <CheckCircle2 size={15} />
          Approve
        </button>
        <button type="button" className="reject" disabled={!canReview} onClick={() => onDecision("rejected")}>
          <XCircle size={15} />
          Reject
        </button>
      </div>
      {!canReview ? <p className="approval-permission-note">{disabledReason ?? "Only the assigned approver can move this square to In Review, Approved, or Rejected."}</p> : null}
    </div>
  );
}

function ApproverSelectField({ value, approvers, onChange, disabled = false }: { value: string; approvers: Approver[]; onChange: (value: string) => void; disabled?: boolean }) {
  const [query, setQuery] = useState(value);
  const [focused, setFocused] = useState(false);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = normalized
      ? approvers.filter((approver) => [approver.name, approver.role, approver.team, approver.email].join(" ").toLowerCase().includes(normalized))
      : approvers;
    if (value && !matches.some((approver) => approver.name === value)) {
      return [{ id: `current-${value}`, name: value, email: "", role: "Current value", team: "", approvalChainTypes: [] as ApprovalChainType[] }, ...matches];
    }
    return matches;
  }, [approvers, query, value]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  return (
    <div className="approver-search-field">
      <label className="field">
        <span>Approver</span>
        <div className="search-input-shell">
          <Search size={14} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              onChange(event.target.value);
            }}
            onFocus={() => setFocused(true)}
            placeholder="Search approver by name, role, or team"
            disabled={disabled}
          />
          {query && !disabled ? (
            <button
              type="button"
              aria-label="Clear approver"
              onClick={() => {
                setQuery("");
                onChange("");
              }}
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </label>
      {!disabled && (focused || query) && (
        <div className="approver-search-results">
          {filtered.length ? (
            filtered.map((approver) => (
              <button
                type="button"
                key={approver.id}
                className={approver.name === value ? "selected" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery(approver.name);
                  onChange(approver.name);
                  setFocused(false);
                }}
              >
                <strong>{approver.name}</strong>
                <span>{approver.role ? `${approver.role}${approver.team ? ` - ${approver.team}` : ""}` : "Custom approver"}</span>
              </button>
            ))
          ) : (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(query.trim());
                setFocused(false);
              }}
            >
              <strong>{`Use ${query.trim() || "Unassigned"}`}</strong>
              <span>Custom approver</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function getApprovalNodeApprover(node: WorkflowNode) {
  return firstConfiguredText(node.data.configuration.approver, node.data.configuration.assignee, node.data.configuration.reviewer);
}

function getApprovalNodeApproverKey(node: WorkflowNode) {
  if (typeof node.data.configuration.assignee === "string") return "assignee";
  if (typeof node.data.configuration.reviewer === "string") return "reviewer";
  return "approver";
}

function getApprovalNodeDescription(node: WorkflowNode) {
  return firstConfiguredText(
    node.data.configuration.description,
    node.data.configuration.instructions,
    node.data.configuration.reviewCriteria,
    node.data.configuration.approvalCriteria,
    node.data.configuration.summary
  );
}

function approvalStatusToNodeStatus(value: string): NodeStatus {
  if (value === "approved") return "ready";
  if (value === "in_review") return "in_progress";
  if (value === "rejected") return "blocked";
  if (value === "not_started") return "not_started";
  return "needs_review";
}

function firstConfiguredText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function isSameUser(value: string, ...candidates: Array<string | undefined>) {
  const normalizedValue = normalizeUserValue(value);
  return Boolean(normalizedValue) && candidates.some((candidate) => normalizeUserValue(candidate ?? "") === normalizedValue);
}

function normalizeUserValue(value: string) {
  return value.trim().toLowerCase();
}

function NodeConfigField({
  field,
  value,
  onChange,
  definitionId,
  approvers = []
}: {
  field: NodeFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  definitionId?: string;
  approvers?: Approver[];
}) {
  if (field.type === "textarea") return <TextArea label={field.label} value={value} onChange={onChange} required={field.required} />;
  if (field.key === "providerId" && definitionId) {
    const providerOptions = getProviderOptionsForNode(definitionId);
    const normalizedValue = normalizeProviderIdForNode(definitionId, value);
    const selectedProvider = getProviderOption(normalizedValue);
    return (
      <div className="provider-field">
        <SelectField
          label={field.label}
          value={normalizedValue}
          options={["", ...providerOptions.map((provider) => provider.id)]}
          labels={{ "": "General", ...Object.fromEntries(providerOptions.map((provider) => [provider.id, provider.name])) }}
          onChange={onChange}
          required={field.required}
        />
        {selectedProvider && (
          <div className="selected-provider-preview">
            <Image src={selectedProvider.icon} alt="" width={26} height={26} />
            <span>{selectedProvider.name}</span>
          </div>
        )}
      </div>
    );
  }
  if (["assignee", "reviewer", "approver"].includes(field.key) && approvers.length) {
    const approverNames = approvers.map((approver) => approver.name);
    const options = ["", ...approverNames, ...(value && !approverNames.includes(value) ? [value] : [])];
    const labels = Object.fromEntries(approvers.map((approver) => [approver.name, `${approver.name} · ${approver.role}`]));
    return <SelectField label={field.label} value={value} options={options} labels={{ "": "Select approver", ...labels, [value]: labels[value] ?? value }} onChange={onChange} required={field.required} />;
  }
  if (field.type === "select") return <SelectField label={field.label} value={value} options={field.options ?? []} onChange={onChange} required={field.required} />;
  return <TextField label={field.label} value={value} onChange={onChange} required={field.required} />;
}

function WorkflowDocumentManager({
  workflow,
  disabled = false,
  onAddDocument,
  onAssignDocument
}: {
  workflow: Workflow;
  disabled?: boolean;
  onAddDocument: (document: ReviewDocument) => void;
  onAssignDocument: (document: ReviewDocument, nodeIds: string[]) => void;
}) {
  const allDocuments = useMemo(() => getWorkflowDocuments(workflow), [workflow]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [documentId, setDocumentId] = useState(allDocuments[0]?.id ?? "");
  const selectedDocument = allDocuments.find((document) => document.id === documentId) ?? null;

  useEffect(() => {
    setSelectedNodeIds((ids) => ids.filter((id) => workflow.nodes.some((node) => node.id === id)));
  }, [workflow.nodes]);

  useEffect(() => {
    if (documentId && allDocuments.some((document) => document.id === documentId)) return;
    setDocumentId(allDocuments[0]?.id ?? "");
  }, [allDocuments, documentId]);

  return (
    <div className="document-manager inspector-section">
      <SectionTitle icon={<Paperclip size={16} />} title="Document Library" />
      <div className="document-manager-panel">
        {!disabled ? (
          <DocumentUploadForm
            actionLabel={selectedNodeIds.length ? "Upload and assign" : "Upload to library"}
            onUpload={(document) => {
              onAddDocument(document);
              if (selectedNodeIds.length) onAssignDocument(document, selectedNodeIds);
            }}
          />
        ) : (
          <p className="empty-panel-note">Document upload is available to the creator. Other users can view linked documents.</p>
        )}
        {!disabled && workflow.nodes.length ? (
          <NodeAssignmentPicker
            nodes={workflow.nodes}
            selectedNodeIds={selectedNodeIds}
            onChange={setSelectedNodeIds}
            title={workflow.flowKind === "approval_chain" ? "Assign to approval squares" : "Assign to workflow squares"}
          />
        ) : null}
        {!disabled && allDocuments.length ? (
          <div className="existing-document-assignment">
            <SelectField
              label="Existing document"
              value={documentId}
              options={allDocuments.map((document) => document.id)}
              labels={Object.fromEntries(allDocuments.map((document) => [document.id, document.title]))}
              onChange={setDocumentId}
            />
            <button type="button" disabled={!selectedDocument || !selectedNodeIds.length} onClick={() => selectedDocument && onAssignDocument(selectedDocument, selectedNodeIds)}>
              <Paperclip size={14} />
              Assign to selected squares
            </button>
          </div>
        ) : null}
        {!allDocuments.length ? (
          <p className="empty-panel-note">No documents are in this workflow yet.</p>
        ) : null}
        {allDocuments.length ? <NodeDocumentViewer documents={allDocuments} title="Workflow Documents" /> : null}
      </div>
    </div>
  );
}

function NodeDocumentManager({
  workflow,
  node,
  documents,
  disabled = false,
  onUploadDocument,
  onAttachDocument,
  onUnlinkDocument
}: {
  workflow: Workflow;
  node: WorkflowNode;
  documents: NodeDocumentAsset[];
  disabled?: boolean;
  onUploadDocument: (document: ReviewDocument) => void;
  onAttachDocument: (document: ReviewDocument) => void;
  onUnlinkDocument: (documentId: string) => void;
}) {
  const allDocuments = useMemo(() => getWorkflowDocuments(workflow), [workflow]);
  const linkedIds = useMemo(() => new Set(documents.map((document) => document.id)), [documents]);
  const attachableDocuments = allDocuments.filter((document) => !linkedIds.has(document.id));
  const [documentId, setDocumentId] = useState(attachableDocuments[0]?.id ?? "");
  const selectedDocument = attachableDocuments.find((document) => document.id === documentId) ?? null;

  useEffect(() => {
    if (documentId && attachableDocuments.some((document) => document.id === documentId)) return;
    setDocumentId(attachableDocuments[0]?.id ?? "");
  }, [attachableDocuments, documentId]);

  return (
    <div className="document-manager inspector-section">
      <SectionTitle icon={<FileText size={16} />} title="Documents to Review" />
      <div className="document-manager-panel">
        <div className="document-manager-meta">
          <strong>{documents.length} linked</strong>
          <span>{workflow.flowKind === "approval_chain" ? "Approval square" : "Workflow square"}: {node.data.label}</span>
        </div>
        {!disabled ? <DocumentUploadForm actionLabel="Upload and link" onUpload={onUploadDocument} /> : <p className="empty-panel-note">Documents are view-only for this role.</p>}
        {!disabled && attachableDocuments.length ? (
          <div className="existing-document-assignment">
            <SelectField
              label="Attach existing"
              value={documentId}
              options={attachableDocuments.map((document) => document.id)}
              labels={Object.fromEntries(attachableDocuments.map((document) => [document.id, document.title]))}
              onChange={setDocumentId}
              disabled={disabled}
            />
            <button type="button" disabled={!selectedDocument || disabled} onClick={() => selectedDocument && onAttachDocument(selectedDocument)}>
              <Paperclip size={14} />
              Attach
            </button>
          </div>
        ) : null}
        {documents.length ? (
          <NodeDocumentViewer documents={documents} onRemove={disabled ? undefined : onUnlinkDocument} />
        ) : (
          <p className="empty-panel-note">No documents are linked to this square.</p>
        )}
      </div>
    </div>
  );
}

function DocumentUploadForm({
  actionLabel,
  onUpload,
  disabled = false
}: {
  actionLabel: string;
  onUpload: (document: ReviewDocument) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [notice, setNotice] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file || disabled) return;
    try {
      const document = await fileToReviewDocument(file, title, summary);
      onUpload(document);
      setTitle("");
      setSummary("");
      setNotice(`Added ${document.title}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="document-upload-form">
      <TextField label="Document name" value={title} onChange={setTitle} disabled={disabled} />
      <TextArea label="Review note" value={summary} onChange={setSummary} disabled={disabled} />
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept=".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
        onChange={(event) => void handleFile(event.target.files?.[0])}
        disabled={disabled}
      />
      <button type="button" className="document-upload-button" disabled={disabled} onClick={() => fileInputRef.current?.click()}>
        <UploadCloud size={14} />
        {actionLabel}
      </button>
      <small>{notice || "PDF, DOCX, DOC, TXT, and Markdown are supported."}</small>
    </div>
  );
}

function NodeAssignmentPicker({
  nodes,
  selectedNodeIds,
  onChange,
  title
}: {
  nodes: WorkflowNode[];
  selectedNodeIds: string[];
  onChange: (ids: string[]) => void;
  title: string;
}) {
  const selected = new Set(selectedNodeIds);
  return (
    <div className="node-assignment-picker">
      <div className="document-manager-meta">
        <strong>{title}</strong>
        <span>{selectedNodeIds.length} selected</span>
      </div>
      <div className="node-assignment-list">
        {nodes.map((node) => (
          <label key={node.id} className="node-assignment-row">
            <input
              type="checkbox"
              checked={selected.has(node.id)}
              onChange={(event) => {
                const next = new Set(selectedNodeIds);
                if (event.target.checked) next.add(node.id);
                else next.delete(node.id);
                onChange([...next]);
              }}
            />
            <span>{node.data.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function NodeDocumentViewer({
  documents,
  title = "Documents",
  onRemove,
  removeDisabled = false
}: {
  documents: NodeDocumentAsset[];
  title?: string;
  onRemove?: (documentId: string) => void;
  removeDisabled?: boolean;
}) {
  const [selectedId, setSelectedId] = useState("");
  const selected = documents.find((document) => document.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !documents.some((document) => document.id === selectedId)) setSelectedId("");
  }, [documents, selectedId]);

  return (
    <>
      <SectionTitle icon={<FileText size={16} />} title={title} />
      <div className="node-document-viewer">
        <div className="node-document-list" aria-label="Node documents">
          {documents.map((document) => (
            <div
              key={document.id}
              className="node-document-row"
            >
              <span className="document-type-badge">{document.type.toUpperCase()}</span>
              <span>
                <strong>{document.title}</strong>
                <small>{document.summary || "No summary yet."}</small>
              </span>
              <button type="button" className="node-document-view-button" onClick={() => setSelectedId(document.id)}>
                <Eye size={13} />
                View
              </button>
              {onRemove ? (
                <button
                  type="button"
                  className="node-document-remove-button"
                  aria-label={`Remove ${document.title}`}
                  title={`Remove ${document.title}`}
                  disabled={removeDisabled}
                  onClick={() => onRemove(document.id)}
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {selected ? <DocumentPreviewModal document={selected} onClose={() => setSelectedId("")} /> : null}
    </>
  );
}

function DocumentPreviewModal({ document, onClose }: { document: NodeDocumentAsset; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="document-modal-backdrop" role="dialog" aria-modal="true" aria-label={`View ${document.title}`} onMouseDown={onClose}>
      <div className="document-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>{document.type.toUpperCase()}</span>
            <strong>{document.title}</strong>
          </div>
          <button type="button" aria-label="Close document viewer" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        {document.summary ? <p>{document.summary}</p> : null}
        <div className="document-modal-frame">
          {document.type === "pdf" ? (
            <iframe src={document.url} title={document.title} />
          ) : (
            <a className="node-document-download" href={document.url} download>
              <FileText size={18} />
              Download {document.title}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ApproverTable({
  approvers,
  approvalChainType,
  disabled = false,
  onAdd,
  onDelete
}: {
  approvers: Approver[];
  approvalChainType: ApprovalChainType;
  disabled?: boolean;
  onAdd: (input: Omit<Approver, "id">) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<ReturnType<typeof readUsers>>([]);
  const chainLabel = getApprovalChainTypeLabel(approvalChainType);
  const existingApproverNames = useMemo(() => new Set(approvers.map((approver) => approver.name.toLowerCase())), [approvers]);
  const existingApproverEmails = useMemo(() => new Set(approvers.map((approver) => approver.email.toLowerCase())), [approvers]);
  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users
      .filter((user) => !existingApproverNames.has(user.name.toLowerCase()) && !existingApproverEmails.has(user.email.toLowerCase()))
      .filter((user) => !normalized || [user.name, user.email, user.role, user.team].join(" ").toLowerCase().includes(normalized))
      .slice(0, 6);
  }, [existingApproverEmails, existingApproverNames, query, users]);

  useEffect(() => {
    setUsers(readUsers());
  }, []);

  function addUserAsApprover(user: ReturnType<typeof readUsers>[number]) {
    if (disabled) return;
    onAdd({ name: user.name, email: user.email, role: user.role, team: user.team, approvalChainTypes: [approvalChainType] });
    setQuery("");
  }

  return (
    <div className="inspector-section">
      <SectionTitle icon={<UserPlus size={16} />} title="Approval Roles" />
      <div className="approver-table-panel">
        <div className="approver-table-meta">
          <strong>Approver pool</strong>
          <span>{chainLabel} approvers</span>
        </div>
        <div className="approver-list" role="table" aria-label={`${chainLabel} approvers`}>
          {approvers.length ? (
            approvers.map((approver) => (
              <div className="approver-row" key={approver.id} role="row">
                <strong>{approver.name}</strong>
                <span>{approver.role}</span>
                <small>{approver.email}</small>
                <button type="button" aria-label={`Remove ${approver.name}`} title={`Remove ${approver.name}`} disabled={disabled} onClick={() => onDelete(approver.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          ) : (
            <p className="empty-panel-note">No approvers are available for this approval chain type.</p>
          )}
        </div>
        {disabled ? <p className="approval-permission-note">Only the approval-chain creator can add or remove approvers.</p> : null}
        {!disabled ? (
          <details className="approver-add-drawer">
            <summary>
              <span>
                <UserPlus size={13} />
                Add approver
              </span>
              <small>Search by name, role, team, or email.</small>
            </summary>
            <div className="approver-add-form">
              <label className="field">
                <span>Search users</span>
                <div className="search-input-shell">
                  <Search size={14} aria-hidden="true" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user" />
                  {query ? (
                    <button type="button" aria-label="Clear user search" onClick={() => setQuery("")}>
                      <X size={13} />
                    </button>
                  ) : null}
                </div>
              </label>
              <div className="approver-user-results" aria-label="Available users">
                {filteredUsers.length ? (
                  filteredUsers.map((user) => (
                    <button type="button" key={user.id} onClick={() => addUserAsApprover(user)}>
                      <span>
                        <strong>{user.name}</strong>
                        <small>{user.role} - {user.team}</small>
                      </span>
                      <em>
                        <UserPlus size={13} />
                        Add
                      </em>
                    </button>
                  ))
                ) : (
                  <p className="empty-panel-note">{query ? "No matching users are available to add." : "All matching users are already approvers."}</p>
                )}
              </div>
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function ApprovalPublishPanel({ workflow }: { workflow: Workflow }) {
  const [snapshots, setSnapshots] = useState<ApprovalChainSnapshotRow[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setSnapshots(listApprovalChainSnapshots(workflow.id));
  }, [workflow.id]);

  function publish() {
    const session = getAuthSession();
    const snapshot = publishApprovalChainSnapshot(workflow, session?.user);
    if (!snapshot) {
      setNotice("Only approval chains can be published.");
      return;
    }
    setSnapshots(listApprovalChainSnapshots(workflow.id));
    setNotice(`Published ${formatDateTime(snapshot.publishedAt)}. Editing remains enabled.`);
  }

  return (
    <div className="inspector-section">
      <SectionTitle icon={<CheckCircle2 size={16} />} title="Publish Approval Chain" />
      <div className="approval-publish-panel">
        <div className="approval-publish-meta">
          <strong>Published snapshots</strong>
          <span>{snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"} saved</span>
        </div>
        <button type="button" className="approval-publish-button" onClick={publish}>
          <CheckCircle2 size={14} />
          Publish snapshot
        </button>
        <small>{notice || "Publishing saves a frozen approval-chain snapshot. The current chain stays editable."}</small>
        {snapshots.length ? (
          <div className="approval-snapshot-list" aria-label="Published approval-chain snapshots">
            {snapshots.slice(0, 4).map((snapshot) => (
              <div className="approval-snapshot-row" key={snapshot.id}>
                <strong>{snapshot.version}</strong>
                <span>{formatDateTime(snapshot.publishedAt)}</span>
                <small>{snapshot.publishedByName ? `Published by ${snapshot.publishedByName}` : `${snapshot.nodeCount} squares, ${snapshot.edgeCount} edges`}</small>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NodeConnectionCreator({
  selectedNodeId,
  nodes,
  onCreate,
  showType = true,
  defaultType = "data",
  disabled = false
}: {
  selectedNodeId: string;
  nodes: Array<{ id: string; label: string }>;
  onCreate: (source: string, target: string, type?: EdgeKind, handles?: { sourceHandle?: string; targetHandle?: string }) => void;
  showType?: boolean;
  defaultType?: EdgeKind;
  disabled?: boolean;
}) {
  const targetOptions = nodes.filter((node) => node.id !== selectedNodeId);
  const [targetId, setTargetId] = useState(targetOptions[0]?.id ?? "");
  const [edgeType, setEdgeType] = useState<EdgeKind>(defaultType);
  const [sourceSide, setSourceSide] = useState("right");
  const [targetSide, setTargetSide] = useState("left");

  useEffect(() => {
    if (targetId && targetOptions.some((node) => node.id === targetId)) return;
    setTargetId(targetOptions[0]?.id ?? "");
  }, [targetId, targetOptions]);

  return (
    <details className="advanced-edge-builder inspector-section">
      <summary>
        <span>
          <GitPullRequestArrow size={15} />
          Advanced edge creation
        </span>
        <small>Default: drag a side dot from one square to another.</small>
      </summary>
      <div className="connection-builder">
        <SelectField label="Connect to" value={targetId} options={targetOptions.map((node) => node.id)} labels={Object.fromEntries(targetOptions.map((node) => [node.id, node.label]))} onChange={setTargetId} disabled={disabled} />
        {showType ? <SelectField label="Type" value={edgeType} options={["data", "control", "feedback", "approval", "dependency"]} onChange={(value) => setEdgeType(value as EdgeKind)} disabled={disabled} /> : null}
        <div className="connection-sides">
          <SelectField label="From side" value={sourceSide} options={["left", "right", "top", "bottom"]} onChange={setSourceSide} disabled={disabled} />
          <SelectField label="To side" value={targetSide} options={["left", "right", "top", "bottom"]} onChange={setTargetSide} disabled={disabled} />
        </div>
        <button
          className="connection-create-button"
          type="button"
          disabled={!targetId || disabled}
          onClick={() => {
            if (!targetId) return;
            onCreate(selectedNodeId, targetId, edgeType, {
              sourceHandle: sideToHandle(sourceSide, "source"),
              targetHandle: sideToHandle(targetSide, "target")
            });
          }}
        >
          Create edge
        </button>
      </div>
    </details>
  );
}

function getNodeDocuments(value: unknown): NodeDocumentAsset[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isNodeDocumentAsset);
}

function getWorkflowDocuments(workflow: Workflow): ReviewDocument[] {
  return dedupeReviewDocuments(workflow.reviewDocuments ?? []);
}

function dedupeReviewDocuments(documents: ReviewDocument[]) {
  return [...new Map(documents.map((document) => [document.id, document])).values()];
}

async function fileToReviewDocument(file: File, title: string, summary: string): Promise<ReviewDocument> {
  const url = await readFileAsDataUrl(file);
  const cleanTitle = title.trim() || stripFileExtension(file.name) || "Review document";
  return {
    id: `doc-${Date.now()}-${slugifyDocumentId(cleanTitle) || "upload"}`,
    title: cleanTitle,
    type: getDocumentType(file),
    url,
    summary: summary.trim() || undefined
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

function getDocumentType(file: File): ReviewDocument["type"] {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".doc") || name.endsWith(".docx") || file.type.includes("wordprocessingml") || file.type === "application/msword") return "doc";
  return "text";
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function slugifyDocumentId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isNodeDocumentAsset(value: unknown): value is NodeDocumentAsset {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<NodeDocumentAsset>;
  return (
    typeof document.id === "string" &&
    typeof document.title === "string" &&
    typeof document.url === "string" &&
    (document.type === "pdf" || document.type === "doc" || document.type === "text")
  );
}

function SectionTitle({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <h2 className="section-title">
      {icon}
      {title}
    </h2>
  );
}

function InspectorSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="inspector-section">
      <SectionTitle title={title} icon={icon} />
      <div className="inspector-section-body">{children}</div>
    </div>
  );
}

function TextField({ label, value, onChange, required, disabled = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; disabled?: boolean }) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? <em>required</em> : null}
      </span>
      <input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="field readonly-field">
      <span>{label}</span>
      <output>{value}</output>
    </div>
  );
}

function TextArea({ label, value, onChange, required, disabled = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; disabled?: boolean }) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? <em>required</em> : null}
      </span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} disabled={disabled} />
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  suffix,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field range-field">
      <span>
        {label}
        <small>
          {value}
          {suffix ?? ""}
        </small>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  required,
  labels,
  disabled = false
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
  labels?: Record<string, string>;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? <em>required</em> : null}
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option ? labels?.[option] ?? option.replaceAll("_", " ") : labels?.[""] ?? "None"}
          </option>
        ))}
      </select>
    </label>
  );
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatApprovalStatus(value: string) {
  if (!value) return "Pending";
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function normalizeHex(value: string) {
  return value.trim().toLowerCase();
}

function handleToSide(handle: string | undefined, kind: "source" | "target") {
  if (handle?.endsWith("-top")) return "top";
  if (handle?.endsWith("-right")) return "right";
  if (handle?.endsWith("-bottom")) return "bottom";
  if (handle?.endsWith("-left")) return "left";
  return kind === "source" ? "right" : "left";
}

function sideToHandle(side: string, kind: "source" | "target") {
  if (kind === "source") {
    if (side === "right") return "out";
    return `out-${side}`;
  }
  if (side === "left") return "in";
  return `in-${side}`;
}
