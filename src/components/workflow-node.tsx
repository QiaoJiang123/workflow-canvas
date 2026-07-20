"use client";

import { CATEGORY_COLORS, CATEGORY_LABELS, getNodeDefinition } from "@/domain/node-definitions";
import { getProviderOption } from "@/domain/providers";
import { useWorkflowStore } from "@/store/use-workflow-store";
import { DynamicIcon } from "./icon";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Bolt, MoreHorizontal } from "lucide-react";
import Image from "next/image";

interface WorkflowNodeData {
  id: string;
  label: string;
  definitionId: string;
  category: keyof typeof CATEGORY_LABELS;
  description?: string;
  technology?: string;
  providerId?: string;
  status?: string;
  invalid?: boolean;
}

export function WorkflowNodeComponent({ data, selected }: NodeProps) {
  const node = data as unknown as WorkflowNodeData;
  const definition = getNodeDefinition(node.definitionId);
  const color = CATEGORY_COLORS[node.category];
  const select = useWorkflowStore((state) => state.select);
  const isTrigger = !definition?.inputs.length;
  const provider = getProviderOption(node.providerId);

  return (
    <article
      className={`workflow-node ${selected ? "is-selected" : ""} ${node.invalid ? "is-invalid" : ""}`}
      style={{ "--node-accent": color } as React.CSSProperties}
      onDoubleClick={() => select({ type: "node", id: node.id })}
    >
      {definition?.inputs.map((input) => (
        <Handle key={input.id} id={input.id} type="target" position={Position.Left} className="node-handle" />
      ))}
      {isTrigger && (
        <span className="node-trigger" aria-label="Trigger node" title="Trigger node">
          <Bolt size={13} />
        </span>
      )}
      <div className="node-tile">
        <span className="node-operation" title={node.technology || CATEGORY_LABELS[node.category]}>
          {formatOperation(node.technology || CATEGORY_LABELS[node.category])}
        </span>
        <button className="node-menu" type="button" aria-label="Node actions" title="Node actions">
          <MoreHorizontal size={15} />
        </button>
        <span className="node-icon" aria-hidden="true">
          {provider ? <Image src={provider.icon} alt="" width={28} height={28} /> : <DynamicIcon name={definition?.icon ?? "Circle"} />}
        </span>
        {provider && <span className="node-provider-badge">{provider.name}</span>}
      </div>
      <div className="node-caption">
        <strong title={node.label}>{node.label}</strong>
        <span className={`node-status ${node.status ?? "not_started"}`} title={`Status: ${formatStatus(node.status)}`} />
      </div>
      {definition?.outputs.map((output) => (
        <Handle key={output.id} id={output.id} type="source" position={Position.Right} className="node-handle" />
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
