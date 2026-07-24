"use client";

import { APPROVAL_CHAIN_TYPE_OPTIONS, approverMatchesType, getApprovalChainTypeLabel } from "@/domain/approval-chain-types";
import { CATEGORY_LABELS, getNodeDefinition } from "@/domain/node-definitions";
import { getProviderOption, getProviderOptionsForNode, normalizeProviderIdForNode } from "@/domain/providers";
import { STAGE_COLOR_OPTIONS, getDefaultStageColor } from "@/domain/workflow-factory";
import type { ApprovalChainType, Approver, EdgeKind, NodeFieldDefinition, WorkflowStatus } from "@/domain/types";
import { APPROVER_TABLE_NAME, APPROVER_TABLE_SQL, insertApprover, listApprovers } from "@/lib/litesql-approver-table";
import { useWorkflowStore } from "@/store/use-workflow-store";
import { WorkflowChat } from "./workflow-chat";
import { DynamicIcon } from "./icon";
import { AlertTriangle, Bot, ClipboardList, Database, FileText, GitPullRequestArrow, Layers3, Settings2, UserPlus } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type NodeDocumentAsset = {
  id: string;
  title: string;
  type: "pdf" | "doc" | "text";
  url: string;
  summary?: string;
};

export function Inspector() {
  const workflow = useWorkflowStore((state) => state.workflow);
  const selectedItem = useWorkflowStore((state) => state.selectedItem);
  const inspectorCollapsed = useWorkflowStore((state) => state.inspectorCollapsed);
  const updateWorkflowMeta = useWorkflowStore((state) => state.updateWorkflowMeta);
  const updateNode = useWorkflowStore((state) => state.updateNode);
  const updateNodeConfiguration = useWorkflowStore((state) => state.updateNodeConfiguration);
  const addEdge = useWorkflowStore((state) => state.addEdge);
  const updateEdge = useWorkflowStore((state) => state.updateEdge);
  const updateGroup = useWorkflowStore((state) => state.updateGroup);
  const deleteSelected = useWorkflowStore((state) => state.deleteSelected);
  const duplicateSelected = useWorkflowStore((state) => state.duplicateSelected);
  const moveSelectedGroupLayer = useWorkflowStore((state) => state.moveSelectedGroupLayer);
  const [activePanel, setActivePanel] = useState<"parameters" | "agent">("parameters");
  const [approvers, setApprovers] = useState<Approver[]>([]);

  const node = selectedItem.type === "node" ? workflow.nodes.find((item) => item.id === selectedItem.id) : null;
  const edge = selectedItem.type === "edge" ? workflow.edges.find((item) => item.id === selectedItem.id) : null;
  const group = selectedItem.type === "group" ? workflow.groups.find((item) => item.id === selectedItem.id) : null;
  const nodeDocuments = useMemo(() => getNodeDocuments(node?.data.configuration.documents), [node?.data.configuration.documents]);
  const chainApprovers = useMemo(
    () => approvers.filter((approver) => approverMatchesType(approver, workflow.approvalChainType)),
    [approvers, workflow.approvalChainType]
  );

  useEffect(() => {
    setApprovers(listApprovers());
  }, []);

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
      kicker: "Workflow",
      title: workflow.name,
      subtitle: `${workflow.nodes.length} nodes, ${workflow.edges.length} edges`
    };
  }, [edge, group, node, workflow.edges.length, workflow.name, workflow.nodes.length]);

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
          {selectedItem.type === "workflow" && (
        <section className="form-stack">
          <SectionTitle icon={<Settings2 size={16} />} title="Workflow Properties" />
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
          {workflow.reviewDocuments?.length ? (
            <>
              <SectionTitle icon={<FileText size={16} />} title="Review Documents" />
              <div className="review-document-list">
                {workflow.reviewDocuments.map((document) => (
                  <a href={document.url} key={document.id} target="_blank" rel="noreferrer">
                    <strong>{document.title}</strong>
                    <span>{document.owner ? `${document.owner} · ${document.type.toUpperCase()}` : document.type.toUpperCase()}</span>
                  </a>
                ))}
              </div>
            </>
          ) : null}
          {workflow.flowKind === "approval_chain" ? (
            <ApproverTable
              approvalChainType={workflow.approvalChainType ?? "underwriting"}
              approvers={chainApprovers}
              onAdd={(input) => {
                insertApprover(input);
                setApprovers(listApprovers());
              }}
            />
          ) : null}
          <div className="inspector-summary">
            <span>{workflow.nodes.length} nodes</span>
            <span>{workflow.edges.length} edges</span>
            <span>{workflow.groups.length} stages</span>
          </div>
        </section>
          )}

          {node && (
        <section className="form-stack">
          <SectionTitle icon={<ClipboardList size={16} />} title="Node Properties" />
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

          <SectionTitle icon={<Settings2 size={16} />} title="Governance" />
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

          <SectionTitle icon={<Settings2 size={16} />} title={`${CATEGORY_LABELS[node.data.category]} Configuration`} />
          {(getNodeDefinition(node.definitionId)?.fields ?? [])
            .filter((field) => !["owner", "technology", "status", "tags", "documentationUrl", "notes"].includes(field.key))
            .map((field) => (
              <NodeConfigField
                key={field.key}
                field={field}
                definitionId={node.definitionId}
                approvers={workflow.flowKind === "approval_chain" ? chainApprovers : []}
                value={String(node.data.configuration[field.key] ?? "")}
                onChange={(value) => updateNodeConfiguration(node.id, field.key, value)}
              />
            ))}
          {nodeDocuments.length ? <NodeDocumentViewer documents={nodeDocuments} /> : null}
          <NodeConnectionCreator selectedNodeId={node.id} nodes={workflow.nodes.map((item) => ({ id: item.id, label: item.data.label }))} onCreate={addEdge} />
          <div className="inspector-actions">
            <button type="button" onClick={duplicateSelected}>
              Duplicate
            </button>
            <button type="button" className="danger" onClick={deleteSelected}>
              Delete
            </button>
          </div>
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

function NodeDocumentViewer({ documents }: { documents: NodeDocumentAsset[] }) {
  const [selectedId, setSelectedId] = useState(documents[0]?.id ?? "");
  const selected = documents.find((document) => document.id === selectedId) ?? documents[0];

  useEffect(() => {
    if (!documents.some((document) => document.id === selectedId)) setSelectedId(documents[0]?.id ?? "");
  }, [documents, selectedId]);

  if (!selected) return null;

  return (
    <>
      <SectionTitle icon={<FileText size={16} />} title="Document Viewer" />
      <div className="node-document-viewer">
        <div className="node-document-tabs" role="tablist" aria-label="Node documents">
          {documents.map((document) => (
            <button
              key={document.id}
              type="button"
              className={document.id === selected.id ? "active" : ""}
              onClick={() => setSelectedId(document.id)}
            >
              <span>{document.type.toUpperCase()}</span>
              {document.title}
            </button>
          ))}
        </div>
        <div className="node-document-frame">
          <div className="node-document-meta">
            <strong>{selected.title}</strong>
            <a href={selected.url} target="_blank" rel="noreferrer">
              Open
            </a>
          </div>
          {selected.summary ? <p>{selected.summary}</p> : null}
          {selected.type === "pdf" ? (
            <iframe src={selected.url} title={selected.title} />
          ) : (
            <a className="node-document-download" href={selected.url} target="_blank" rel="noreferrer">
              <FileText size={16} />
              {selected.title}
            </a>
          )}
        </div>
      </div>
    </>
  );
}

function ApproverTable({
  approvers,
  approvalChainType,
  onAdd
}: {
  approvers: Approver[];
  approvalChainType: ApprovalChainType;
  onAdd: (input: Omit<Approver, "id">) => void;
}) {
  const [draft, setDraft] = useState({ name: "", email: "", role: "", team: "" });
  const chainLabel = getApprovalChainTypeLabel(approvalChainType);

  function updateDraft(key: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addApprover() {
    const name = draft.name.trim();
    const email = draft.email.trim();
    const role = draft.role.trim();
    const team = draft.team.trim();
    if (!name || !email || !role || !team) return;
    onAdd({ name, email, role, team, approvalChainTypes: [approvalChainType] });
    setDraft({ name: "", email: "", role: "", team: "" });
  }

  return (
    <>
      <SectionTitle icon={<Database size={16} />} title="Approver LiteSQL Table" />
      <div className="approver-table-panel">
        <div className="approver-table-meta">
          <strong>{APPROVER_TABLE_NAME}</strong>
          <span>{chainLabel} approvers</span>
        </div>
        <div className="approver-list" role="table" aria-label={`${chainLabel} approvers`}>
          {approvers.map((approver) => (
            <div className="approver-row" key={approver.id} role="row">
              <strong>{approver.name}</strong>
              <span>{approver.role}</span>
              <small>{approver.email}</small>
            </div>
          ))}
        </div>
        <div className="approver-add-form">
          <TextField label="Name" value={draft.name} onChange={(value) => updateDraft("name", value)} />
          <TextField label="Email" value={draft.email} onChange={(value) => updateDraft("email", value)} />
          <TextField label="Role" value={draft.role} onChange={(value) => updateDraft("role", value)} />
          <TextField label="Team" value={draft.team} onChange={(value) => updateDraft("team", value)} />
          <button className="approver-add-button" type="button" onClick={addApprover}>
            <UserPlus size={14} />
            Add approver
          </button>
        </div>
        <details className="approver-sql">
          <summary>Table schema</summary>
          <code>{APPROVER_TABLE_SQL}</code>
        </details>
      </div>
    </>
  );
}

function NodeConnectionCreator({
  selectedNodeId,
  nodes,
  onCreate
}: {
  selectedNodeId: string;
  nodes: Array<{ id: string; label: string }>;
  onCreate: (source: string, target: string, type?: EdgeKind, handles?: { sourceHandle?: string; targetHandle?: string }) => void;
}) {
  const targetOptions = nodes.filter((node) => node.id !== selectedNodeId);
  const [targetId, setTargetId] = useState(targetOptions[0]?.id ?? "");
  const [edgeType, setEdgeType] = useState<EdgeKind>("data");
  const [sourceSide, setSourceSide] = useState("right");
  const [targetSide, setTargetSide] = useState("left");

  useEffect(() => {
    if (targetId && targetOptions.some((node) => node.id === targetId)) return;
    setTargetId(targetOptions[0]?.id ?? "");
  }, [targetId, targetOptions]);

  return (
    <>
      <SectionTitle icon={<GitPullRequestArrow size={16} />} title="Create Edge" />
      <div className="connection-builder">
        <SelectField label="Connect to" value={targetId} options={targetOptions.map((node) => node.id)} labels={Object.fromEntries(targetOptions.map((node) => [node.id, node.label]))} onChange={setTargetId} />
        <SelectField label="Type" value={edgeType} options={["data", "control", "feedback", "approval", "dependency"]} onChange={(value) => setEdgeType(value as EdgeKind)} />
        <div className="connection-sides">
          <SelectField label="From side" value={sourceSide} options={["left", "right", "top", "bottom"]} onChange={setSourceSide} />
          <SelectField label="To side" value={targetSide} options={["left", "right", "top", "bottom"]} onChange={setTargetSide} />
        </div>
        <button
          className="connection-create-button"
          type="button"
          disabled={!targetId}
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
    </>
  );
}

function getNodeDocuments(value: unknown): NodeDocumentAsset[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isNodeDocumentAsset);
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

function TextField({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? <em>required</em> : null}
      </span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
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

function TextArea({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? <em>required</em> : null}
      </span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} />
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
  labels
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
  labels?: Record<string, string>;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? <em>required</em> : null}
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
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
