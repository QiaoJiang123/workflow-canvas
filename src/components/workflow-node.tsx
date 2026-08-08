"use client";

import { CATEGORY_COLORS, CATEGORY_LABELS, getNodeDefinition } from "@/domain/node-definitions";
import { PROVIDER_ICON_LIBRARY, getProviderOption, normalizeProviderIdForNode } from "@/domain/providers";
import { downloadNodeLlmExport } from "@/lib/node-llm-export";
import { useWorkflowStore } from "@/store/use-workflow-store";
import { DynamicIcon } from "./icon";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Bolt, Download, MoreVertical } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

interface WorkflowNodeData {
  id: string;
  label: string;
  definitionId: string;
  flowKind?: string;
  category: keyof typeof CATEGORY_LABELS;
  description?: string;
  owner?: string;
  workflowOwner?: string;
  technology?: string;
  providerId?: string;
  status?: string;
  configuration?: Record<string, unknown>;
  invalid?: boolean;
  connectionTargetSide?: "left" | "right" | "top" | "bottom";
  isConnectionSource?: boolean;
}

export function WorkflowNodeComponent({ data, selected }: NodeProps) {
  const node = data as unknown as WorkflowNodeData;
  const definition = getNodeDefinition(node.definitionId);
  const color = CATEGORY_COLORS[node.category];
  const select = useWorkflowStore((state) => state.select);
  const workflow = useWorkflowStore((state) => state.workflow);
  const isTrigger = !definition?.inputs.length;
  const provider = getProviderOption(normalizeProviderIdForNode(node.definitionId, node.providerId));
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [iconsOpen, setIconsOpen] = useState(false);
  const isApprovalChainNode = node.flowKind === "approval_chain";
  const inputs = isApprovalChainNode ? [{ id: "in", label: "Input" }] : definition?.inputs ?? [];
  const outputs = isApprovalChainNode ? [{ id: "out", label: "Output" }] : definition?.outputs ?? [];
  const approvalStatus = isApprovalChainNode ? normalizeApprovalNodeStatus(node.configuration, node.status) : "";

  return (
    <article
      className={`workflow-node ${isApprovalChainNode ? "approval-chain-node" : ""} ${approvalStatus ? `approval-status-${approvalStatus}` : ""} ${selected ? "is-selected" : ""} ${isHovered ? "is-hovered" : ""} ${node.invalid ? "is-invalid" : ""} ${node.isConnectionSource ? "is-connection-source" : ""} ${node.connectionTargetSide ? `is-connection-target target-${node.connectionTargetSide}` : ""}`}
      style={{ "--node-accent": color } as React.CSSProperties}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setMenuOpen(false);
        setIconsOpen(false);
      }}
      onDoubleClick={() => select({ type: "node", id: node.id })}
    >
      {inputs.map((input) => (
        <Handle key={input.id} id={input.id} type="target" position={Position.Left} className="node-handle node-handle-left" />
      ))}
      {inputs.map((input) => (
        <Handle key={`${input.id}-right`} id={`${input.id}-right`} type="target" position={Position.Right} className="node-handle node-handle-right" />
      ))}
      {inputs.map((input) => (
        <Handle key={`${input.id}-top`} id={`${input.id}-top`} type="target" position={Position.Top} className="node-handle node-handle-top" />
      ))}
      {inputs.map((input) => (
        <Handle key={`${input.id}-bottom`} id={`${input.id}-bottom`} type="target" position={Position.Bottom} className="node-handle node-handle-bottom" />
      ))}
      {isTrigger && (
        <span className="node-trigger" aria-label="Trigger node" title="Trigger node">
          <Bolt size={13} />
        </span>
      )}
      <div className="node-tile">
        {isApprovalChainNode ? (
          <strong className="approval-node-name" title={node.label}>{node.label}</strong>
        ) : (
          <>
            <span className="node-operation" title={node.technology || CATEGORY_LABELS[node.category]}>
              {formatOperation(node.technology || CATEGORY_LABELS[node.category])}
            </span>
            <span className="node-icon" aria-hidden="true">
              {provider ? <Image src={provider.icon} alt="" width={28} height={28} /> : <DynamicIcon name={definition?.icon ?? "Circle"} />}
            </span>
            {provider && <span className="node-provider-badge">{provider.name}</span>}
          </>
        )}
        <div className="node-menu-shell">
          <button
            className="node-menu"
            type="button"
            aria-label="Node actions"
            aria-expanded={menuOpen}
            title="Node actions"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((current) => !current);
              setIconsOpen(false);
            }}
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div className="node-action-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={(event) => {
                  event.stopPropagation();
                  downloadNodeLlmExport(workflow, node.id);
                  setMenuOpen(false);
                  setIconsOpen(false);
                }}
              >
                <Download size={13} />
                Download
              </button>
              {!isApprovalChainNode ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIconsOpen((current) => !current);
                  }}
                >
                  Icon
                </button>
              ) : null}
            </div>
          )}
          {iconsOpen && !isApprovalChainNode && (
            <div className="node-icon-library" aria-label="Provider icon library">
              {PROVIDER_ICON_LIBRARY.map((providerOption) => (
                <span key={providerOption.id} className="provider-icon-swatch" title={providerOption.name}>
                  <Image src={providerOption.icon} alt="" width={18} height={18} />
                  <small>{providerOption.name}</small>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {!isApprovalChainNode ? (
        <div className="node-caption">
          <strong title={node.label}>{node.label}</strong>
          <span className={`node-status ${node.status ?? "not_started"}`} title={`Status: ${formatStatus(node.status)}`} />
        </div>
      ) : null}
      {outputs.map((output) => (
        <Handle key={`${output.id}-left`} id={`${output.id}-left`} type="source" position={Position.Left} className="node-handle node-handle-left" />
      ))}
      {outputs.map((output) => (
        <Handle key={output.id} id={output.id} type="source" position={Position.Right} className="node-handle node-handle-right" />
      ))}
      {outputs.map((output) => (
        <Handle key={`${output.id}-top`} id={`${output.id}-top`} type="source" position={Position.Top} className="node-handle node-handle-top" />
      ))}
      {outputs.map((output) => (
        <Handle key={`${output.id}-bottom`} id={`${output.id}-bottom`} type="source" position={Position.Bottom} className="node-handle node-handle-bottom" />
      ))}
    </article>
  );
}

function formatOperation(value: string) {
  return value
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatStatus(status?: string) {
  return (status || "not_started").replaceAll("_", " ");
}

function normalizeApprovalNodeStatus(configuration: Record<string, unknown> | undefined, status?: string) {
  const rawStatus = String(configuration?.status ?? configuration?.approvalStatus ?? status ?? "").trim();
  if (rawStatus === "approved" || rawStatus === "ready") return "approved";
  if (rawStatus === "rejected" || rawStatus === "blocked") return "rejected";
  if (rawStatus === "in_review" || rawStatus === "in_progress" || rawStatus === "needs_review") return "in-review";
  return "";
}
