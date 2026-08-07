"use client";

import {
  APPROVAL_SQUARE_PRESETS,
  buildApprovalSquareConfiguration,
  getApprovalSquareGroups,
  getApprovalSquarePreset,
  type ApprovalSquareGroup,
  type ApprovalSquarePreset
} from "@/domain/approval-node-presets";
import { DEFAULT_APPROVERS, approverMatchesType } from "@/domain/approval-chain-types";
import { CATEGORY_COLORS, CATEGORY_LABELS, NODE_DEFINITIONS, getDefinitionsByCategory } from "@/domain/node-definitions";
import type { NodeCategory, NodeDefinition, NodeStatus } from "@/domain/types";
import { deleteCustomApprovalBlock, listCustomApprovalBlocks, saveCustomApprovalBlock, type CustomApprovalBlock } from "@/lib/custom-approval-blocks";
import { getAuthSession } from "@/lib/local-auth";
import { useWorkflowStore } from "@/store/use-workflow-store";
import { BadgeCheck, BookOpen, ChevronDown, Layers3, Plus, Save, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DynamicIcon } from "./icon";

const categoryOrder = Object.keys(CATEGORY_LABELS) as NodeCategory[];
const customApprovalTypes = [
  { definitionId: "approval", label: "Approval" },
  { definitionId: "human-review", label: "Review" },
  { definitionId: "approver-assignment", label: "Assignment" },
  { definitionId: "review-document", label: "Document" },
  { definitionId: "data-validation", label: "Check" },
  { definitionId: "escalation", label: "Escalation" },
  { definitionId: "notification", label: "Notification" },
  { definitionId: "report", label: "Audit Record" },
  { definitionId: "comment", label: "Note" }
] as const;
const approvalGroupOrder: ApprovalSquareGroup[] = ["Intake", "Review", "Approval", "Exception", "Notification", "Audit"];

export function NodeLibrary() {
  const workflow = useWorkflowStore((state) => state.workflow);
  const search = useWorkflowStore((state) => state.search);
  const setSearch = useWorkflowStore((state) => state.setSearch);
  const addNode = useWorkflowStore((state) => state.addNode);
  const addGroup = useWorkflowStore((state) => state.addGroup);
  const libraryCollapsed = useWorkflowStore((state) => state.libraryCollapsed);
  const [collapsed, setCollapsed] = useState<Set<NodeCategory>>(new Set());
  const definitionsByCategory = useMemo(getDefinitionsByCategory, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return NODE_DEFINITIONS;
    return NODE_DEFINITIONS.filter((definition) =>
      [definition.name, definition.description, CATEGORY_LABELS[definition.category], ...(definition.keywords ?? [])].join(" ").toLowerCase().includes(query)
    );
  }, [search]);

  if (libraryCollapsed) {
    return <aside className="node-library compact" aria-label="Node library" />;
  }

  if (workflow.flowKind === "approval_chain") {
    const currentUserName = getAuthSession()?.user.name || workflow.owner || "System";
    return (
      <ApprovalChainLibrary
        search={search}
        setSearch={setSearch}
        addGroup={addGroup}
        addPreset={(preset, position) =>
          addNode(preset.definitionId, position, {
            label: preset.label,
            description: preset.description,
            status: preset.status,
            configuration: {
              ...preset.configuration,
              ...buildApprovalSquareConfiguration({
                label: preset.label,
                description: preset.description,
                creator: currentUserName,
                approvalType: String(preset.configuration.approvalType ?? preset.label),
                status: String(preset.configuration.approvalStatus ?? preset.configuration.status ?? "not_reviewed"),
                instructions: String(preset.configuration.instructions ?? preset.configuration.reviewCriteria ?? preset.configuration.approvalCriteria ?? preset.description),
                documents: Array.isArray(preset.configuration.documents) ? preset.configuration.documents : [],
                actor: currentUserName
              })
            }
          })
        }
        addCustom={(definitionId, input) =>
          addNode(definitionId, { x: 220, y: 220 }, {
            label: input.label,
            description: input.description,
            status: "not_started",
            configuration: buildApprovalSquareConfiguration({
              ...input,
              creator: currentUserName,
              actor: currentUserName
            })
          })
        }
        approvalChainType={workflow.approvalChainType}
      />
    );
  }

  return (
    <aside className="node-library" aria-label="Node library">
      <header>
        <strong>Node Library</strong>
        <span>{NODE_DEFINITIONS.length} nodes</span>
      </header>
      <label className="search-box">
        <Search size={15} />
        <input id="node-library-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search nodes" />
      </label>
      <details className="workflow-guide">
        <summary>
          <BookOpen size={14} />
          How to use
        </summary>
        <ol>
          <li>Add stage rectangles first to group a flow phase.</li>
          <li>Drag nodes from this library onto the canvas, or click a node to add it.</li>
          <li>Hover a node to reveal side dots, then drag from a dot to another node to create an edge.</li>
          <li>Select a node, edge, or stage to edit it in the right panel.</li>
          <li>Use Export PDF or Export JSON from the top toolbar when the flow is ready.</li>
        </ol>
      </details>
      <section className="library-section">
        <h2>Canvas Structure</h2>
        <button className="stage-add-card" type="button" onClick={addGroup}>
          <span className="library-icon">
            <Layers3 size={16} />
          </span>
          <span>
            <strong>Stage rectangle</strong>
            <small>Add a large rectangle behind nodes to group a flow phase.</small>
          </span>
        </button>
      </section>
      {!search && (
        <section className="library-section">
          <h2>Frequently Used</h2>
          <div className="library-list">
            {NODE_DEFINITIONS.filter((definition) => definition.frequentlyUsed).map((definition) => (
              <LibraryItem key={definition.id} definition={definition} onAdd={() => addNode(definition.id)} />
            ))}
          </div>
        </section>
      )}
      {search ? (
        <section className="library-section">
          <h2>Results</h2>
          <div className="library-list">
            {filtered.map((definition) => (
              <LibraryItem key={definition.id} definition={definition} onAdd={() => addNode(definition.id)} />
            ))}
          </div>
        </section>
      ) : (
        categoryOrder.map((category) => {
          const isCollapsed = collapsed.has(category);
          const definitions = definitionsByCategory[category] ?? [];
          return (
            <section className="library-section" key={category}>
              <button
                className="category-heading"
                type="button"
                onClick={() =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(category)) next.delete(category);
                    else next.add(category);
                    return next;
                  })
                }
              >
                <span style={{ "--category-color": CATEGORY_COLORS[category] } as React.CSSProperties} />
                <h2>{CATEGORY_LABELS[category]}</h2>
                <ChevronDown size={14} className={isCollapsed ? "rotated" : ""} />
              </button>
              {!isCollapsed && (
                <div className="library-list">
                  {definitions.map((definition) => (
                    <LibraryItem key={definition.id} definition={definition} onAdd={() => addNode(definition.id)} />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </aside>
  );
}

function ApprovalChainLibrary({
  search,
  setSearch,
  addGroup,
  addPreset,
  addCustom,
  approvalChainType
}: {
  search: string;
  setSearch: (value: string) => void;
  addGroup: () => void;
  addPreset: (preset: ApprovalSquarePreset, position?: { x: number; y: number }) => void;
  addCustom: (
    definitionId: string,
    input: {
      label: string;
      description: string;
      approver: string;
      approvalType: string;
      status: string;
      dueDate: string;
      instructions: string;
      documents: unknown[];
    }
  ) => void;
  approvalChainType?: Parameters<typeof approverMatchesType>[1];
}) {
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customApprover, setCustomApprover] = useState("");
  const [customStatus, setCustomStatus] = useState("not_reviewed");
  const [customDueDate, setCustomDueDate] = useState("");
  const [customDocumentTitle, setCustomDocumentTitle] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [customType, setCustomType] = useState<(typeof customApprovalTypes)[number]["definitionId"]>("approval");
  const [customBlocks, setCustomBlocks] = useState<CustomApprovalBlock[]>([]);
  const [customNotice, setCustomNotice] = useState("");
  const groupedPresets = useMemo(getApprovalSquareGroups, []);
  const approvers = useMemo(() => DEFAULT_APPROVERS.filter((approver) => approverMatchesType(approver, approvalChainType)), [approvalChainType]);
  const filteredPresets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return APPROVAL_SQUARE_PRESETS;
    return APPROVAL_SQUARE_PRESETS.filter((preset) =>
      [preset.label, preset.description, preset.definitionId, preset.group].join(" ").toLowerCase().includes(query)
    );
  }, [search]);
  const filteredCustomBlocks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customBlocks;
    return customBlocks.filter((block) =>
      [block.label, block.description, block.definitionId, block.group].join(" ").toLowerCase().includes(query)
    );
  }, [customBlocks, search]);

  useEffect(() => {
    setCustomBlocks(listCustomApprovalBlocks());
  }, []);

  function getCustomBlockInput(): Omit<ApprovalSquarePreset, "id"> {
    const label = customName.trim() || "Custom Approval Square";
    const description = customDescription.trim() || "Custom approval-chain square.";
    const documentTitle = customDocumentTitle.trim();
    const typeLabel = customApprovalTypes.find((type) => type.definitionId === customType)?.label ?? label;
    return {
      group: typeLabel === "Approval" ? ("Approval" as const) : typeLabel === "Escalation" ? ("Exception" as const) : typeLabel === "Notification" ? ("Notification" as const) : typeLabel === "Audit Record" ? ("Audit" as const) : ("Review" as const),
      label,
      description,
      definitionId: customType,
      status: statusToNodeStatus(customStatus),
      configuration: {
        approvalType: typeLabel,
        approver: customApprover,
        status: customStatus,
        dueDate: customDueDate,
        instructions: customInstructions.trim() || description,
        documents: documentTitle
          ? [
              {
                id: `custom-doc-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
                title: documentTitle,
                type: "text",
                url: "#",
                summary: "Placeholder document required for this custom approval square."
              }
            ]
          : []
      }
    };
  }

  function createCustomSquare() {
    const block = getCustomBlockInput();
    addCustom(block.definitionId, {
      label: block.label,
      description: block.description,
      approver: String(block.configuration.approver ?? ""),
      approvalType: String(block.configuration.approvalType ?? block.label),
      status: String(block.configuration.status ?? "not_reviewed"),
      dueDate: String(block.configuration.dueDate ?? ""),
      instructions: String(block.configuration.instructions ?? block.description),
      documents: Array.isArray(block.configuration.documents) ? block.configuration.documents : []
    });
    resetCustomForm();
  }

  function saveCustomBlock() {
    const block = saveCustomApprovalBlock(getCustomBlockInput());
    setCustomBlocks(listCustomApprovalBlocks());
    setCustomNotice(`Saved ${block.label}`);
  }

  function addSavedBlock(block: ApprovalSquarePreset) {
    addCustom(block.definitionId, {
      label: block.label,
      description: block.description,
      approver: String(block.configuration.approver ?? ""),
      approvalType: String(block.configuration.approvalType ?? block.label),
      status: String(block.configuration.status ?? "not_reviewed"),
      dueDate: String(block.configuration.dueDate ?? ""),
      instructions: String(block.configuration.instructions ?? block.description),
      documents: Array.isArray(block.configuration.documents) ? block.configuration.documents : []
    });
  }

  function removeSavedBlock(id: string) {
    deleteCustomApprovalBlock(id);
    setCustomBlocks(listCustomApprovalBlocks());
  }

  function resetCustomForm() {
    setCustomName("");
    setCustomDescription("");
    setCustomApprover("");
    setCustomStatus("not_reviewed");
    setCustomDueDate("");
    setCustomDocumentTitle("");
    setCustomInstructions("");
    setCustomNotice("");
  }

  function statusToNodeStatus(status: string): NodeStatus {
    if (status === "approved") return "ready";
    if (status === "in_review") return "in_progress";
    if (status === "rejected") return "blocked";
    return "not_started";
  }

  return (
    <aside className="node-library approval-library" aria-label="Approval square library">
      <header>
        <strong>Approval Squares</strong>
        <span>{APPROVAL_SQUARE_PRESETS.length + customBlocks.length} blocks</span>
      </header>
      <label className="search-box">
        <Search size={15} />
        <input id="node-library-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search approval squares" />
      </label>
      <details className="workflow-guide">
        <summary>
          <BookOpen size={14} />
          How to use
        </summary>
        <ol>
          <li>Add stage rectangles to group approval phases.</li>
          <li>Drag a premade approval square onto the canvas, or click it to add one.</li>
          <li>Create custom blocks for team-specific approvals, checks, notices, or audit records.</li>
          <li>Save a custom block to reuse it in future approval chains.</li>
          <li>Select a square to edit creator, approver, description, status, and documents.</li>
        </ol>
      </details>
      <section className="library-section">
        <h2>Canvas Structure</h2>
        <button className="stage-add-card" type="button" onClick={addGroup}>
          <span className="library-icon">
            <Layers3 size={16} />
          </span>
          <span>
            <strong>Stage rectangle</strong>
            <small>Add a large rectangle behind approval squares.</small>
          </span>
        </button>
      </section>
      <section className="library-section">
        <h2>Custom Square</h2>
        <div className="custom-square-form">
          <label>
            <span>Name</span>
            <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Risk Committee Approval" />
          </label>
          <label>
            <span>Type</span>
            <select value={customType} onChange={(event) => setCustomType(event.target.value as typeof customType)}>
              {customApprovalTypes.map((type) => (
                <option key={type.definitionId} value={type.definitionId}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Approver</span>
            <select value={customApprover} onChange={(event) => setCustomApprover(event.target.value)}>
              <option value="">Unassigned</option>
              {approvers.map((approver) => (
                <option key={approver.id} value={approver.name}>
                  {approver.name} - {approver.role}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={customStatus} onChange={(event) => setCustomStatus(event.target.value)}>
              <option value="not_reviewed">Not reviewed</option>
              <option value="in_review">In review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label>
            <span>Due date</span>
            <input value={customDueDate} onChange={(event) => setCustomDueDate(event.target.value)} placeholder="2026-08-15" />
          </label>
          <label>
            <span>Required document</span>
            <input value={customDocumentTitle} onChange={(event) => setCustomDocumentTitle(event.target.value)} placeholder="Risk memo or SOP" />
          </label>
          <label>
            <span>Description</span>
            <textarea value={customDescription} onChange={(event) => setCustomDescription(event.target.value)} rows={3} placeholder="What should happen in this square?" />
          </label>
          <label>
            <span>Instructions</span>
            <textarea value={customInstructions} onChange={(event) => setCustomInstructions(event.target.value)} rows={3} placeholder="What should the approver check?" />
          </label>
          <div className="custom-square-actions">
            <button type="button" onClick={createCustomSquare}>
              <Plus size={14} />
              Add once
            </button>
            <button type="button" onClick={saveCustomBlock}>
              <Save size={14} />
              Save block
            </button>
          </div>
          {customNotice ? <small className="custom-square-notice">{customNotice}</small> : null}
        </div>
      </section>
      {!search && customBlocks.length ? (
        <section className="library-section">
          <h2>Custom Blocks</h2>
          <div className="library-list">
            {customBlocks.map((block) => (
              <ApprovalPresetItem key={block.id} preset={block} onAdd={() => addSavedBlock(block)} onDelete={() => removeSavedBlock(block.id)} custom />
            ))}
          </div>
        </section>
      ) : null}
      {search ? (
        <section className="library-section">
          <h2>Results</h2>
          <div className="library-list">
            {filteredCustomBlocks.map((block) => (
              <ApprovalPresetItem key={block.id} preset={block} onAdd={() => addSavedBlock(block)} onDelete={() => removeSavedBlock(block.id)} custom />
            ))}
            {filteredPresets.map((preset) => (
              <ApprovalPresetItem key={preset.id} preset={preset} onAdd={() => addPreset(preset)} />
            ))}
            {!filteredCustomBlocks.length && !filteredPresets.length ? <p className="library-empty-note">No approval blocks match this search.</p> : null}
          </div>
        </section>
      ) : (
        approvalGroupOrder.map((group) => (
          <section className="library-section" key={group}>
            <h2>{group}</h2>
            <div className="library-list">
              {groupedPresets[group].map((preset) => (
                <ApprovalPresetItem key={preset.id} preset={preset} onAdd={() => addPreset(preset)} />
              ))}
            </div>
          </section>
        ))
      )}
    </aside>
  );
}

function ApprovalPresetItem({ preset, onAdd, onDelete, custom = false }: { preset: ApprovalSquarePreset; onAdd: () => void; onDelete?: () => void; custom?: boolean }) {
  return (
    <div className={`approval-block-shell ${custom ? "custom" : ""}`}>
      <button
        className="library-item approval-preset-item"
        type="button"
        draggable
        onDragStart={(event) => {
          if (custom) event.dataTransfer.setData("application/workflow-approval-custom-block", JSON.stringify(preset));
          else event.dataTransfer.setData("application/workflow-approval-preset", preset.id);
          event.dataTransfer.effectAllowed = "copy";
        }}
        onClick={onAdd}
        style={{ "--category-color": CATEGORY_COLORS.human_review } as React.CSSProperties}
      >
        <span className="library-icon">
          <BadgeCheck size={15} />
        </span>
        <span>
          <strong>{preset.label}</strong>
          <small>{custom ? `Custom block - ${preset.description}` : preset.description}</small>
        </span>
      </button>
      {onDelete ? (
        <button
          className="approval-block-delete"
          type="button"
          aria-label={`Delete ${preset.label}`}
          title={`Delete ${preset.label}`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 size={13} />
        </button>
      ) : null}
    </div>
  );
}

function LibraryItem({ definition, onAdd }: { definition: NodeDefinition; onAdd: () => void }) {
  return (
    <button
      className="library-item"
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/workflow-node", definition.id);
        event.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onAdd}
      style={{ "--category-color": CATEGORY_COLORS[definition.category] } as React.CSSProperties}
    >
      <span className="library-icon">
        <DynamicIcon name={definition.icon} />
      </span>
      <span>
        <strong>{definition.name}</strong>
        <small>
          {CATEGORY_LABELS[definition.category]} · {definition.description}
        </small>
      </span>
    </button>
  );
}
