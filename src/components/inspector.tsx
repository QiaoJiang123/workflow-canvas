"use client";

import { CATEGORY_LABELS, getNodeDefinition } from "@/domain/node-definitions";
import { getProviderOption, getProviderOptionsForNode } from "@/domain/providers";
import type { EdgeKind, NodeFieldDefinition, WorkflowStatus } from "@/domain/types";
import { useWorkflowStore } from "@/store/use-workflow-store";
import { WorkflowChat } from "./workflow-chat";
import { DynamicIcon } from "./icon";
import { Bot, ClipboardList, GitPullRequestArrow, Layers3, Settings2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

export function Inspector() {
  const workflow = useWorkflowStore((state) => state.workflow);
  const selectedItem = useWorkflowStore((state) => state.selectedItem);
  const inspectorCollapsed = useWorkflowStore((state) => state.inspectorCollapsed);
  const updateWorkflowMeta = useWorkflowStore((state) => state.updateWorkflowMeta);
  const updateNode = useWorkflowStore((state) => state.updateNode);
  const updateNodeConfiguration = useWorkflowStore((state) => state.updateNodeConfiguration);
  const updateEdge = useWorkflowStore((state) => state.updateEdge);
  const updateGroup = useWorkflowStore((state) => state.updateGroup);
  const deleteSelected = useWorkflowStore((state) => state.deleteSelected);
  const duplicateSelected = useWorkflowStore((state) => state.duplicateSelected);
  const moveSelectedGroupLayer = useWorkflowStore((state) => state.moveSelectedGroupLayer);
  const [activePanel, setActivePanel] = useState<"parameters" | "agent">("parameters");

  const node = selectedItem.type === "node" ? workflow.nodes.find((item) => item.id === selectedItem.id) : null;
  const edge = selectedItem.type === "edge" ? workflow.edges.find((item) => item.id === selectedItem.id) : null;
  const group = selectedItem.type === "group" ? workflow.groups.find((item) => item.id === selectedItem.id) : null;
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
                value={String(node.data.configuration[field.key] ?? "")}
                onChange={(value) => updateNodeConfiguration(node.id, field.key, value)}
              />
            ))}
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
          <ReadOnlyField label="Source port" value={edge.sourceHandle || "out"} />
          <ReadOnlyField label="Target port" value={edge.targetHandle || "in"} />
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
          <TextField label="Tint" value={group.color} onChange={(value) => updateGroup(group.id, { color: value })} />
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

function NodeConfigField({
  field,
  value,
  onChange,
  definitionId
}: {
  field: NodeFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  definitionId?: string;
}) {
  if (field.type === "textarea") return <TextArea label={field.label} value={value} onChange={onChange} required={field.required} />;
  if (field.key === "providerId" && definitionId) {
    const providerOptions = getProviderOptionsForNode(definitionId);
    const selectedProvider = getProviderOption(value);
    return (
      <div className="provider-field">
        <SelectField
          label={field.label}
          value={value}
          options={["", ...providerOptions.map((provider) => provider.id)]}
          labels={Object.fromEntries(providerOptions.map((provider) => [provider.id, provider.name]))}
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
  if (field.type === "select") return <SelectField label={field.label} value={value} options={field.options ?? []} onChange={onChange} required={field.required} />;
  return <TextField label={field.label} value={value} onChange={onChange} required={field.required} />;
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
            {option ? labels?.[option] ?? option.replaceAll("_", " ") : "None"}
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
